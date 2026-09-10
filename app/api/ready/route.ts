import { NextResponse } from 'next/server';
import { sqlClient } from '@/db/client';
import { redisConnection } from '@/lib/queue';

export async function GET() {
  const checks: Record<string, 'ok' | 'down' | 'unreachable'> = {
    app: 'ok',
    database: 'down',
    queue: 'down',
    storage: 'ok',
  };

  try {
    await sqlClient`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'unreachable';
  }

  try {
    const redisPong = await redisConnection.ping();
    if (redisPong === 'PONG') {
      checks.queue = 'ok';
    }
  } catch {
    checks.queue = 'unreachable';
  }

  const isAllHealthy = checks.app === 'ok' && checks.database === 'ok';

  return NextResponse.json(checks, {
    status: isAllHealthy ? 200 : 503,
  });
}
