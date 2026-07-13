import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../client';
import type { AuditLog } from '../types';
import { buildAuditPayload } from '@/lib/audit';
import type { AuditAction, AuditAuthor, AuditArea } from '@/lib/audit';

type CreateAuditLogInput = AuditAuthor & {
  area: AuditArea;
  action: AuditAction;
  data: unknown;
};

export async function recordAuditLog(entry: CreateAuditLogInput): Promise<void> {
  await addDoc(collection(db, 'auditLogs'), {
    actorUserId: entry.actorUserId,
    actorUsername: entry.actorUsername,
    actorRole: entry.actorRole,
    subjectUserId: entry.subjectUserId ?? entry.actorUserId,
    subjectUsername: entry.subjectUsername ?? entry.actorUsername,
    area: entry.area,
    action: entry.action,
    data: buildAuditPayload(entry.data),
    createdAt: serverTimestamp(),
  });
}

export async function getAuditLogsForUser(actorUserId: string): Promise<AuditLog[]> {
  const snapshot = await getDocs(collection(db, 'auditLogs'));
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as AuditLog))
    .filter((log) => log.actorUserId === actorUserId || log.subjectUserId === actorUserId)
    .sort((left, right) => {
      const leftTime = left.createdAt?.toMillis?.() ?? new Date(left.createdAt ?? 0).getTime();
      const rightTime = right.createdAt?.toMillis?.() ?? new Date(right.createdAt ?? 0).getTime();
      return rightTime - leftTime;
    });
}

export async function getAllAuditLogs(): Promise<AuditLog[]> {
  const snapshot = await getDocs(collection(db, 'auditLogs'));
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as AuditLog))
    .sort((left, right) => {
      const leftTime = left.createdAt?.toMillis?.() ?? new Date(left.createdAt ?? 0).getTime();
      const rightTime = right.createdAt?.toMillis?.() ?? new Date(right.createdAt ?? 0).getTime();
      return rightTime - leftTime;
    });
}
