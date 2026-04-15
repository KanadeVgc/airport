import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z
  .object({
    PORT: z.coerce.number().default(8787),
    NODE_ENV: z.string().default('development'),

    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16),

    /** 逗號分隔：本機與正式前端網域，例如 http://localhost:5173,https://xxx.vercel.app */
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    /** local | r2 | cloudinary */
    STORAGE_DRIVER: z.enum(['local', 'r2', 'cloudinary']).default('local'),

    /** STORAGE_DRIVER=local：靜態檔網址前綴 */
    API_PUBLIC_URL: z.string().default('http://localhost:8787'),

    S3_ENDPOINT: z.string().optional().default(''),
    S3_REGION: z.string().optional().default(''),
    S3_BUCKET: z.string().optional().default(''),
    S3_ACCESS_KEY_ID: z.string().optional().default(''),
    S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
    S3_PUBLIC_BASE_URL: z.string().optional().default(''),

    CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
    CLOUDINARY_API_KEY: z.string().optional().default(''),
    CLOUDINARY_API_SECRET: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_DRIVER !== 'r2') return
    const need = [
      ['S3_ENDPOINT', data.S3_ENDPOINT],
      ['S3_REGION', data.S3_REGION],
      ['S3_BUCKET', data.S3_BUCKET],
      ['S3_ACCESS_KEY_ID', data.S3_ACCESS_KEY_ID],
      ['S3_SECRET_ACCESS_KEY', data.S3_SECRET_ACCESS_KEY],
      ['S3_PUBLIC_BASE_URL', data.S3_PUBLIC_BASE_URL],
    ]
    for (const [name, val] of need) {
      if (!val || !String(val).trim()) {
        ctx.addIssue({ code: 'custom', path: [name], message: `STORAGE_DRIVER=r2 時必填：${name}` })
      }
    }
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_DRIVER !== 'cloudinary') return
    for (const [name, val] of [
      ['CLOUDINARY_CLOUD_NAME', data.CLOUDINARY_CLOUD_NAME],
      ['CLOUDINARY_API_KEY', data.CLOUDINARY_API_KEY],
      ['CLOUDINARY_API_SECRET', data.CLOUDINARY_API_SECRET],
    ]) {
      if (!val || !String(val).trim()) {
        ctx.addIssue({ code: 'custom', path: [name], message: `STORAGE_DRIVER=cloudinary 時必填：${name}` })
      }
    }
  })

export const env = EnvSchema.parse(process.env)
