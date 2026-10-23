import { isTestEnv } from '../firebase'

const CLOUD_NAME = 'dcnjg8igs'
const UPLOAD_PRESET = 'bk_menu'
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

/**
 * Uploads a File to Cloudinary using an unsigned upload preset.
 * @param {File} file
 * @param {string} folder  - e.g. 'products' or 'carousel'
 * @returns {Promise<string>} secure_url
 */
export async function uploadToCloudinary(file, folder = 'uploads') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  // Test-mode uploads go to a separate folder so they're easy to tell apart/clean up
  formData.append('folder', isTestEnv ? `test/${folder}` : folder)

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Cloudinary upload failed (${res.status})`)
  }

  const data = await res.json()
  return { url: data.secure_url, publicId: data.public_id }
}

/**
 * Delivery URL for a carousel story (9:16 Instagram-story image).
 * Trims any solid-color border baked into the export (e.g. a black strip at
 * the top), re-crops to exactly 9:16 and serves a compressed 720px-wide
 * version. Non-Cloudinary URLs are returned unchanged.
 * @param {string} url
 * @returns {string}
 */
export function storyImageUrl(url) {
  if (typeof url !== 'string') return url
  const marker = `res.cloudinary.com/${CLOUD_NAME}/image/upload/`
  if (!url.includes(marker)) return url
  return url.replace(marker, `${marker}e_trim:10/c_fill,ar_9:16,g_center,w_720/f_auto,q_auto/`)
}
