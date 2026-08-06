'use client';

import type { FileUploadStatus } from '@/lib/uploads/uppy-client';

export type DraftUploadPhase = 'idle' | 'uploading' | 'ready' | 'waiting-network';

export interface PersistedFileMeta {
  name: string;
  size: number;
  lastModified: number;
  status: FileUploadStatus | 'confirmed';
  percent?: number;
  error?: string;
}

export interface DraftUploadSession {
  requestId: string;
  draftId: string;
  message: string;
  phase: DraftUploadPhase;
  files: PersistedFileMeta[];
  /** User clicked Send — auto-finalize once all uploads succeed. */
  userIntentSend: boolean;
  updatedAt: string;
}

function sessionKey(requestId: string): string {
  return `abdc:draft-upload:${requestId}`;
}

export function loadDraftUploadSession(requestId: string): DraftUploadSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(requestId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftUploadSession;
    if (parsed.requestId !== requestId || !parsed.draftId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraftUploadSession(session: DraftUploadSession): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      sessionKey(session.requestId),
      JSON.stringify({ ...session, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Quota exceeded — best-effort only.
  }
}

export function clearDraftUploadSession(requestId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(sessionKey(requestId));
  } catch {
    // ignore
  }
}

export function fileIdentity(file: { name: string; size: number; lastModified: number }): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function isSessionActive(session: DraftUploadSession): boolean {
  return session.phase === 'uploading' || session.phase === 'ready' || session.phase === 'waiting-network';
}
