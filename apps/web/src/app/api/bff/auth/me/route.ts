import { NextResponse } from 'next/server';
import { fetchMeWithRefresh, jsonError } from '@/lib/bff/auth-helpers';

export async function GET(): Promise<NextResponse> {
  const result = await fetchMeWithRefresh();
  if (!result) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(result.user);
}
