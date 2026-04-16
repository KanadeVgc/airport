import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import bcrypt from 'bcryptjs'
import slugify from 'slugify'
import { z } from 'zod'
import crypto from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from './env.js'
import { prisma } from './prisma.js'
import { requireAuth, requireRole, signToken } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const uploadsDir = join(__dirname, '..', 'uploads')

function configureCloudinary() {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

function uploadBufferToCloudinary(buffer, kind) {
  configureCloudinary()
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `airport/${kind}`, resource_type: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result)),
    )
    stream.end(buffer)
  })
}

function getS3Client() {
  if (env.STORAGE_DRIVER !== 'r2') return null
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  })
}

const app = express()
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}
app.use(morgan('dev'))
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(uploadsDir))

app.get('/health', (req, res) =>
  res.json({ ok: true, storage: env.STORAGE_DRIVER }),
)

app.get('/config/public', (req, res) => {
  res.json({ storageDriver: env.STORAGE_DRIVER })
})

// --- Auth ---
const LoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
})

app.post('/auth/login', async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'BAD_REQUEST' })

    const { username, password } = parsed.data
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' })

    let passwordOk = false
    try {
      passwordOk = await bcrypt.compare(password, user.passwordHash || '')
    } catch {
      passwordOk = false
    }
    if (!passwordOk) return res.status(401).json({ error: 'INVALID_CREDENTIALS' })

    const token = signToken(user)
    return res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } })
  } catch (err) {
    console.error('[auth/login]', err)
    if (env.NODE_ENV === 'development') {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err?.message || String(err),
      })
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

app.get('/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } })
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' })
  return res.json({ id: user.id, username: user.username, name: user.name, role: user.role })
})

// --- Public Articles ---
app.get('/articles', async (req, res) => {
  const rows = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImageUrl: true,
      issue: true,
      status: true,
      section: true,
      publishedAt: true,
    },
  })
  return res.json(rows)
})

app.get('/articles/:slug', async (req, res) => {
  const { slug } = req.params
  const row = await prisma.article.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      introMarkdown: true,
      bodyMarkdown: true,
      coverImageUrl: true,
      videoUrl: true,
      issue: true,
      publishedAt: true,
    },
  })
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' })
  return res.json(row)
})

// --- Admin Articles ---
// 表單常送 ""；z.string().url() 會把 "" 判成無效，故先轉成 null
const optionalHttpUrl = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null
    const s = String(v).trim()
    return s === '' ? null : s
  })
  .pipe(z.union([z.null(), z.string().url()]))

const ArticleUpsertSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().default(''),
  introMarkdown: z.string().default(''),
  bodyMarkdown: z.string().default(''),
  coverImageUrl: optionalHttpUrl,
  videoUrl: optionalHttpUrl,
  issue: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  section: z.enum(['EDITORIAL', 'FEATURE']).default('FEATURE'),
  slug: z.string().optional().nullable(),
})

function makeSlug(input) {
  return slugify(input, { lower: true, strict: true, trim: true })
}

app.get('/admin/articles', requireAuth, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  const rows = await prisma.article.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      issue: true,
      updatedAt: true,
      publishedAt: true,
    },
  })
  return res.json(rows)
})

app.post('/admin/articles', requireAuth, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  const parsed = ArticleUpsertSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'BAD_REQUEST' })

  const data = parsed.data
  const slug = makeSlug(data.slug || data.title)
  const publishedAt = data.status === 'PUBLISHED' ? new Date() : null

  try {
    const row = await prisma.article.create({
      data: {
        slug,
        title: data.title,
        excerpt: data.excerpt,
        introMarkdown: data.introMarkdown,
        bodyMarkdown: data.bodyMarkdown,
        coverImageUrl: data.coverImageUrl ?? null,
        videoUrl: data.videoUrl ?? null,
        issue: data.issue ?? null,
        status: data.status,
        section: data.section,
        publishedAt,
      },
    })
    return res.status(201).json(row)
  } catch (e) {
    return res.status(409).json({ error: 'CONFLICT' })
  }
})

app.get('/admin/articles/:id', requireAuth, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  const row = await prisma.article.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' })
  return res.json(row)
})

app.put('/admin/articles/:id', requireAuth, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  const parsed = ArticleUpsertSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'BAD_REQUEST' })

  const data = parsed.data
  const slug = data.slug ? makeSlug(data.slug) : undefined
  const publishedAt = data.status === 'PUBLISHED' ? new Date() : null

  try {
    const row = await prisma.article.update({
      where: { id: req.params.id },
      data: {
        ...(slug ? { slug } : {}),
        title: data.title,
        excerpt: data.excerpt,
        introMarkdown: data.introMarkdown,
        bodyMarkdown: data.bodyMarkdown,
        coverImageUrl: data.coverImageUrl ?? null,
        videoUrl: data.videoUrl ?? null,
        issue: data.issue ?? null,
        status: data.status,
        section: data.section,
        publishedAt,
      },
    })
    return res.json(row)
  } catch {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }
})

app.delete('/admin/articles/:id', requireAuth, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    await prisma.article.delete({ where: { id: req.params.id } })
    return res.status(204).end()
  } catch {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }
})

// --- 上傳：local（multipart）或 R2/S3 預簽名 ---
const uploadMaxBytes = (() => {
  const raw = process.env.UPLOAD_MAX_BYTES
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120 * 1024 * 1024
})()

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadMaxBytes },
})

const PresignSchema = z.object({
  contentType: z.string().min(1),
  kind: z.enum(['image', 'video', 'file']).default('file'),
  ext: z.string().min(1).max(10),
})

app.post(
  '/admin/uploads/file',
  requireAuth,
  requireRole(['ADMIN', 'EDITOR']),
  uploadMemory.single('file'),
  async (req, res) => {
    try {
      if (env.STORAGE_DRIVER === 'r2') {
        return res.status(400).json({
          error: 'USE_PRESIGN',
          message: 'STORAGE_DRIVER=r2 時請用 /admin/uploads/presign（前端需 VITE_STORAGE_DRIVER=r2）',
        })
      }
      if (!req.file) return res.status(400).json({ error: 'NO_FILE' })

      const kind = z.enum(['image', 'video', 'file']).parse(req.body?.kind || 'file')
      const contentType = req.file.mimetype || 'application/octet-stream'

      if (env.STORAGE_DRIVER === 'cloudinary') {
        const result = await uploadBufferToCloudinary(req.file.buffer, kind)
        await prisma.media.create({
          data: {
            key: result.public_id,
            publicUrl: result.secure_url,
            contentType,
            kind,
          },
        })
        return res.json({ key: result.public_id, publicUrl: result.secure_url })
      }

      const id = crypto.randomUUID()
      const ext = (req.file.originalname.split('.').pop() || 'bin').replace(/^\./, '')
      const key = `${kind}/${id}.${ext}`
      const dir = join(uploadsDir, kind)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, `${id}.${ext}`), req.file.buffer)

      const publicUrl = `${env.API_PUBLIC_URL.replace(/\/$/, '')}/uploads/${key}`

      await prisma.media.create({
        data: { key, publicUrl, contentType, kind },
      })

      return res.json({ key, publicUrl })
    } catch (err) {
      console.error('[admin/uploads/file]', err)
      return res.status(500).json({
        error: 'UPLOAD_FAILED',
        message: err?.message || String(err),
      })
    }
  },
)

app.post('/admin/uploads/presign', requireAuth, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    if (env.STORAGE_DRIVER !== 'r2') {
      return res.status(400).json({
        error: 'USE_DIRECT_UPLOAD',
        message:
          '目前非 r2 模式，請用 POST /admin/uploads/file（local / cloudinary；前端勿設 VITE_STORAGE_DRIVER=r2）',
      })
    }

    const s3 = getS3Client()
    if (!s3) {
      return res.status(500).json({ error: 'S3_NOT_CONFIGURED' })
    }

    const parsed = PresignSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'BAD_REQUEST' })

    const { contentType, kind, ext } = parsed.data
    const id = crypto.randomUUID()
    const key = `${kind}/${id}.${ext.replace('.', '')}`

    const cmd = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    })
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 })
    const publicUrl = `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`

    return res.json({ key, uploadUrl, publicUrl })
  } catch (err) {
    console.error('[admin/uploads/presign]', err)
    return res.status(500).json({
      error: 'PRESIGN_FAILED',
      message: err?.message || String(err),
    })
  }
})

const UploadCompleteSchema = z.object({
  key: z.string().min(1),
  publicUrl: z.string().url(),
  contentType: z
    .string()
    .optional()
    .transform((s) => (s && s.trim().length > 0 ? s : 'application/octet-stream')),
  kind: z.string().min(1),
})

app.post('/admin/uploads/complete', requireAuth, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  const parsed = UploadCompleteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'BAD_REQUEST' })

  const row = await prisma.media.upsert({
    where: { key: parsed.data.key },
    update: {
      publicUrl: parsed.data.publicUrl,
      contentType: parsed.data.contentType,
      kind: parsed.data.kind,
    },
    create: parsed.data,
  })

  return res.status(201).json(row)
})

app.use((err, req, res, next) => {
  // multer 在 middleware 階段丟錯，會進到全域 error handler
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.max(1, Math.floor(uploadMaxBytes / 1024 / 1024))
      return res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: `檔案過大（上限約 ${mb}MB）。建議改用 STORAGE_DRIVER=r2（預簽名直傳）或壓縮影片後再上傳。`,
      })
    }
    return res.status(400).json({ error: 'UPLOAD_BAD_REQUEST', message: err.message })
  }

  console.error(err)
  return res.status(500).json({ error: 'INTERNAL_ERROR' })
})

prisma
  .$connect()
  .then(() => console.log('Prisma: database connected'))
  .catch((e) => console.error('Prisma: database connection failed —', e.message))

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`)
})

