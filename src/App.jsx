import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api, getToken, setToken } from './api.js'

function HeartbeatLogo({ onClick }) {
  return (
    <div
      className="flex items-center gap-3 cursor-pointer select-none"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.()
      }}
    >
      <svg className="w-[35px] h-[35px] animate-heartbeat" viewBox="0 0 150 150">
        <path
          d="M10,75 L40,75 L50,45 L70,105 L85,60 L95,75 L140,75"
          stroke="var(--accent)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[1.4rem] font-bold tracking-[2px]">日常皺褶</span>
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-xl md:text-2xl mb-6">{children}</h2>
}

function Container({ children, className = '' }) {
  return <div className={`max-w-[1000px] mx-auto px-6 md:px-10 ${className}`}>{children}</div>
}

function LoadingBlock() {
  return <div className="py-16 text-textLight">載入中…</div>
}

function ErrorBlock({ error }) {
  return <div className="py-16 text-red-700">錯誤：{error?.message || 'UNKNOWN'}</div>
}

function Home() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [editorialSlug, setEditorialSlug] = useState('')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    api
      .listArticles()
      .then((rows) => {
        if (cancelled) return
        setItems(rows)
        setStatus('ok')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 初始化下拉選單：等資料載入後，預設選到最新一篇報告書
  useEffect(() => {
    if (status !== 'ok') return
    if (editorialSlug) return
    const firstEditorial = items.find((a) => a.section === 'EDITORIAL')
    if (!firstEditorial?.slug) return
    setEditorialSlug(firstEditorial.slug)
  }, [items, status, editorialSlug])

  if (status === 'loading') return <LoadingBlock />
  if (status === 'error') return <ErrorBlock error={error} />

  const editorialItems = items.filter((a) => a.section === 'EDITORIAL')
  const featureItems = items.filter((a) => a.section !== 'EDITORIAL')

  // 若沒有任何文章被標成「編輯室報告書」，則用最新一篇頂上（避免首頁空掉）
  const fallbackMain = items[0] || null
  const editorialMain =
    editorialItems.find((a) => a.slug === editorialSlug) || editorialItems[0] || fallbackMain

  const featureArticles = featureItems

  return (
    <main>
      <section className="py-14 md:py-[60px]">
        <Container>
          <SectionTitle>編輯室報告書</SectionTitle>

          {editorialMain ? (
            <div className="space-y-4">
              <div
                className={`grid grid-cols-1 gap-6 items-start ${
                  editorialItems.length > 1 ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''
                }`}
              >
                <Link
                  to={`/articles/${editorialMain.slug}`}
                  className="block bg-white border border-border overflow-hidden hover:shadow-sm transition"
                >
                  <div className="relative">
                    {editorialMain.coverImageUrl ? (
                      <img
                        className="w-full h-[260px] md:h-[360px] object-cover"
                        src={editorialMain.coverImageUrl}
                        alt={editorialMain.title}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-[260px] md:h-[360px] bg-[#F2F2F2]" />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-[rgba(0,0,0,0.55)] via-[rgba(0,0,0,0.15)] to-transparent" />
                    <div className="absolute left-0 right-0 bottom-0 p-5 md:p-7 text-white">
                      <div className="text-xs tracking-[2px] opacity-90">{editorialMain.issue || 'EDITORIAL'}</div>
                      <div className="mt-2 text-2xl md:text-3xl font-semibold leading-tight">{editorialMain.title}</div>
                      {editorialMain.excerpt ? (
                        <div className="mt-3 text-sm md:text-base opacity-90 line-clamp-2">{editorialMain.excerpt}</div>
                      ) : null}
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold border-b border-white/80">
                        閱讀全文 <span aria-hidden>→</span>
                      </div>
                    </div>
                  </div>
                </Link>

                {editorialItems.length > 1 ? (
                  <aside className="border border-border bg-white">
                    <div className="px-5 py-4 border-b border-border">
                      <div className="text-sm tracking-[2px] text-textLight">其他報告書</div>
                    </div>
                    <div className="divide-y divide-border">
                      {editorialItems
                        .filter((a) => a.id !== editorialMain.id)
                        .slice(0, 4)
                        .map((a) => (
                          <Link
                            key={a.id}
                            to={`/articles/${a.slug}`}
                            className="block px-5 py-4 hover:bg-[rgba(247,243,240,0.7)] transition"
                          >
                            <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-4 items-start">
                              <div className="w-[86px] h-[64px] overflow-hidden bg-[#F2F2F2] shrink-0">
                                {a.coverImageUrl ? (
                                  <img className="w-full h-full object-cover" src={a.coverImageUrl} alt={a.title} loading="lazy" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs tracking-[2px] text-textLight">{a.issue || 'EDITORIAL'}</div>
                                <div className="mt-1 font-semibold leading-snug line-clamp-2">{a.title}</div>
                                {a.excerpt ? <div className="mt-2 text-sm text-textLight line-clamp-2">{a.excerpt}</div> : null}
                              </div>
                            </div>
                          </Link>
                        ))}
                    </div>
                  </aside>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-border min-h-[200px] md:min-h-[240px] flex items-center justify-center px-6">
              <p className="text-textLight tracking-[0.2em] text-sm md:text-base">空空如也</p>
            </div>
          )}
        </Container>
      </section>

      {featureArticles.length > 0 ? (
        <section id="features-section" className="pb-24 md:pb-[100px]">
          <Container>
            <SectionTitle>專題報導</SectionTitle>

            <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 items-start">
              {featureArticles.map((a) => (
                <Link
                  key={a.id}
                  to={`/articles/${a.slug}`}
                  className="bg-white border border-border cursor-pointer transition hover:shadow-sm flex flex-col h-full"
                >
                  <div className="h-[230px] overflow-hidden">
                    {a.coverImageUrl ? (
                      <img className="w-full h-full object-cover" src={a.coverImageUrl} alt={a.title} loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-[#F2F2F2]" />
                    )}
                  </div>
                  <div className="p-6 grow">
                    <span className="text-xs tracking-[2px] text-textLight">{a.issue || 'ISSUE'}</span>
                    <h3 className="text-[1.2rem] mt-2 mb-3">{a.title}</h3>
                    <p className="text-[0.85rem] text-textLight">{a.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </main>
  )
}

function useArticle(slug) {
  const [row, setRow] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    api
      .getArticleBySlug(slug)
      .then((r) => {
        if (cancelled) return
        setRow(r)
        setStatus('ok')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  return { row, status, error }
}

function ArticleIntro() {
  const { slug } = useParams()
  // 目前「引導頁」內容與首頁重疊；保留路由相容性但直接導向全文
  return <Navigate to={`/articles/${encodeURIComponent(slug || '')}`} replace />
}

function ArticleFull() {
  const { slug } = useParams()
  const { row, status, error } = useArticle(slug)
  const [more, setMore] = useState([])

  useEffect(() => {
    let cancelled = false
    api
      .listArticles()
      .then((rows) => {
        if (cancelled) return
        const list = Array.isArray(rows) ? rows : []
        setMore(list.filter((a) => a?.slug && a.slug !== slug).slice(0, 8))
      })
      .catch(() => {
        if (cancelled) return
        setMore([])
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (status === 'loading') return <LoadingBlock />
  if (status === 'error') return <ErrorBlock error={error} />

  const heroUrl = row.videoUrl || row.coverImageUrl
  const isVideo = Boolean(row.videoUrl)

  return (
    <div className="bg-white min-h-[calc(100vh-80px)]">
      <Container>
        <Link className="inline-block text-[0.9rem] text-textLight py-8 hover:opacity-80" to="/">
          ← 返回首頁
        </Link>

        <article className="pb-20">
          {heroUrl ? (
            <div className="border border-border bg-white mb-8 overflow-hidden">
              {isVideo ? (
                <video controls className="w-full max-h-[520px] object-cover bg-black">
                  <source src={row.videoUrl} />
                </video>
              ) : (
                <img className="w-full max-h-[520px] object-cover" src={row.coverImageUrl} alt={row.title} loading="lazy" />
              )}
            </div>
          ) : null}

          <header className="mb-8 max-w-[1000px] mx-auto">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs tracking-[2px] text-textLight">
              <span className="uppercase">{row.issue || 'ARTICLE'}</span>
              <span aria-hidden>·</span>
              <span className="uppercase">{row.section === 'EDITORIAL' ? 'EDITORIAL' : 'FEATURE'}</span>
            </div>
            <h1 className="text-3xl md:text-[2.6rem] leading-tight mt-3">{row.title}</h1>
            {row.excerpt ? (
              <p className="mt-4 text-[1.05rem] md:text-[1.15rem] text-textLight leading-relaxed">{row.excerpt}</p>
            ) : null}
          </header>

          <div
            className={`max-w-[1000px] mx-auto grid grid-cols-1 gap-10 items-start ${
              more.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''
            }`}
          >
            <div className="min-w-0">
              {row.introMarkdown ? (
                <div className="mb-8 p-5 border border-border bg-[rgba(247,243,240,0.7)] text-textMain">
                  <div className="text-sm tracking-[2px] text-textLight mb-2">導讀</div>
                  <div className="prose max-w-none article-prose text-[1.02rem] md:text-[1.08rem] leading-relaxed">
                    <ReactMarkdown>{row.introMarkdown}</ReactMarkdown>
                  </div>
                </div>
              ) : null}

              <div className="prose max-w-none article-prose text-[1.05rem] md:text-[1.15rem] leading-relaxed">
                <ReactMarkdown>{row.bodyMarkdown}</ReactMarkdown>
              </div>
            </div>

            {more.length > 0 ? (
              <aside className="border border-border bg-white">
                <div className="px-5 py-4 border-b border-border">
                  <div className="text-sm tracking-[2px] text-textLight">其他文章</div>
                </div>
                <div className="divide-y divide-border">
                  {more.map((a) => (
                    <Link key={a.id} to={`/articles/${a.slug}`} className="block px-5 py-4 hover:bg-[rgba(247,243,240,0.7)] transition">
                      <div className="text-xs tracking-[2px] text-textLight">{a.issue || (a.section === 'EDITORIAL' ? 'EDITORIAL' : 'FEATURE')}</div>
                      <div className="mt-1 font-semibold">{a.title}</div>
                      {a.excerpt ? <div className="mt-2 text-sm text-textLight line-clamp-2">{a.excerpt}</div> : null}
                    </Link>
                  ))}
                </div>
              </aside>
            ) : null}
          </div>
        </article>
      </Container>
    </div>
  )
}

function loginErrorMessage(err) {
  const code = err?.data?.error || err?.message
  if (code === 'INVALID_CREDENTIALS') {
    return '帳號或密碼錯誤。請確認 Prisma 裡的「使用者名稱」與密碼（至少 8 碼），且 passwordHash 為 bcrypt 產生的完整字串。'
  }
  if (code === 'BAD_REQUEST') {
    return '請輸入使用者名稱，且密碼至少 8 個字元。'
  }
  return err?.message || '登入失敗'
}

function AdminLogin({ onAuthed }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  return (
    <div className="bg-white min-h-[calc(100vh-80px)]">
      <Container>
        <div className="py-14">
          <h1 className="text-2xl mb-6">後台登入</h1>
          <div className="max-w-[460px] space-y-4">
            <input
              className="w-full border border-border px-3 py-2"
              placeholder="使用者名稱"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="w-full border border-border px-3 py-2"
              placeholder="密碼（至少 8 碼）"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <div className="text-red-700 text-sm whitespace-pre-wrap">{loginErrorMessage(error)}</div> : null}
            <button
              className="border border-[#333] px-4 py-2 hover:bg-[#333] hover:text-white transition"
              type="button"
              onClick={async () => {
                setError(null)
                try {
                  const r = await api.login(username.trim(), password)
                  setToken(r.token)
                  onAuthed?.()
                } catch (e) {
                  setError(e)
                }
              }}
            >
              登入
            </button>
          </div>
        </div>
      </Container>
    </div>
  )
}

function Admin() {
  const navigate = useNavigate()
  const [token, setTokenState] = useState(getToken())
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setStatus('loading')
    api
      .adminListArticles(token)
      .then((rows) => {
        if (cancelled) return
        setItems(rows)
        setStatus('ok')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) {
    return (
      <AdminLogin
        onAuthed={() => {
          setTokenState(getToken())
          navigate('/admin')
        }}
      />
    )
  }

  return (
    <div className="bg-white min-h-[calc(100vh-80px)]">
      <Container>
        <div className="py-12">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl">文章管理</h1>
            <div className="flex gap-3">
              <button
                className="border border-[#333] px-3 py-2 hover:bg-[#333] hover:text-white transition"
                type="button"
                onClick={() => navigate('/admin/new')}
              >
                新增文章
              </button>
              <button
                className="border border-border px-3 py-2 text-textLight hover:opacity-80"
                type="button"
                onClick={() => {
                  setToken('')
                  setTokenState('')
                  setToken('')
                }}
              >
                登出
              </button>
            </div>
          </div>

          {status === 'loading' ? <LoadingBlock /> : null}
          {status === 'error' ? <ErrorBlock error={error} /> : null}
          {status === 'ok' ? (
            <div className="mt-6 border border-border">
              {items.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-xs text-textLight">
                      {a.status} · {a.slug}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-[0.9rem] border border-border px-3 py-2 hover:bg-[#333] hover:text-white transition"
                      type="button"
                      onClick={() => navigate(`/admin/edit/${a.id}`)}
                    >
                      編輯
                    </button>
                    <button
                      className="text-[0.9rem] border border-red-300 text-red-700 px-3 py-2 hover:bg-red-700 hover:text-white transition"
                      type="button"
                      onClick={async () => {
                        if (!confirm(`確定要刪除「${a.title}」？此操作無法復原。`)) return
                        try {
                          setError(null)
                          await api.adminDeleteArticle(a.id, token)
                          setItems((xs) => xs.filter((x) => x.id !== a.id))
                        } catch (e) {
                          setError(e)
                        }
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  )
}

function AdminEditor({ mode }) {
  const params = useParams()
  const navigate = useNavigate()
  const token = getToken()

  const [form, setForm] = useState({
    title: '',
    excerpt: '',
    issue: '',
    section: 'FEATURE',
    status: 'DRAFT',
    coverImageUrl: '',
    videoUrl: '',
    introMarkdown: '',
    bodyMarkdown: '',
    slug: '',
  })
  const [status, setStatus] = useState(mode === 'edit' ? 'loading' : 'ok')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (mode !== 'edit') return
    let cancelled = false
    api
      .adminGetArticle(params.id, token)
      .then((r) => {
        if (cancelled) return
        setForm({
          title: r.title || '',
          excerpt: r.excerpt || '',
          issue: r.issue || '',
          section: r.section || 'FEATURE',
          status: r.status || 'DRAFT',
          coverImageUrl: r.coverImageUrl || '',
          videoUrl: r.videoUrl || '',
          introMarkdown: r.introMarkdown || '',
          bodyMarkdown: r.bodyMarkdown || '',
          slug: r.slug || '',
        })
        setStatus('ok')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [mode, params.id, token])

  if (!token) return <AdminLogin onAuthed={() => navigate('/admin')} />
  if (status === 'loading') return <LoadingBlock />
  if (status === 'error') return <ErrorBlock error={error} />

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }))

  const useR2Presign = import.meta.env.VITE_STORAGE_DRIVER === 'r2'

  function isValidHttpUrl(s) {
    if (!s) return true
    try {
      const u = new URL(String(s))
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }

  async function doPresignedUpload(file, kind) {
    if (!useR2Presign) {
      const data = await api.uploadFileLocal(file, kind, token)
      return data.publicUrl
    }

    const ext = (file.name.split('.').pop() || 'bin').replace(/^\./, '')
    const contentType = file.type || 'application/octet-stream'
    const presigned = await api.presignUpload({ contentType, kind, ext }, token)
    const putRes = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    })
    if (!putRes.ok) {
      throw new Error(`上傳到儲存空間失敗（HTTP ${putRes.status}）`)
    }
    await api.completeUpload(
      { key: presigned.key, publicUrl: presigned.publicUrl, contentType, kind },
      token,
    )
    return presigned.publicUrl
  }

  return (
    <div className="bg-white min-h-[calc(100vh-80px)]">
      <Container>
        <div className="py-10">
          <Link className="inline-block text-[0.9rem] text-textLight py-4 hover:opacity-80" to="/admin">
            ← 返回列表
          </Link>
          <h1 className="text-2xl mb-6">{mode === 'edit' ? '編輯文章' : '新增文章'}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 min-w-0">
              <input className="w-full border border-border px-3 py-2" placeholder="標題" value={form.title} onChange={set('title')} />
              <input className="w-full border border-border px-3 py-2" placeholder="期數/分類（例如 ISSUE 01）" value={form.issue} onChange={set('issue')} />
              <select className="w-full border border-border px-3 py-2" value={form.section} onChange={set('section')}>
                <option value="EDITORIAL">編輯室報告書</option>
                <option value="FEATURE">專題報導</option>
              </select>
              <input className="w-full border border-border px-3 py-2" placeholder="slug（可留空自動）" value={form.slug} onChange={set('slug')} />
              <select className="w-full border border-border px-3 py-2" value={form.status} onChange={set('status')}>
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              <textarea className="w-full border border-border px-3 py-2 min-h-[90px]" placeholder="摘要" value={form.excerpt} onChange={set('excerpt')} />

              <div className="space-y-2">
                <div className="text-sm text-textLight">封面圖</div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <input
                    className="w-full min-w-0 border border-border px-3 py-2"
                    placeholder="coverImageUrl"
                    value={form.coverImageUrl}
                    onChange={set('coverImageUrl')}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="shrink-0 w-full sm:w-auto"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setError(null)
                      try {
                        const url = await doPresignedUpload(f, 'image')
                        setForm((s) => ({ ...s, coverImageUrl: url }))
                      } catch (err) {
                        setError(err)
                        e.target.value = ''
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-textLight">影片（可選）</div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <input
                    className="w-full min-w-0 border border-border px-3 py-2"
                    placeholder="videoUrl"
                    value={form.videoUrl}
                    onChange={set('videoUrl')}
                  />
                  <input
                    type="file"
                    accept="video/*"
                    className="shrink-0 w-full sm:w-auto"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setError(null)
                      try {
                        const url = await doPresignedUpload(f, 'video')
                        setForm((s) => ({ ...s, videoUrl: url }))
                      } catch (err) {
                        setError(err)
                        e.target.value = ''
                      }
                    }}
                  />
                </div>
              </div>

              <button
                className="border border-[#333] px-4 py-2 hover:bg-[#333] hover:text-white transition"
                type="button"
                onClick={async () => {
                  try {
                    setError(null)
                    const titleTrim = form.title.trim()
                    if (!titleTrim) {
                      throw new Error('請先輸入標題（title 必填）')
                    }
                    if (!isValidHttpUrl(form.coverImageUrl.trim())) {
                      throw new Error('封面圖網址不是合法的 http/https URL（可留空）')
                    }
                    if (!isValidHttpUrl(form.videoUrl.trim())) {
                      throw new Error('影片網址不是合法的 http/https URL（可留空）')
                    }
                    const payload = {
                      title: titleTrim,
                      excerpt: form.excerpt,
                      issue: form.issue || null,
                      section: form.section,
                      status: form.status,
                      coverImageUrl: form.coverImageUrl || null,
                      videoUrl: form.videoUrl || null,
                      introMarkdown: form.introMarkdown,
                      bodyMarkdown: form.bodyMarkdown,
                      slug: form.slug || null,
                    }
                    if (mode === 'edit') await api.adminUpdateArticle(params.id, payload, token)
                    else await api.adminCreateArticle(payload, token)
                    navigate('/admin')
                  } catch (e) {
                    setError(e)
                  }
                }}
              >
                儲存
              </button>
              {error ? <div className="text-red-700 text-sm">錯誤：{error.message}</div> : null}
            </div>

            <div className="space-y-4 min-w-0">
              <textarea
                className="w-full border border-border px-3 py-2 min-h-[140px]"
                placeholder="引導頁 Markdown（可選）"
                value={form.introMarkdown}
                onChange={set('introMarkdown')}
              />
              <textarea
                className="w-full border border-border px-3 py-2 min-h-[260px]"
                placeholder="全文 Markdown"
                value={form.bodyMarkdown}
                onChange={set('bodyMarkdown')}
              />
              <div className="border border-border p-4 min-w-0 overflow-x-auto">
                <div className="text-sm text-textLight mb-2">預覽</div>
                <div className="prose max-w-none wrap-break-word">
                  <ReactMarkdown>{form.bodyMarkdown || '_（尚無內容）_'}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (location.hash === '#features') {
      requestAnimationFrame(() => {
        document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [location.hash])

  const navLinks = useMemo(
    () => [
      { label: '首頁', to: '/' },
      {
        label: '專題報導',
        to: '/#features',
      },
      { label: '後台', to: '/admin' },
    ],
    [],
  )

  return (
    <div>
      <nav className="flex justify-between items-center py-5 px-[5%] bg-[rgba(247,243,240,0.9)] backdrop-blur-[10px] sticky top-0 z-100 border-b border-border">
        <HeartbeatLogo onClick={() => navigate('/')} />
        <ul className="list-none flex gap-8">
          {navLinks.map((l) => (
            <li key={l.label}>
              <Link to={l.to} className="text-[0.9rem] text-textMain hover:opacity-80">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/articles/:slug/intro" element={<ArticleIntro />} />
        <Route path="/articles/:slug" element={<ArticleFull />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/new" element={<AdminEditor mode="new" />} />
        <Route path="/admin/edit/:id" element={<AdminEditor mode="edit" />} />
      </Routes>
    </div>
  )
}

