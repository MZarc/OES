import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db/client';
import * as schema from '@/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verificationTokens,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'EMPLOYEE',
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 10,     // 10 hours (work shift maximum)
    updateAge: 60 * 10,          // 10 minutes sliding activity refresh
    cookieCache: {
      enabled: true,
      maxAge: 10 * 60,           // 10 minutes cache
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
