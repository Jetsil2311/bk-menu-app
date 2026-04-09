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
  formData.append('folder', folder)

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Cloudinary upload failed (${res.status})`)
  }

  const data = await res.json()
  return { url: data.secure_url, publicId: data.public_id }
}
