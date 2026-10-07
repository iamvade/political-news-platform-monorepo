import type { AuditAction } from '@news/shared/schemas';
import type { Tx } from '../db/client';
import { auditLog } from '../db/schema/index';

export interface AuditEntry {
  actorId: number;
  action: AuditAction;
  entityType: string;
  entityId: number | null;
  diff: Record<string, unknown>;
}

/** Writes one audit_log row. Call inside the same transaction as the change it records. */
export async function audit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values(entry);
}
