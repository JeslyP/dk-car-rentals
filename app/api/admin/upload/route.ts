import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildPhotoPath, validateImageUpload, VEHICLE_PHOTO_BUCKET } from '@/lib/upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Receives a vehicle photo and stores it in Supabase Storage, returning the
 * public URL to save on the vehicle. Uploading uses the service role key, so
 * the browser never gets write access to the bucket.
 */
export async function POST(req: Request) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Please choose a photo.' }, { status: 400 })

  const check = validateImageUpload({ type: file.type, size: file.size })
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  const path = buildPhotoPath(file.type)
  const db = supabaseAdmin()

  const { error } = await db.storage.from(VEHICLE_PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) {
    const message = /bucket not found/i.test(error.message)
      ? 'The photo storage is not set up yet. Run supabase-migration-v6.sql in Supabase.'
      : `Could not save the photo: ${error.message}`
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { data } = db.storage.from(VEHICLE_PHOTO_BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, path }, { status: 201 })
}
