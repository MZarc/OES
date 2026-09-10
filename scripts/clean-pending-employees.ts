import { db } from '../db/client';
import { employeeProfiles } from '../db/schema/employees';
import { verificationTokens, accounts } from '../db/schema/auth';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';

async function main() {
  console.log('🔄 Checking employee registration states...');

  // 1. Get all employees with userId === null
  const employeesWithoutUser = await db
    .select()
    .from(employeeProfiles)
    .where(isNull(employeeProfiles.userId));

  console.log(`Found ${employeesWithoutUser.length} employees without linked user accounts.`);

  for (const emp of employeesWithoutUser) {
    // If status was marked ACTIVE, revert to PENDING_ACTIVATION
    if (emp.status === 'ACTIVE') {
      await db
        .update(employeeProfiles)
        .set({ status: 'PENDING_ACTIVATION', updatedAt: new Date() })
        .where(eq(employeeProfiles.id, emp.id));
      console.log(`✅ Set ${emp.employeeCode} (${emp.fullName}) status from ACTIVE to PENDING_ACTIVATION`);
    }

    // Ensure verification token exists
    const [existingToken] = await db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.identifier, emp.email));

    if (!existingToken) {
      const activationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

      await db.insert(verificationTokens).values({
        id: `tok_${crypto.randomUUID()}`,
        identifier: emp.email,
        value: activationToken,
        expiresAt: tokenExpiresAt,
      });
      console.log(`🎫 Created verification token for ${emp.email}`);
    }
  }

  console.log('🎉 Employee registration states synchronized successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error synchronizing employees:', err);
  process.exit(1);
});
