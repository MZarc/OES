import { db, sqlClient } from '../db/client';
import { users, employeeProfiles } from '../db/schema';
import { eq, or } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function updateEmployeeNames() {
  console.log('🔄 Updating employee records in database...');

  // 1. Update Rahul Patel -> John Wick
  await db
    .update(users)
    .set({
      name: 'John Wick',
      email: 'john.wick@oes.local',
    })
    .where(or(eq(users.id, 'usr_emp_002'), eq(users.email, 'rahul@oes.local')));

  await db
    .update(employeeProfiles)
    .set({
      fullName: 'John Wick',
      email: 'john.wick@oes.local',
    })
    .where(or(eq(employeeProfiles.id, 'emp_002'), eq(employeeProfiles.email, 'rahul@oes.local')));

  // 2. Update Priya Shah -> Bruce Wayne
  await db
    .update(users)
    .set({
      name: 'Bruce Wayne',
      email: 'bruce.wayne@oes.local',
    })
    .where(or(eq(users.id, 'usr_emp_003'), eq(users.email, 'priya@oes.local')));

  await db
    .update(employeeProfiles)
    .set({
      fullName: 'Bruce Wayne',
      email: 'bruce.wayne@oes.local',
    })
    .where(or(eq(employeeProfiles.id, 'emp_003'), eq(employeeProfiles.email, 'priya@oes.local')));

  console.log('✅ Successfully updated Rahul Patel to John Wick and Priya Shah to Bruce Wayne in PostgreSQL database!');
  await sqlClient.end();
}

updateEmployeeNames().catch((err) => {
  console.error('❌ Failed to update names:', err);
  process.exit(1);
});
