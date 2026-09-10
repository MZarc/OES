import { db } from '@/db/client';
import { auditLogs } from '@/db/schema';
import crypto from 'crypto';

export interface AuditEventParams {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Appends an immutable audit log record to PostgreSQL.
 * OWASP and enterprise compliance requirement.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const id = `aud_${crypto.randomUUID()}`;
    await db.insert(auditLogs).values({
      id,
      actorUserId: params.actorUserId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeData: params.beforeData ? JSON.stringify(params.beforeData) : null,
      afterData: params.afterData ? JSON.stringify(params.afterData) : null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      requestId: params.requestId || null,
    });
  } catch (error) {
    // Audit logging failure should be logged to console without crashing user transaction
    console.error('❌ Failed to write audit log:', error);
  }
}
