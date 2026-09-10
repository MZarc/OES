'use server';

import { db } from '@/db/client';
import { auditLogs, users } from '@/db/schema';
import { desc, asc, eq, and, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: string | null;
  afterData: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date | string;
  actorName: string | null;
  actorEmail: string | null;
}

export async function getAuditLogsPaginatedAction(params?: {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  await requireAdmin();

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params?.action && params.action !== 'ALL') {
    conditions.push(eq(auditLogs.action, params.action));
  }

  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      sql`(${auditLogs.entityType} ILIKE ${term} OR ${auditLogs.entityId} ILIKE ${term} OR ${auditLogs.action} ILIKE ${term})`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(whereClause);

  const total = countResult?.count || 0;
  const totalPages = Math.ceil(total / limit);

  let orderByClause = desc(auditLogs.timestamp);
  const isAsc = params?.sortOrder === 'asc';
  if (params?.sortBy === 'action') {
    orderByClause = isAsc ? asc(auditLogs.action) : desc(auditLogs.action);
  } else if (params?.sortBy === 'timestamp') {
    orderByClause = isAsc ? asc(auditLogs.timestamp) : desc(auditLogs.timestamp);
  }

  const logs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      beforeData: auditLogs.beforeData,
      afterData: auditLogs.afterData,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      timestamp: auditLogs.timestamp,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  return {
    logs,
    total,
    page,
    totalPages,
    limit,
  };
}
