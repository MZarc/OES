import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.VALKEY_URL || 'redis://localhost:6379';

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      // Don't loop endlessly if redis is offline in dev
      return null;
    }
    return Math.min(times * 500, 2000);
  },
});

redisConnection.on('error', (err) => {
  // Silent in dev when Valkey isn't running yet
  if (process.env.NODE_ENV === 'development') {
    // console.debug('Valkey connection debug:', err.message);
  } else {
    console.error('Valkey connection error:', err);
  }
});

// Queues with domain anti-blocking rate limiters
export const invitationQueue = new Queue('employee-invitations', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10s initial backoff for SMTP rate limit response codes
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const notificationQueue = new Queue('email-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Enqueues a job into a BullMQ queue with fallback logging if Redis connection is unavailable.
 */
export async function safelyEnqueueJob<T>(
  queue: Queue,
  name: string,
  data: T,
  opts?: Parameters<Queue['add']>[2]
): Promise<{ enqueued: boolean; jobId?: string; error?: string }> {
  try {
    const job = await queue.add(name, data, opts);
    return { enqueued: true, jobId: job.id };
  } catch (error: any) {
    console.warn(`[Queue Fallback] Failed to enqueue job '${name}' into queue '${queue.name}':`, error.message);
    return { enqueued: false, error: error.message };
  }
}
