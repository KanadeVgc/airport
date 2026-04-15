const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export function getToken() {
  return localStorage.getItem('token') || ''
}

export function setToken(token) {
  if (!token) localStorage.removeItem('token')
  else localStorage.setItem('token', token)
}

async function request(path, { method = 'GET', body, token, formData } = {}) {
  const headers = { Accept: 'application/json' }
  if (formData !== undefined) {
    // 由瀏覽器自動帶 multipart boundary，不可手動設 Content-Type
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body:
      formData !== undefined ? formData : body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'REQUEST_FAILED')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  // Public
  listArticles: () => request('/articles'),
  getArticleBySlug: (slug) => request(`/articles/${encodeURIComponent(slug)}`),

  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: (token) => request('/auth/me', { token }),

  // Admin
  adminListArticles: (token) => request('/admin/articles', { token }),
  adminGetArticle: (id, token) => request(`/admin/articles/${encodeURIComponent(id)}`, { token }),
  adminCreateArticle: (payload, token) => request('/admin/articles', { method: 'POST', body: payload, token }),
  adminUpdateArticle: (id, payload, token) =>
    request(`/admin/articles/${encodeURIComponent(id)}`, { method: 'PUT', body: payload, token }),

  presignUpload: (payload, token) => request('/admin/uploads/presign', { method: 'POST', body: payload, token }),
  completeUpload: (payload, token) => request('/admin/uploads/complete', { method: 'POST', body: payload, token }),

  /** STORAGE_DRIVER=local：multipart 直傳後端 */
  uploadFileLocal: (file, kind, token) => {
    const fd = new FormData()
    fd.append('kind', kind)
    fd.append('file', file)
    return request('/admin/uploads/file', { method: 'POST', formData: fd, token })
  },
}

