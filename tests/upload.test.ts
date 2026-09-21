import { describe, expect, it } from 'vitest'
import {
  ALLOWED_IMAGE_TYPES, buildPhotoPath, extensionForType, humanSize,
  isAllowedImageType, MAX_UPLOAD_BYTES, validateImageUpload,
} from '@/lib/upload'

describe('allowed types', () => {
  it('accepts the formats a browser can display', () => {
    for (const t of ALLOWED_IMAGE_TYPES) expect(isAllowedImageType(t)).toBe(true)
  })
  it('rejects anything else, including phone HEIC and disguised files', () => {
    expect(isAllowedImageType('image/heic')).toBe(false)
    expect(isAllowedImageType('application/pdf')).toBe(false)
    expect(isAllowedImageType('text/html')).toBe(false)
    expect(isAllowedImageType('image/svg+xml')).toBe(false)
    expect(isAllowedImageType(undefined)).toBe(false)
    expect(isAllowedImageType('')).toBe(false)
  })
})

describe('validateImageUpload', () => {
  it('accepts a normal photo', () => {
    expect(validateImageUpload({ type: 'image/jpeg', size: 300_000 })).toEqual({ ok: true })
  })
  it('explains what to do about an iPhone HEIC', () => {
    const r = validateImageUpload({ type: 'image/heic', size: 1000 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Most Compatible/)
  })
  it('rejects an oversized file and says how big it was', () => {
    const r = validateImageUpload({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/5\.0 MB/)
  })
  it('accepts a file exactly on the limit', () => {
    expect(validateImageUpload({ type: 'image/png', size: MAX_UPLOAD_BYTES })).toEqual({ ok: true })
  })
  it('rejects an empty or missing file', () => {
    expect(validateImageUpload({ type: 'image/jpeg', size: 0 }).ok).toBe(false)
    expect(validateImageUpload(null).ok).toBe(false)
    expect(validateImageUpload(undefined).ok).toBe(false)
  })
})

describe('buildPhotoPath', () => {
  it('names the file from the type, never from the upload', () => {
    expect(buildPhotoPath('image/png', 1700000000000, 0.5)).toMatch(/^vehicles\/1700000000000-[a-z0-9]+\.png$/)
    expect(buildPhotoPath('image/jpeg', 1, 0.1)).toMatch(/\.jpg$/)
    expect(buildPhotoPath('image/webp', 1, 0.1)).toMatch(/\.webp$/)
  })
  it('falls back to jpg for an unexpected type', () => {
    expect(extensionForType('image/tiff')).toBe('jpg')
  })
  it('cannot be steered out of the vehicles folder', () => {
    const path = buildPhotoPath('image/jpeg')
    expect(path.startsWith('vehicles/')).toBe(true)
    expect(path).not.toContain('..')
  })
  it('gives a different name each time', () => {
    const a = buildPhotoPath('image/jpeg', 1000, 0.1)
    const b = buildPhotoPath('image/jpeg', 1000, 0.9)
    expect(a).not.toBe(b)
  })
})

describe('humanSize', () => {
  it('reads the way a person would say it', () => {
    expect(humanSize(512)).toBe('512 bytes')
    expect(humanSize(2048)).toBe('2 KB')
    expect(humanSize(3.5 * 1024 * 1024)).toBe('3.5 MB')
  })
})
