# 日常皺褶（React + Vite + Tailwind）+ 自建後端（Node + Postgres + 本機 / R2 / Cloudinary）

## 目標功能
- **前台**：文章列表 → 引導頁 → 全文（Markdown）
- **後台**：登入、文章新增/編輯/發布、封面圖/影片上傳（本機、`STORAGE_DRIVER=r2` 預簽名，或 `STORAGE_DRIVER=cloudinary` 由後端代傳）
- **資料庫**：Postgres（文章、使用者、媒體檔案 metadata）

---

## 一次跑起來（本機）

### 1) 前端
在專案根目錄：

```bash
npm install
npm run dev
```

前端預設 `http://localhost:5173`，並已把 `/api/*` 代理到後端 `http://localhost:8787`。

### 2) 後端 + DB
在 `backend/`：

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

---

## 必填環境變數（後端）
編輯 `backend/.env`：

- **DATABASE_URL**：預設已對應 docker-compose
- **JWT_SECRET**：請換成至少 16 字以上的隨機字串
- **STORAGE_DRIVER**（預設 `local`）
  - `local`：檔案存在 `backend/uploads/`，由後端 `http://localhost:8787/uploads/...` 提供（開發不必設定 R2）
  - `r2`：使用 Cloudflare R2 / S3 預簽名，並在專案根 `.env` 設 `VITE_STORAGE_DRIVER=r2` 讓前端走預簽名流程
  - `cloudinary`：後端 `POST /admin/uploads/file` 接收 multipart 後上傳 Cloudinary；**前端不要**設 `VITE_STORAGE_DRIVER=r2`
- **UPLOAD_MAX_BYTES**：multipart 上傳大小上限（bytes，預設約 120MB）。大檔影片建議改用 `STORAGE_DRIVER=r2`（預簽名直傳）或調大此值（但後端採 memory upload，過大可能佔用較多記憶體）。
- **API_PUBLIC_URL**：`STORAGE_DRIVER=local` 時，給瀏覽器組圖片網址用（預設 `http://localhost:8787`）
- **S3/R2**（僅當 `STORAGE_DRIVER=r2`）
  - `S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_BASE_URL`
- **Cloudinary**（僅當 `STORAGE_DRIVER=cloudinary`）
  - `CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET`

---

## 雲端部署（Vercel + Render + Neon + Cloudinary）

建議分工：**Neon** 只放資料庫；**Render** 跑 Express API；**Vercel** 只建置靜態前端；媒體用 **Cloudinary**（或改 `STORAGE_DRIVER=r2` + R2，並在 Vercel 設 `VITE_STORAGE_DRIVER=r2`）。

### 1) Neon（Postgres）
- 建立專案後複製連線字串，通常需加上 **`?sslmode=require`**（或依 Neon 控制台建議）。
- 此字串即 Render 上的 **`DATABASE_URL`**。

### 2) Render（後端 API）
- 可用 repo 根目錄的 `render.yaml`（`rootDir: backend`），或手動建立 Web Service 並對照：
  - **Build**：`npm install && npm run db:deploy`（套用 Prisma migration）
  - **Start**：`npm start`
- **環境變數**（範例）：
  - `DATABASE_URL`：Neon 連線字串
  - `JWT_SECRET`：至少 16 字隨機字串
  - `NODE_ENV=production`
  - `CORS_ORIGIN`：**Vercel 網域**（含 `https://`），多個用逗號分隔，例如 `https://你的專案.vercel.app`；本機開發可再加 `http://localhost:5173`
  - `STORAGE_DRIVER=cloudinary`
  - `CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET`
- 部署成功後記下公開網址，例如 `https://airport-api.onrender.com`（**不要**在末尾加 `/api`）。

### 3) Vercel（前端）
- 專案根目錄為前端；Framework 選 **Vite**（`vercel.json` 已含 SPA rewrite）。
- **Build 環境變數**設 **`VITE_API_BASE_URL`** = Render API 的根網址，例如 `https://airport-api.onrender.com`。
  - 前端會直接請求 `GET ${VITE_API_BASE_URL}/articles` 等路徑，**不要**把 `VITE_API_BASE_URL` 設成帶 `/api` 後綴（除非你真的在反向代理底下掛了 `/api`）。
- 使用 Cloudinary 時**勿**設定 `VITE_STORAGE_DRIVER=r2`，後台上傳會走 multipart。

### 4) 建立第一個後台帳號（正式環境）
與本機相同：用 Prisma Studio 連到 Neon、或用 `DATABASE_URL` 執行一次性 script 寫入 `User`（見上一節）。

---

## 建立第一個後台帳號（必要）
目前 API 沒有「註冊」端點（避免公開被濫用），請用 Prisma 建立初始使用者：

```bash
cd backend
npm run prisma -- studio
```

在 `User` 新增一筆：
- `username`: 你的登入帳號（唯一，例如 `admin`）
- `passwordHash`: 需要 bcrypt hash（建議用 Node 產生，見下方）
- `role`: `ADMIN` 或 `EDITOR`

產生 bcrypt hash（在 `backend/`）：

```bash
node -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.argv[1], 10))" your_password_here
```

把輸出的 hash 貼到 `passwordHash`。

---

## 目前路由
- **前台**
  - `/`：首頁（文章列表）
  - `/articles/:slug/intro`：引導頁
  - `/articles/:slug`：全文
- **後台**
  - `/admin`：登入 + 文章列表
  - `/admin/new`：新增文章
  - `/admin/edit/:id`：編輯文章

---

## API 摘要
- `POST /auth/login`
- `GET /articles`
- `GET /articles/:slug`
- `GET /admin/articles`（需 Bearer token）
- `POST /admin/articles`（需 Bearer token）
- `PUT /admin/articles/:id`（需 Bearer token）
- `GET /health`（回傳 `storage: local|r2|cloudinary`）
- `GET /config/public`（前端可查目前 `storageDriver`）
- `POST /admin/uploads/file`（`STORAGE_DRIVER=local` 或 `cloudinary`；multipart `file` + `kind`，需 Bearer token）
- `POST /admin/uploads/presign`（`STORAGE_DRIVER=r2`；需 Bearer token）
- `POST /admin/uploads/complete`（R2 流程用；寫入 `Media` metadata）

