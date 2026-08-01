export type ClientTypeKind = 'individual' | 'corporate';

export function clientTypeKind(name: string | undefined | null): ClientTypeKind | null {
  const n = name?.trim().toLowerCase();
  if (n === 'individual') return 'individual';
  if (n === 'corporate') return 'corporate';
  return null;
}
