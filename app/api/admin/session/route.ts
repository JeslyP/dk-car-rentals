import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return NextResponse.json({ authenticated: await isAuthenticatedRequest(req) })
}
