/**
 * Rules for vehicle photo uploads. Pure functions so they can be tested and
 * so the client and the server agree on what is allowed.
 */

export const VEHICLE_PHOTO_BUCKET = 'vehicle-photos'

/** Formats a browser can reliably display. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

/** Matches the bucket's own limit. Photos are shrunk in the browser first, so
 *  this only catches something that skipped that step. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export function extensionForType(mime: string): string {
  return EXTENSIONS[mime] ?? 'jpg'
}

export function isAllowedImageType(mime: unknown): mime is AllowedImageType {
  return typeof mime === 'string' && (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime)
}

/**
 * True when the browser cannot display this file as it stands, so it has to be
 * re-encoded before upload. An iPhone shooting HEIC lands here.
 */
export function needsConversion(mime: unknown): boolean {
  return !isAllowedImageType(mime)
}

export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} bytes`
}

export type UploadCheck = { ok: true } | { ok: false; error: string }

/** Validate a file before it is sent anywhere. */
export function validateImageUpload(file: { type?: string; size?: number } | null | undefined): UploadCheck {
  if (!file) return { ok: false, error: 'Please choose a photo.' }
  if (!isAllowedImageType(file.type)) {
    return {
      ok: false,
      error: 'That file is not a photo we can show. Use a JPEG, PNG or WebP image. On an iPhone, take the picture again with Camera set to Most Compatible.',
    }
  }
  if (typeof file.size !== 'number' || file.size <= 0) return { ok: false, error: 'That file looks empty.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `That photo is ${humanSize(file.size)}. The limit is ${humanSize(MAX_UPLOAD_BYTES)}.` }
  }
  return { ok: true }
}

/**
 * Where the photo is stored. The name is generated rather than taken from the
 * upload, so a caller cannot steer the path or overwrite someone else's file.
 */
export function buildPhotoPath(mime: string, now = Date.now(), random = Math.random()): string {
  const suffix = Math.floor(random * 1e9).toString(36)
  return `vehicles/${now}-${suffix}.${extensionForType(mime)}`
}
