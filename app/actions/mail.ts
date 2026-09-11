'use server';

import { db } from '@/db/client';
import { verificationTokens, employeeProfiles, systemSettings, users, accounts, shifts } from '@/db/schema';
import { eq, desc, sql, gte, inArray, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { emailService } from '@/lib/email';
import { invitationQueue } from '@/lib/queue';
import { logAuditEvent } from '@/lib/audit';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

import { getAppBaseUrl } from '@/lib/utils';

export interface MailSystemStatus {
  smtp: {
    host: string;
    port: number;
    user?: string;
    from?: string;
    userConfigured: boolean;
    hasSavedPassword: boolean;
    connected: boolean;
    error?: string;
  };
  valkeyQueue: {
    host: string;
    port: number;
    connected: boolean;
    activeCount: number;
    completedCount: number;
    failedCount: number;
    error?: string;
  };
  tokens: {
    totalActive: number;
  };
}

export async function saveSmtpConfigAction(config: {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from?: string;
}) {
  await requireAdmin();

  if (!config.host || !config.port) {
    throw new Error('SMTP Host and Port are required.');
  }

  // Fetch existing config from DB so we preserve the existing password if not re-entered!
  const [existingRecord] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'smtp_config'))
    .limit(1);

  let existingConfig: any = {};
  if (existingRecord?.value) {
    try {
      existingConfig = JSON.parse(existingRecord.value);
    } catch {}
  }

  // Sanitize password: strip all whitespace/spaces (crucial for 16-char Gmail app passwords formatted as "xxxx xxxx xxxx xxxx")
  const rawPass = config.pass?.trim();
  const effectivePass = rawPass && rawPass.length > 0
    ? rawPass.replace(/\s+/g, '')
    : (existingConfig.pass ? String(existingConfig.pass).replace(/\s+/g, '') : undefined);

  // Auto-align From address if user is an email (e.g. Gmail/Outlook) to prevent SMTP 553 sender rejection
  let normalizedFrom = config.from?.trim();
  if ((!normalizedFrom || normalizedFrom.includes('@oes.local')) && config.user && config.user.includes('@')) {
    normalizedFrom = `OES Notifications <${config.user}>`;
  }

  const finalConfig = {
    ...existingConfig,
    ...config,
    pass: effectivePass,
    from: normalizedFrom || config.from || 'OES Notifications <no-reply@oes.local>',
  };

  // Test transporter connection
  let testError: string | null = null;
  try {
    const transporter = nodemailer.createTransport({
      host: finalConfig.host,
      port: finalConfig.port,
      secure: finalConfig.port === 465,
      auth: finalConfig.user ? { user: finalConfig.user, pass: finalConfig.pass } : undefined,
      connectionTimeout: 7000,
    });
    await transporter.verify();
  } catch (err: any) {
    testError = err.message;
  }

  // In Demo Sandbox Mode, test credentials without modifying production system settings
  const admin = await requireAdmin();
  if (admin.user.email === 'demo@oes.com') {
    if (testError) {
      return {
        success: true,
        hasSavedPassword: Boolean(finalConfig.pass),
        warning: `🔒 Demo Sandbox: Credentials tested, returned: ${testError}. Live production settings remain protected.`,
      };
    }
    return {
      success: true,
      hasSavedPassword: Boolean(finalConfig.pass),
      message: '🔒 Demo Sandbox: SMTP connection verified! Live production settings remain protected.',
    };
  }

  // Persist to system_settings in PostgreSQL so settings never vanish on server reload
  await db
    .insert(systemSettings)
    .values({
      key: 'smtp_config',
      value: JSON.stringify(finalConfig),
      description: 'System-wide SMTP outgoing email configuration',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: JSON.stringify(finalConfig),
        updatedAt: new Date(),
      },
    });

  // Update in-memory email service config
  emailService.updateConfig(finalConfig);

  if (testError) {
    return {
      success: true,
      hasSavedPassword: Boolean(finalConfig.pass),
      warning: `SMTP settings saved to database, but connection verification returned: ${testError}`,
    };
  }

  return { 
    success: true, 
    hasSavedPassword: Boolean(finalConfig.pass),
    message: 'SMTP settings saved to database and verified successfully!' 
  };
}

export async function getMailSystemStatusAction(): Promise<MailSystemStatus> {
  const admin = await requireAdmin();
  const isDemo = admin.user.email === 'demo@oes.com';

  if (isDemo) {
    return {
      smtp: {
        host: 'sandbox.smtp.mailtrap.io',
        port: 587,
        user: 'demo_mailer@oes.local',
        from: 'OES Demo Sandbox <notifications@oes.demo>',
        userConfigured: true,
        hasSavedPassword: true,
        connected: true,
      },
      valkeyQueue: {
        host: 'localhost (sandbox-local)',
        port: 6379,
        connected: true,
        activeCount: 0,
        completedCount: 14,
        failedCount: 0,
      },
      tokens: {
        totalActive: 3,
      },
    };
  }

  await emailService.ensureConfigLoaded();
  const cfg = emailService.getConfig();
  const host = cfg.host;
  const port = cfg.port;
  const user = cfg.user;
  const pass = cfg.pass;
  const from = cfg.from;

  let smtpConnected = false;
  let smtpError: string | undefined;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 4000,
    });
    await transporter.verify();
    smtpConnected = true;
  } catch (err: any) {
    smtpError = err.message || 'SMTP Server Connection Failed';
  }

  let queueConnected = false;
  let activeCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let queueError: string | undefined;

  try {
    if (invitationQueue && invitationQueue.client) {
      const client = (await invitationQueue.client) as any;
      if (client && typeof client.ping === 'function') {
        await client.ping();
      }
      queueConnected = true;
      const counts = await invitationQueue.getJobCounts('active', 'completed', 'failed');
      activeCount = counts.active || 0;
      completedCount = counts.completed || 0;
      failedCount = counts.failed || 0;
    }
  } catch (err: any) {
    queueError = err.message || 'Valkey Redis Queue Unreachable';
  }

  const [activeTokensResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(verificationTokens)
    .where(gte(verificationTokens.expiresAt, new Date()));

  return {
    smtp: {
      host,
      port,
      user,
      from,
      userConfigured: Boolean(user),
      hasSavedPassword: Boolean(pass && pass.trim().length > 0),
      connected: smtpConnected,
      error: smtpError,
    },
    valkeyQueue: {
      host: process.env.VALKEY_HOST || 'localhost',
      port: parseInt(process.env.VALKEY_PORT || '6379', 10),
      connected: queueConnected,
      activeCount,
      completedCount,
      failedCount,
      error: queueError,
    },
    tokens: {
      totalActive: activeTokensResult?.count || 0,
    },
  };
}

export async function sendTestEmailAction(toEmail: string) {
  const admin = await requireAdmin();

  if (!toEmail || !toEmail.includes('@')) {
    throw new Error('Valid email address required.');
  }

  if (admin.user.email === 'demo@oes.com') {
    return {
      success: true,
      messageId: `<demo-sandbox-${crypto.randomUUID()}@oes.local>`,
      timestamp: new Date().toISOString(),
    };
  }

  const testSubject = `OES System Test Email - ${new Date().toLocaleTimeString()}`;
  const testHtml = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #2563eb; border-radius: 8px;">
      <h2 style="color: #2563eb;">OES Mail System Health Verification</h2>
      <p>This is a real-time test message sent from the <strong>Overtime & Expense System</strong> admin console.</p>
      <p>Timestamp: <code>${new Date().toISOString()}</code></p>
      <p>Status: <span style="color: green; font-weight: bold;">DELIVERED OK</span></p>
    </div>
  `;

  const res = await emailService.sendEmail({
    to: toEmail,
    subject: testSubject,
    html: testHtml,
    text: `OES Test Email sent at ${new Date().toISOString()}`,
  });

  return {
    success: res.success,
    messageId: res.messageId,
    timestamp: new Date().toISOString(),
  };
}

export async function getActiveVerificationTokensAction() {
  const admin = await requireAdmin();
  const isDemo = admin.user.email === 'demo@oes.com';

  if (isDemo) {
    const safeSession = admin.session?.id?.slice(-4).toUpperCase() || 'DEMO';
    return [
      {
        id: `tok_demo_1_${admin.session?.id || 'demo'}`,
        identifier: `meet_${admin.session?.id || 'demo'}@oes.local`,
        value: 'demo_invite_token_meet_sandbox',
        expiresAt: new Date(Date.now() + 86400000 * 2),
        createdAt: new Date(Date.now() - 3600000),
        employeeName: 'Meet Mistry',
        employeeCode: `EMP1_${safeSession}`,
      },
      {
        id: `tok_demo_2_${admin.session?.id || 'demo'}`,
        identifier: `john_${admin.session?.id || 'demo'}@oes.local`,
        value: 'demo_invite_token_john_sandbox',
        expiresAt: new Date(Date.now() + 86400000 * 2),
        createdAt: new Date(Date.now() - 7200000),
        employeeName: 'John Wick',
        employeeCode: `EMP2_${safeSession}`,
      },
      {
        id: `tok_demo_3_${admin.session?.id || 'demo'}`,
        identifier: `bruce_${admin.session?.id || 'demo'}@oes.local`,
        value: 'demo_invite_token_bruce_sandbox',
        expiresAt: new Date(Date.now() + 86400000 * 2),
        createdAt: new Date(Date.now() - 10800000),
        employeeName: 'Bruce Wayne',
        employeeCode: `EMP3_${safeSession}`,
      },
    ];
  }

  return db
    .select({
      id: verificationTokens.id,
      identifier: verificationTokens.identifier,
      value: verificationTokens.value,
      expiresAt: verificationTokens.expiresAt,
      createdAt: verificationTokens.createdAt,
      employeeName: employeeProfiles.fullName,
      employeeCode: employeeProfiles.employeeCode,
    })
    .from(verificationTokens)
    .leftJoin(employeeProfiles, eq(employeeProfiles.email, verificationTokens.identifier))
    .where(and(
      gte(verificationTokens.expiresAt, new Date()),
      sql`${verificationTokens.identifier} NOT LIKE '%@oes.local' AND ${verificationTokens.identifier} NOT LIKE 'demo%'`
    ))
    .orderBy(desc(verificationTokens.createdAt))
    .limit(30);
}

export async function resendTokenEmailAction(tokenId: string) {
  const admin = await requireAdmin();

  if (admin.user.email === 'demo@oes.com') {
    const baseUrl = getAppBaseUrl();
    const activationUrl = `${baseUrl}/activate?email=meet_demo@oes.local&token=demo_simulated_token`;
    return { success: true, activationUrl, email: 'meet_demo@oes.local' };
  }

  await emailService.ensureConfigLoaded();

  const [record] = await db
    .select({
      tok: verificationTokens,
      employeeName: employeeProfiles.fullName,
    })
    .from(verificationTokens)
    .leftJoin(employeeProfiles, eq(employeeProfiles.email, verificationTokens.identifier))
    .where(eq(verificationTokens.id, tokenId));

  if (!record || !record.tok) {
    throw new Error('Verification token not found or has expired.');
  }

  const tok = record.tok;
  const baseUrl = getAppBaseUrl();
  const activationUrl = `${baseUrl}/activate?email=${encodeURIComponent(tok.identifier)}&token=${tok.value}`;

  const recipientName = record.employeeName || tok.identifier;

  try {
    const sent = await emailService.sendInvitationEmail(tok.identifier, recipientName, activationUrl);
    return { success: sent, activationUrl, email: tok.identifier };
  } catch (err: any) {
    console.error(`[Resend Invitation Error] to ${tok.identifier}:`, err);
    throw new Error(`Email delivery failed to ${tok.identifier}: ${err.message}`);
  }
}

export async function getActivationLinkAction(tokenId: string) {
  const admin = await requireAdmin();

  if (admin.user.email === 'demo@oes.com') {
    const baseUrl = getAppBaseUrl();
    return {
      activationUrl: `${baseUrl}/activate?email=meet_demo@oes.local&token=demo_simulated_token`,
      email: 'meet_demo@oes.local',
    };
  }

  const [tok] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.id, tokenId));

  if (!tok) {
    throw new Error('Token not found.');
  }

  const baseUrl = getAppBaseUrl();
  const activationUrl = `${baseUrl}/activate?email=${encodeURIComponent(tok.identifier)}&token=${tok.value}`;

  return { activationUrl, email: tok.identifier };
}

export interface PendingEmployeeItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  shiftName: string;
  status: string;
  invitationStatus: 'SENT' | 'NOT_SENT';
  tokenId: string | null;
  tokenValue: string | null;
  tokenExpiresAt: Date | null;
  tokenCreatedAt: Date | null;
}

export interface DoneEmployeeItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  shiftName: string;
  status: string;
  dateJoined: string | null;
  updatedAt: Date;
}

export async function getRegistrationStatusAction(): Promise<{
  pending: PendingEmployeeItem[];
  done: DoneEmployeeItem[];
}> {
  const admin = await requireAdmin();
  const isDemo = admin.user.email === 'demo@oes.com';
  const sessionId = admin.session?.id;

  const demoFilter = isDemo && sessionId
    ? sql`${employeeProfiles.id} LIKE ${'%_' + sessionId}`
    : sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`;

  // 1. Fetch all employees with shift information and userId
  const allEmployees = await db
    .select({
      id: employeeProfiles.id,
      userId: employeeProfiles.userId,
      employeeCode: employeeProfiles.employeeCode,
      fullName: employeeProfiles.fullName,
      email: employeeProfiles.email,
      department: employeeProfiles.department,
      status: employeeProfiles.status,
      dateJoined: employeeProfiles.dateJoined,
      createdAt: employeeProfiles.createdAt,
      updatedAt: employeeProfiles.updatedAt,
      shiftName: shifts.name,
    })
    .from(employeeProfiles)
    .leftJoin(shifts, eq(shifts.id, employeeProfiles.shiftId))
    .where(demoFilter)
    .orderBy(desc(employeeProfiles.createdAt));

  // 2. Fetch active verification tokens
  const activeTokens = await db
    .select()
    .from(verificationTokens)
    .where(gte(verificationTokens.expiresAt, new Date()));

  const tokenMap = new Map<string, typeof activeTokens[0]>();
  for (const t of activeTokens) {
    tokenMap.set(t.identifier.toLowerCase(), t);
  }

  // 3. Fetch all user accounts that have valid credentials
  const credentialAccounts = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.providerId, 'credential'));
  const registeredUserIds = new Set(credentialAccounts.map((a) => a.userId));

  const pending: PendingEmployeeItem[] = [];
  const done: DoneEmployeeItem[] = [];

  for (const emp of allEmployees) {
    const isRegistered = Boolean(emp.userId && registeredUserIds.has(emp.userId) && emp.status === 'ACTIVE');

    if (isRegistered) {
      done.push({
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        email: emp.email,
        department: emp.department || 'General',
        shiftName: emp.shiftName || 'Standard Shift',
        status: 'ACTIVE',
        dateJoined: emp.dateJoined || emp.createdAt.toISOString().split('T')[0],
        updatedAt: emp.updatedAt,
      });
    } else {
      // Ignored terminated/deactivated records if not pending activation
      if (emp.status === 'DEACTIVATED' || emp.status === 'TERMINATED') {
        continue;
      }

      const activeTok = tokenMap.get(emp.email.toLowerCase());
      pending.push({
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        email: emp.email,
        department: emp.department || 'General',
        shiftName: emp.shiftName || 'Standard Shift',
        status: emp.status || 'PENDING_ACTIVATION',
        invitationStatus: activeTok ? 'SENT' : 'NOT_SENT',
        tokenId: activeTok ? activeTok.id : null,
        tokenValue: activeTok ? activeTok.value : null,
        tokenExpiresAt: activeTok ? activeTok.expiresAt : null,
        tokenCreatedAt: activeTok ? activeTok.createdAt : null,
      });
    }
  }

  return { pending, done };
}

export async function sendEmployeeInvitationAction(employeeId: string) {
  await requireAdmin();
  await emailService.ensureConfigLoaded();

  const [emp] = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.id, employeeId));

  if (!emp) {
    throw new Error('Employee record not found.');
  }

  const tokenValue = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Check if token already exists for this email
  const [existingTok] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, emp.email));

  let tokenId = existingTok?.id;

  if (existingTok) {
    await db
      .update(verificationTokens)
      .set({
        value: tokenValue,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(verificationTokens.id, existingTok.id));
  } else {
    tokenId = `tok_${crypto.randomUUID()}`;
    await db.insert(verificationTokens).values({
      id: tokenId,
      identifier: emp.email,
      value: tokenValue,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const baseUrl = getAppBaseUrl();
  const activationUrl = `${baseUrl}/activate?email=${encodeURIComponent(emp.email)}&token=${tokenValue}`;

  try {
    const sent = await emailService.sendInvitationEmail(emp.email, emp.fullName, activationUrl);
    return {
      success: sent,
      email: emp.email,
      tokenId,
      activationUrl,
    };
  } catch (err: any) {
    console.error(`[Send Invitation Error] to ${emp.email}:`, err);
    throw new Error(`Email dispatch failed to ${emp.email}: ${err.message}`);
  }
}

export async function sendBulkEmployeeInvitationsAction(employeeIds: string[]) {
  await requireAdmin();

  if (!employeeIds || employeeIds.length === 0) {
    return { total: 0, successCount: 0, failureCount: 0, errors: [] };
  }

  let successCount = 0;
  const errors: string[] = [];

  for (const empId of employeeIds) {
    try {
      await sendEmployeeInvitationAction(empId);
      successCount++;
    } catch (err: any) {
      errors.push(err.message || `Failed for employee ID: ${empId}`);
    }
  }

  return {
    total: employeeIds.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

export async function activateEmployeeAccountAction(data: {
  email: string;
  token: string;
  password: string;
}) {
  const { email, token, password } = data;

  if (!email || !token || !password) {
    throw new Error('Email, activation token, and password are required.');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Verify token
  const [tokenRecord] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(sql`LOWER(${verificationTokens.identifier})`, normalizedEmail),
        eq(verificationTokens.value, token.trim()),
        gte(verificationTokens.expiresAt, new Date())
      )
    );

  if (!tokenRecord) {
    throw new Error('Invalid or expired activation token. Please request a new invitation link from your administrator.');
  }

  // 2. Find employee profile
  const [employee] = await db
    .select()
    .from(employeeProfiles)
    .where(eq(sql`LOWER(${employeeProfiles.email})`, normalizedEmail));

  if (!employee) {
    throw new Error('No employee profile found for this email address.');
  }

  // 3. Hash password using Better Auth's native crypto
  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(password);

  // 4. Check if Better Auth user already exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, normalizedEmail));

  let finalUserId = existingUser?.id;

  if (existingUser) {
    // Update password in accounts table
    const [acc] = await db.select().from(accounts).where(eq(accounts.userId, existingUser.id));
    if (acc) {
      await db
        .update(accounts)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(accounts.id, acc.id));
    } else {
      await db.insert(accounts).values({
        id: `acc_${crypto.randomUUID()}`,
        userId: existingUser.id,
        accountId: existingUser.id,
        providerId: 'credential',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, existingUser.id));
  } else {
    // Create new Better Auth user
    finalUserId = `usr_${crypto.randomUUID()}`;
    await db.insert(users).values({
      id: finalUserId,
      name: employee.fullName,
      email: employee.email,
      emailVerified: true,
      role: 'EMPLOYEE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(accounts).values({
      id: `acc_${crypto.randomUUID()}`,
      userId: finalUserId,
      accountId: finalUserId,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 5. Update employee profile to ACTIVE
  await db
    .update(employeeProfiles)
    .set({
      userId: finalUserId,
      status: 'ACTIVE',
      updatedAt: new Date(),
    })
    .where(eq(employeeProfiles.id, employee.id));

  // 6. Delete used verification token
  await db.delete(verificationTokens).where(eq(verificationTokens.id, tokenRecord.id));

  // 7. Audit log
  try {
    await logAuditEvent({
      actorUserId: finalUserId,
      action: 'EMPLOYEE_ACTIVATED',
      entityType: 'EMPLOYEE',
      entityId: employee.id,
      afterData: {
        email: employee.email,
        employeeCode: employee.employeeCode,
        status: 'ACTIVE',
      },
    });
  } catch (e) {
    // Audit log should not block activation
  }

  return {
    success: true,
    message: 'Account activated successfully! You can now sign in with your credentials.',
  };
}

