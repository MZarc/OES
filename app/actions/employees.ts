'use server';

import { db } from '@/db/client';
import { employeeProfiles, users, accounts, sessions, shifts, imports, importRows, verificationTokens } from '@/db/schema';
import { eq, desc, asc, like, or, and, sql, not, inArray, gte } from 'drizzle-orm';
import { parseEmployeeSpreadsheet } from '@/lib/excel/parser';
import { emailService } from '@/lib/email';
import { invitationQueue } from '@/lib/queue';
import { logAuditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth/session';
import { getAppBaseUrl } from '@/lib/utils';
import crypto from 'crypto';

export async function getAvailableShiftsAction() {
  await requireAdmin();
  return db.query.shifts.findMany();
}

export async function previewEmployeeImportAction(formData: FormData) {
  await requireAdmin();

  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No spreadsheet file uploaded.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const availableShifts = await db.query.shifts.findMany();
  const shiftCodes = availableShifts.map((s) => s.code);

  const parsed = parseEmployeeSpreadsheet(buffer, shiftCodes);

  // Cross-reference with existing database records for conflict detection
  const existingRecords = await db
    .select({
      id: employeeProfiles.id,
      employeeCode: employeeProfiles.employeeCode,
      fullName: employeeProfiles.fullName,
      email: employeeProfiles.email,
      status: employeeProfiles.status,
    })
    .from(employeeProfiles);

  const codeLookup = new Map<string, { fullName: string; status: string }>();
  const emailLookup = new Map<string, { fullName: string; employeeCode: string; status: string }>();

  for (const rec of existingRecords) {
    codeLookup.set(rec.employeeCode.toUpperCase().trim(), {
      fullName: rec.fullName,
      status: rec.status,
    });
    emailLookup.set(rec.email.toLowerCase().trim(), {
      fullName: rec.fullName,
      employeeCode: rec.employeeCode,
      status: rec.status,
    });
  }

  let conflictCount = 0;

  for (const row of parsed.rows) {
    if (!row.data.employeeCode || !row.data.email) continue;

    const codeKey = row.data.employeeCode.toUpperCase().trim();
    const emailKey = row.data.email.toLowerCase().trim();

    // Check Employee Code conflicts
    if (codeLookup.has(codeKey)) {
      const match = codeLookup.get(codeKey)!;
      if (match.status === 'DELETED') {
        row.errors.push(
          `Conflict: Code "${row.data.employeeCode}" matches previously deleted employee "${match.fullName}". Reactivate or change code.`
        );
      } else {
        row.errors.push(
          `Conflict: Code "${row.data.employeeCode}" already assigned to active employee "${match.fullName}".`
        );
      }
      row.isValid = false;
      conflictCount++;
    }

    // Check Email conflicts
    if (emailLookup.has(emailKey)) {
      const match = emailLookup.get(emailKey)!;
      if (match.status === 'DELETED') {
        row.errors.push(
          `Conflict: Email "${row.data.email}" belongs to deleted employee "${match.fullName}".`
        );
      } else {
        row.errors.push(
          `Conflict: Email "${row.data.email}" is already registered to "${match.fullName}" (${match.employeeCode}).`
        );
      }
      row.isValid = false;
      conflictCount++;
    }
  }

  parsed.validCount = parsed.rows.filter((r) => r.isValid).length;
  parsed.invalidCount = parsed.rows.length - parsed.validCount;

  return {
    filename: file.name,
    fileHash: crypto.createHash('sha256').update(buffer).digest('hex'),
    preview: {
      ...parsed,
      conflictCount,
    },
  };
}

export async function executeEmployeeImportAction(params: {
  filename: string;
  fileHash: string;
  rows: Array<{
    employeeCode: string;
    fullName: string;
    email: string;
    department?: string;
    shiftCode: string;
  }>;
}) {
  const admin = await requireAdmin();

  const availableShifts = await db.query.shifts.findMany();
  const shiftMap = new Map(availableShifts.map((s) => [s.code.toUpperCase(), s.id]));

  const importId = `imp_${crypto.randomUUID()}`;
  const createdEmployeeIds: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  // Track import session
  await db.insert(imports).values({
    id: importId,
    filename: params.filename,
    fileHash: params.fileHash,
    totalRows: params.rows.length,
    successCount: 0,
    failureCount: 0,
    importedBy: admin.user.id,
    status: 'PENDING',
  });

  for (let idx = 0; idx < params.rows.length; idx++) {
    const row = params.rows[idx];
    const shiftId = shiftMap.get(row.shiftCode.toUpperCase());

    if (!shiftId) {
      failureCount++;
      await db.insert(importRows).values({
        id: `impr_${crypto.randomUUID()}`,
        importId,
        rowNumber: idx + 2,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        email: row.email,
        department: row.department,
        shiftCode: row.shiftCode,
        status: 'FAILED',
        errorMessage: `Unknown shift code "${row.shiftCode}"`,
      });
      continue;
    }

    try {
      const empId = `emp_${crypto.randomUUID()}`;

      // Insert employee profile in PENDING_ACTIVATION state
      await db.insert(employeeProfiles).values({
        id: empId,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        email: row.email,
        department: row.department || 'General',
        shiftId,
        status: 'PENDING_ACTIVATION',
        dateJoined: new Date().toISOString().split('T')[0],
      });

      createdEmployeeIds.push(empId);
      successCount++;

      // Create one-time activation token
      const activationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

      await db.insert(verificationTokens).values({
        id: `tok_${crypto.randomUUID()}`,
        identifier: row.email,
        value: activationToken,
        expiresAt: tokenExpiresAt,
      });

      // Dispatch onboarding invitation email directly
      const baseUrl = getAppBaseUrl();
      const activationUrl = `${baseUrl}/activate?email=${encodeURIComponent(row.email)}&token=${activationToken}`;
      try {
        await emailService.sendInvitationEmail(row.email, row.fullName, activationUrl);
      } catch (mailErr: any) {
        console.warn(`Direct invitation send deferred for ${row.email}:`, mailErr.message);
        try {
          await invitationQueue.add('send-invitation', {
            employeeId: empId,
            email: row.email,
            fullName: row.fullName,
            activationToken,
          });
        } catch (qErr) {}
      }

      await db.insert(importRows).values({
        id: `impr_${crypto.randomUUID()}`,
        importId,
        rowNumber: idx + 2,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        email: row.email,
        department: row.department,
        shiftCode: row.shiftCode,
        status: 'IMPORTED',
      });
    } catch (rowErr: any) {
      failureCount++;
      await db.insert(importRows).values({
        id: `impr_${crypto.randomUUID()}`,
        importId,
        rowNumber: idx + 2,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        email: row.email,
        department: row.department,
        shiftCode: row.shiftCode,
        status: 'FAILED',
        errorMessage: rowErr.message,
      });
    }
  }

  // Update import summary
  await db
    .update(imports)
    .set({
      successCount,
      failureCount,
      status: failureCount === 0 ? 'PROCESSED' : 'PROCESSED_WITH_ERRORS',
      metadata: JSON.stringify({ createdEmployeeIds }),
    })
    .where(eq(imports.id, importId));

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EMPLOYEE_IMPORT_COMPLETED',
    entityType: 'IMPORT',
    entityId: importId,
    afterData: { total: params.rows.length, successCount, failureCount },
  });

  return {
    success: true,
    importId,
    total: params.rows.length,
    successCount,
    failureCount,
  };
}

export async function createEmployeeAction(data: {
  employeeCode: string;
  fullName: string;
  email: string;
  department?: string;
  designation?: string;
  shiftId: string;
  status?: string;
}) {
  const admin = await requireAdmin();

  const code = data.employeeCode.trim();
  const email = data.email.trim().toLowerCase();

  // Validate shift
  const shift = await db.query.shifts.findFirst({
    where: eq(shifts.id, data.shiftId),
  });
  if (!shift) {
    throw new Error('Selected shift does not exist.');
  }

  // Check unique constraints
  const existing = await db
    .select()
    .from(employeeProfiles)
    .where(
      or(
        eq(employeeProfiles.employeeCode, code),
        eq(employeeProfiles.email, email)
      )
    );

  if (existing.length > 0) {
    const match = existing[0];
    if (match.status === 'DELETED') {
      throw new Error(
        `Employee with code "${code}" or email "${email}" was previously deleted. Reactivate the record or use distinct credentials.`
      );
    }
    throw new Error(`Employee code "${code}" or email "${email}" already exists.`);
  }

  const empId = `emp_${crypto.randomUUID()}`;
  const status = 'PENDING_ACTIVATION';

  await db.insert(employeeProfiles).values({
    id: empId,
    userId: null,
    employeeCode: code,
    fullName: data.fullName.trim(),
    email,
    department: data.department?.trim() || 'General',
    designation: data.designation?.trim() || 'Staff',
    shiftId: data.shiftId,
    status,
    dateJoined: new Date().toISOString().split('T')[0],
  });

  // Create activation token
  const activationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await db.insert(verificationTokens).values({
    id: `tok_${crypto.randomUUID()}`,
    identifier: email,
    value: activationToken,
    expiresAt: tokenExpiresAt,
  });

  // Dispatch onboarding activation email immediately
  const baseUrl = getAppBaseUrl();
  const activationUrl = `${baseUrl}/activate?email=${encodeURIComponent(email)}&token=${activationToken}`;
  try {
    await emailService.sendInvitationEmail(email, data.fullName.trim(), activationUrl);
  } catch (mailErr: any) {
    console.warn(`[Create Employee] Direct invitation send deferred for ${email}:`, mailErr?.message);
    try {
      await invitationQueue.add('send-invitation', {
        employeeId: empId,
        email,
        fullName: data.fullName.trim(),
        activationToken,
      });
    } catch (qErr) {}
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EMPLOYEE_CREATED',
    entityType: 'EMPLOYEE',
    entityId: empId,
    afterData: { employeeCode: code, fullName: data.fullName, email, status },
  });

  return { success: true, employeeId: empId };
}

export async function updateEmployeeAction(data: {
  id: string;
  employeeCode?: string;
  fullName: string;
  email?: string;
  password?: string;
  department?: string;
  designation?: string;
  shiftId: string;
  status?: string;
}) {
  const admin = await requireAdmin();

  const [existing] = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.id, data.id));

  if (!existing) {
    throw new Error('Employee profile not found.');
  }

  const newCode = data.employeeCode?.trim() || existing.employeeCode;
  const newEmail = data.email?.trim().toLowerCase() || existing.email;

  // Validate Code Uniqueness if changed
  if (newCode !== existing.employeeCode) {
    const [codeMatch] = await db
      .select()
      .from(employeeProfiles)
      .where(and(eq(employeeProfiles.employeeCode, newCode), not(eq(employeeProfiles.id, data.id))));
    if (codeMatch) {
      throw new Error(`Employee code "${newCode}" is already assigned to "${codeMatch.fullName}".`);
    }
  }

  // Validate Email Uniqueness if changed
  if (newEmail !== existing.email) {
    const [emailMatch] = await db
      .select()
      .from(employeeProfiles)
      .where(and(eq(employeeProfiles.email, newEmail), not(eq(employeeProfiles.id, data.id))));
    if (emailMatch) {
      throw new Error(`Email "${newEmail}" is already registered to "${emailMatch.fullName}".`);
    }
  }

  // Update Employee Profile
  await db
    .update(employeeProfiles)
    .set({
      employeeCode: newCode,
      email: newEmail,
      fullName: data.fullName.trim(),
      department: data.department?.trim() || 'General',
      designation: data.designation?.trim() || 'Staff',
      shiftId: data.shiftId,
      status: data.status || existing.status,
      updatedAt: new Date(),
    })
    .where(eq(employeeProfiles.id, data.id));

  // Sync with Auth users table if linked
  if (existing.userId || newEmail !== existing.email) {
    const userMatch = existing.userId
      ? await db.select().from(users).where(eq(users.id, existing.userId))
      : await db.select().from(users).where(eq(users.email, existing.email));

    if (userMatch.length > 0) {
      const uId = userMatch[0].id;
      await db
        .update(users)
        .set({
          name: data.fullName.trim(),
          email: newEmail,
          updatedAt: new Date(),
        })
        .where(eq(users.id, uId));

      const credsChanged = newEmail !== existing.email || Boolean(data.password && data.password.trim().length >= 8);

      // Instantly invalidate all active session tokens to log out user from previous credentials
      if (credsChanged) {
        await db.delete(sessions).where(eq(sessions.userId, uId));
      }

      // Password update if provided
      if (data.password && data.password.trim().length >= 8) {
        const { hashPassword } = await import('better-auth/crypto');
        const hashedPassword = await hashPassword(data.password.trim());
        const [acc] = await db.select().from(accounts).where(eq(accounts.userId, uId));
        if (acc) {
          await db
            .update(accounts)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(eq(accounts.id, acc.id));
        } else {
          await db.insert(accounts).values({
            id: `acc_${crypto.randomUUID()}`,
            userId: uId,
            accountId: uId,
            providerId: 'credential',
            password: hashedPassword,
          });
        }
      }
    }
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EMPLOYEE_UPDATED',
    entityType: 'EMPLOYEE',
    entityId: data.id,
    beforeData: {
      employeeCode: existing.employeeCode,
      email: existing.email,
      fullName: existing.fullName,
      department: existing.department,
      designation: existing.designation,
      shiftId: existing.shiftId,
      status: existing.status,
    },
    afterData: {
      employeeCode: newCode,
      email: newEmail,
      fullName: data.fullName,
      department: data.department,
      designation: data.designation,
      shiftId: data.shiftId,
      status: data.status,
      passwordUpdated: Boolean(data.password && data.password.trim()),
    },
  });

  return { success: true };
}

export async function exportEmployeesAction(search?: string, department?: string, status?: string) {
  await requireAdmin();
  const all = await getEmployeesListAction(search, status);
  let filtered = all;
  if (department && department !== 'ALL') {
    filtered = filtered.filter((e) => e.department === department);
  }
  return filtered;
}

export async function deleteEmployeeAction(employeeId: string) {
  const admin = await requireAdmin();

  const [existing] = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.id, employeeId));

  if (!existing) {
    throw new Error('Employee not found.');
  }

  // Soft delete / deactivate to protect referential integrity of OT records and Expenses
  await db
    .update(employeeProfiles)
    .set({
      status: 'DEACTIVATED',
      updatedAt: new Date(),
    })
    .where(eq(employeeProfiles.id, employeeId));

  // Invalidate any active sessions immediately
  if (existing.userId) {
    await db.delete(sessions).where(eq(sessions.userId, existing.userId));
  } else if (existing.email) {
    const userMatches = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, existing.email.toLowerCase().trim()));
    if (userMatches.length > 0) {
      await db.delete(sessions).where(eq(sessions.userId, userMatches[0].id));
    }
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EMPLOYEE_DEACTIVATED',
    entityType: 'EMPLOYEE',
    entityId: employeeId,
    beforeData: { employeeCode: existing.employeeCode, fullName: existing.fullName, status: existing.status },
    afterData: { status: 'DEACTIVATED' },
  });

  return { success: true };
}

export async function bulkDeleteEmployeesAction(employeeIds: string[]) {
  const admin = await requireAdmin();

  if (!employeeIds || employeeIds.length === 0) {
    throw new Error('No employees selected for deactivation.');
  }

  const targets = await db
    .select()
    .from(employeeProfiles)
    .where(inArray(employeeProfiles.id, employeeIds));

  if (targets.length === 0) {
    return { success: true, count: 0 };
  }

  await db
    .update(employeeProfiles)
    .set({
      status: 'DEACTIVATED',
      updatedAt: new Date(),
    })
    .where(inArray(employeeProfiles.id, employeeIds));

  // Invalidate active sessions for all deactivated users
  const userIdsToClear: string[] = [];
  const emailsToCheck: string[] = [];

  for (const emp of targets) {
    if (emp.userId) {
      userIdsToClear.push(emp.userId);
    } else if (emp.email) {
      emailsToCheck.push(emp.email.toLowerCase().trim());
    }
  }

  if (emailsToCheck.length > 0) {
    const matchingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, emailsToCheck));
    for (const u of matchingUsers) {
      userIdsToClear.push(u.id);
    }
  }

  if (userIdsToClear.length > 0) {
    await db.delete(sessions).where(inArray(sessions.userId, userIdsToClear));
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EMPLOYEES_BULK_DEACTIVATED',
    entityType: 'EMPLOYEE',
    entityId: admin.user.id,
    afterData: { count: targets.length, employeeIds },
  });

  return { success: true, count: targets.length };
}

export async function reactivateEmployeeAction(employeeId: string) {
  const admin = await requireAdmin();

  const [existing] = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.id, employeeId));

  if (!existing) {
    throw new Error('Employee not found.');
  }

  const newStatus = existing.userId ? 'ACTIVE' : 'PENDING_ACTIVATION';

  await db
    .update(employeeProfiles)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(employeeProfiles.id, employeeId));

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EMPLOYEE_REACTIVATED',
    entityType: 'EMPLOYEE',
    entityId: employeeId,
    beforeData: { status: existing.status },
    afterData: { status: newStatus },
  });

  return { success: true, newStatus };
}

export async function sendEmployeePasswordResetAction(employeeId: string) {
  const admin = await requireAdmin();

  const [existing] = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.id, employeeId));

  if (!existing) {
    throw new Error('Employee not found.');
  }

  if (!existing.email) {
    throw new Error('Employee does not have a registered email address.');
  }

  await emailService.ensureConfigLoaded();

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

  // Clear existing verification tokens for this identifier
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, existing.email.toLowerCase().trim()));

  await db.insert(verificationTokens).values({
    id: `tok_${crypto.randomUUID()}`,
    identifier: existing.email.toLowerCase().trim(),
    value: resetToken,
    expiresAt: tokenExpiresAt,
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?email=${encodeURIComponent(existing.email.toLowerCase().trim())}&token=${resetToken}`;

  await emailService.sendPasswordResetEmail(existing.email.toLowerCase().trim(), existing.fullName, resetUrl);

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EMPLOYEE_PASSWORD_RESET_SENT',
    entityType: 'EMPLOYEE',
    entityId: employeeId,
    afterData: { email: existing.email },
  });

  return { success: true };
}

export async function resetEmployeePasswordAction(data: { email: string; token: string; password: string }) {
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanToken = data.token.trim();

  if (!data.password || data.password.trim().length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  // Validate verification token
  const [tokenRecord] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, cleanEmail),
        eq(verificationTokens.value, cleanToken),
        gte(verificationTokens.expiresAt, new Date())
      )
    );

  if (!tokenRecord) {
    throw new Error('Invalid or expired password reset link. Please request a new one from your administrator.');
  }

  // Find user in users table
  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, cleanEmail));

  let uId = userRecord?.id;

  // If user doesn't exist yet, ensure employee profile exists
  const [empProfile] = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.email, cleanEmail));

  if (!empProfile) {
    throw new Error('No employee profile found matching this email address.');
  }

  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(data.password.trim());

  if (!uId) {
    uId = `usr_${crypto.randomUUID()}`;
    await db.insert(users).values({
      id: uId,
      name: empProfile.fullName,
      email: cleanEmail,
      emailVerified: true,
      role: 'EMPLOYEE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(users)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, uId));
  }

  // Upsert account
  const [existingAcc] = await db.select().from(accounts).where(eq(accounts.userId, uId));
  if (existingAcc) {
    await db
      .update(accounts)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(accounts.id, existingAcc.id));
  } else {
    await db.insert(accounts).values({
      id: `acc_${crypto.randomUUID()}`,
      userId: uId,
      accountId: uId,
      providerId: 'credential',
      password: hashedPassword,
    });
  }

  // Update employee profile status to ACTIVE if it was pending or deactivated
  await db
    .update(employeeProfiles)
    .set({
      userId: uId,
      status: 'ACTIVE',
      updatedAt: new Date(),
    })
    .where(eq(employeeProfiles.id, empProfile.id));

  // Invalidate any old sessions
  await db.delete(sessions).where(eq(sessions.userId, uId));

  // Delete consumed token
  await db.delete(verificationTokens).where(eq(verificationTokens.id, tokenRecord.id));

  await logAuditEvent({
    actorUserId: uId,
    action: 'EMPLOYEE_PASSWORD_RESET_COMPLETED',
    entityType: 'EMPLOYEE',
    entityId: empProfile.id,
    afterData: { email: cleanEmail },
  });

  return { success: true };
}

export async function sendBulkInvitationsAction(employeeIds: string[]) {
  const admin = await requireAdmin();

  if (!employeeIds || employeeIds.length === 0) {
    throw new Error('No employees selected for email invitations.');
  }

  const targets = await db
    .select()
    .from(employeeProfiles)
    .where(
      and(
        inArray(employeeProfiles.id, employeeIds),
        not(eq(employeeProfiles.status, 'DELETED')),
        not(eq(employeeProfiles.status, 'DEACTIVATED'))
      )
    );

  await emailService.ensureConfigLoaded();

  let sentCount = 0;
  const baseUrl = getAppBaseUrl();

  for (let idx = 0; idx < targets.length; idx++) {
    const emp = targets[idx];
    const activationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    // Clean up any existing tokens for this email to avoid duplicate active links
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, emp.email));

    await db.insert(verificationTokens).values({
      id: `tok_${crypto.randomUUID()}`,
      identifier: emp.email,
      value: activationToken,
      expiresAt: tokenExpiresAt,
    });

    const activationUrl = `${baseUrl}/activate?email=${encodeURIComponent(emp.email)}&token=${activationToken}`;

    // Direct email dispatch to ensure immediate delivery
    try {
      await emailService.sendInvitationEmail(emp.email, emp.fullName, activationUrl);
      sentCount++;
    } catch (err: any) {
      console.error(`[Bulk Invite Error] Failed to send invitation to ${emp.email}:`, err);
      // Also attempt BullMQ queue as background fallback
      try {
        await invitationQueue.add('send-invitation', {
          employeeId: emp.id,
          email: emp.email,
          fullName: emp.fullName,
          activationToken,
        });
      } catch (qErr) {}
      throw new Error(`Failed to send email to ${emp.email}: ${err.message}`);
    }
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'BULK_INVITATIONS_QUEUED',
    entityType: 'EMPLOYEE',
    entityId: admin.user.id,
    afterData: { count: sentCount, employeeIds },
  });

  return { success: true, count: sentCount };
}

export async function getEmployeesListAction(query?: string, status?: string) {
  const admin = await requireAdmin();
  const isDemo = admin.user.email === 'demo@oes.com';

  const conditions = [];

  if (isDemo && admin.session?.id) {
    conditions.push(sql`${employeeProfiles.id} LIKE ${'%' + admin.session.id}`);
  } else if (!isDemo) {
    conditions.push(sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`);
  }

  if (status && status !== 'ALL') {
    if (status === 'DEACTIVATED') {
      conditions.push(or(eq(employeeProfiles.status, 'DEACTIVATED'), eq(employeeProfiles.status, 'DELETED')));
    } else {
      conditions.push(eq(employeeProfiles.status, status));
    }
  } else {
    // By default exclude deleted/deactivated employees
    conditions.push(and(not(eq(employeeProfiles.status, 'DEACTIVATED')), not(eq(employeeProfiles.status, 'DELETED'))));
  }

  const results = await db
    .select({
      id: employeeProfiles.id,
      employeeCode: employeeProfiles.employeeCode,
      fullName: employeeProfiles.fullName,
      email: employeeProfiles.email,
      department: employeeProfiles.department,
      designation: employeeProfiles.designation,
      status: employeeProfiles.status,
      dateJoined: employeeProfiles.dateJoined,
      shiftId: employeeProfiles.shiftId,
      shiftName: shifts.name,
      shiftCode: shifts.code,
    })
    .from(employeeProfiles)
    .innerJoin(shifts, eq(employeeProfiles.shiftId, shifts.id))
    .where(and(...conditions))
    .orderBy(desc(employeeProfiles.createdAt));

  if (!query || !query.trim()) {
    return results;
  }

  const q = query.toLowerCase().trim();
  return results.filter(
    (e) =>
      e.employeeCode.toLowerCase().includes(q) ||
      e.fullName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.department && e.department.toLowerCase().includes(q))
  );
}

export async function getEmployeesPaginatedAction(params?: {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const admin = await requireAdmin();
  const isDemo = admin.user.email === 'demo@oes.com';

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 15));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (isDemo && admin.session?.id) {
    conditions.push(sql`${employeeProfiles.id} LIKE ${'%' + admin.session.id}`);
  } else if (!isDemo) {
    conditions.push(sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`);
  }

  if (params?.status && params.status !== 'ALL') {
    if (params.status === 'DEACTIVATED') {
      conditions.push(or(eq(employeeProfiles.status, 'DEACTIVATED'), eq(employeeProfiles.status, 'DELETED')));
    } else {
      conditions.push(eq(employeeProfiles.status, params.status));
    }
  } else {
    // By default exclude deleted and deactivated employees unless specifically filtered
    conditions.push(and(not(eq(employeeProfiles.status, 'DEACTIVATED')), not(eq(employeeProfiles.status, 'DELETED'))));
  }

  if (params?.department && params.department !== 'ALL') {
    conditions.push(eq(employeeProfiles.department, params.department));
  }

  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      sql`(${employeeProfiles.fullName} ILIKE ${term} OR ${employeeProfiles.employeeCode} ILIKE ${term} OR ${employeeProfiles.email} ILIKE ${term})`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderByClause = desc(employeeProfiles.createdAt);
  const isAsc = params?.sortOrder === 'asc';
  if (params?.sortBy === 'fullName') {
    orderByClause = isAsc ? asc(employeeProfiles.fullName) : desc(employeeProfiles.fullName);
  } else if (params?.sortBy === 'employeeCode') {
    orderByClause = isAsc ? asc(employeeProfiles.employeeCode) : desc(employeeProfiles.employeeCode);
  } else if (params?.sortBy === 'dateJoined') {
    orderByClause = isAsc ? asc(employeeProfiles.dateJoined) : desc(employeeProfiles.dateJoined);
  } else if (params?.sortBy === 'createdAt') {
    orderByClause = isAsc ? asc(employeeProfiles.createdAt) : desc(employeeProfiles.createdAt);
  }

  const [[totalCountResult], records] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeProfiles)
      .where(whereClause),
    db
      .select({
        id: employeeProfiles.id,
        employeeCode: employeeProfiles.employeeCode,
        fullName: employeeProfiles.fullName,
        email: employeeProfiles.email,
        department: employeeProfiles.department,
        designation: employeeProfiles.designation,
        status: employeeProfiles.status,
        dateJoined: employeeProfiles.dateJoined,
        shiftId: employeeProfiles.shiftId,
        shiftName: shifts.name,
        shiftCode: shifts.code,
      })
      .from(employeeProfiles)
      .innerJoin(shifts, eq(employeeProfiles.shiftId, shifts.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalCountResult?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    records,
    total,
    page,
    totalPages,
    limit,
  };
}

export async function toggleEmployeeStatusAction(employeeId: string, newStatus: string) {
  const admin = await requireAdmin();

  const updated = await db
    .update(employeeProfiles)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(employeeProfiles.id, employeeId))
    .returning();

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: `EMPLOYEE_${newStatus}`,
    entityType: 'EMPLOYEE',
    entityId: employeeId,
    afterData: { newStatus },
  });

  return { success: true, updated: updated[0] };
}
