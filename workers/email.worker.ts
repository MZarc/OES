import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue';
import { emailService } from '@/lib/email';

export interface InvitationJobData {
  employeeId: string;
  email: string;
  fullName: string;
  activationToken: string;
}

export function startEmailWorker() {
  console.log('🚀 Starting Email & Invitation BullMQ Worker...');

  const worker = new Worker(
    'employee-invitations',
    async (job: Job<InvitationJobData>) => {
      const { email, fullName, activationToken } = job.data;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const activationUrl = `${appUrl}/activate?token=${activationToken}&email=${encodeURIComponent(email)}`;

      console.log(`📨 [Worker Job #${job.id}] Dispatching invitation to ${email}...`);
      const sent = await emailService.sendInvitationEmail(email, fullName, activationUrl);

      if (!sent) {
        throw new Error(`Failed to send invitation email to ${email}`);
      }

      return { delivered: true, sentAt: new Date().toISOString() };
    },
    {
      connection: redisConnection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ [Worker Job #${job.id}] Completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [Worker Job #${job?.id}] Failed with error: ${err.message}`);
  });

  return worker;
}
