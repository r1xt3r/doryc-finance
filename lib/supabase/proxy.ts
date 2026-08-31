import { NextResponse, type NextRequest } from 'next/server';

export function updateSession(request: NextRequest) {
  // Authentication is validated by /api/dashboard with the user's bearer token.
  // Avoid a blocking network round-trip before rendering every page.
  return NextResponse.next({ request });
}
