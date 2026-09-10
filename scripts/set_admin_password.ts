import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { users, accounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const email = 'admin@oes.local';
  const password = 'Admin@123456';

  console.log(`Setting password for ${email}...`);

  try {
    // Delete existing account entry if any to re-hash properly with Better Auth
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      await db.delete(accounts).where(eq(accounts.userId, existingUser.id));
      await db.delete(users).where(eq(users.id, existingUser.id));
    }

    // Use Better Auth internal signUpEmail API to properly create the hashed account
    const user = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: 'Super Administrator',
      },
    });

    if (user && user.user) {
      await db
        .update(users)
        .set({ role: 'SUPER_ADMIN', emailVerified: true })
        .where(eq(users.id, user.user.id));
      console.log('✅ Admin user registered with hashed password!');
    }
  } catch (err: any) {
    console.error('Registration note/error:', err.message);
  }
}

main().then(() => process.exit(0));
