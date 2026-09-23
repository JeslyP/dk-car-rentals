'use client'
import { needsConversion } from './upload'

/**
 * Shrink a photo in the browser before uploading it.
 *
 * Photos straight off a phone are several megabytes, which is slow to upload
 * on a weak connection and slow to load on the fleet page. Scaling the longest
 * edge down and re-encoding as JPEG typically turns 4 MB into about 300 KB with
 * no visible difference at the size the picture is displayed.
 *
 * Returns the original file untouched if the browser cannot decode it at all.
 */
export async function shrinkImage(file: File, maxEdge = 1600, quality = 0.85): Promise<File> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file

  /**
   * A HEIC off an iPhone is not a format browsers will display, so once we can
   * decode it, it has to leave here as a JPEG even when that makes the file
   * larger. HEIC is more efficient than JPEG, so re-encoding often does grow
   * it — and the size shortcuts below would otherwise hand back the HEIC,
   * which validation then rejects as "not a photo we can show".
   */
  const mustConvert = needsConversion(file.type)

  let bitmap: ImageBitmap
  try {
    // from-image honours the EXIF rotation, so portrait photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, maxEdge / longest)
    // Already small enough and modest in size: leave it alone.
    if (!mustConvert && scale === 1 && file.size <= 900_000) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return file
    if (!mustConvert && blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close?.()
  }
}
