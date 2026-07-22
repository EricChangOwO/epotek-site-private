# Epotek website

Epotek 的靜態品牌網站，加上 Next.js App Router API。HTML 前台由 CDN 直接提供，詢價表單送至 `/api/contact`，部署到 Vercel 時會以 serverless function 執行。

## Local development

需求：Node.js 20.9 以上、pnpm。

```bash
pnpm install
pnpm dev
```

開啟 `http://localhost:3000`。驗證正式版：

```bash
pnpm typecheck
pnpm build
pnpm start
```

## Email setup

先複製 `.env.example` 為 `.env.local`。兩種寄信方式都已支援，若兩者同時設定會優先使用 Resend。

### Resend（建議用於 Vercel）

```dotenv
CONTACT_TO=sales@epotek.com.tw
MAIL_FROM=Epotek Website <website@your-verified-domain.com>
RESEND_API_KEY=re_xxxxxxxxx
```

Resend 使用 HTTPS API，對短生命週期的 serverless function 比 SMTP socket 更合適。正式寄送前需在 Resend 驗證寄件網域，並完成 SPF、DKIM；建議也設定 DMARC。

### Existing SMTP relay

```dotenv
CONTACT_TO=sales@epotek.com.tw
MAIL_FROM=Epotek Website <website@epotek.com.tw>
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-user
SMTP_PASS=your-password
```

Port 465 通常搭配 `SMTP_SECURE=true`；587 通常搭配 `false` 並由 STARTTLS 升級。不要使用 port 25，也不要把密碼提交到 Git。

## Deploy to Vercel

1. 將 repository 匯入 Vercel，Framework Preset 選 Next.js。
2. 在 Project Settings → Environment Variables 加入上方其中一組寄信設定。
3. 部署後確認 `/api/health` 回傳 `{"ok":true}`。
4. 從網站送一筆測試詢價，確認收件匣與 Reply-To。
5. 將正式網域指向 Vercel，再確認寄件網域的 SPF / DKIM / DMARC。

## Cloudflare Turnstile

The contact form requires Cloudflare Turnstile in both the browser and the server. Create a production widget in the Cloudflare dashboard, restrict it to the production hostnames, and add these variables to Vercel:

```dotenv
TURNSTILE_SITE_KEY=your-public-site-key
TURNSTILE_SECRET=your-secret-key
TURNSTILE_ALLOWED_HOSTNAMES=epotek-site-private.vercel.app,www.example.com
```

The browser receives only the public site key. `/api/contact` validates every single-use token with Cloudflare Siteverify before it sends email. Use Cloudflare's official dummy keys only for local or automated testing.

## GitHub to Vercel

Vercel 原生 Git integration 已連接 GitHub repository。推送至 `master` 時會自動建立 Production deployment；其他 branch 與 pull request 則建立 Preview deployment，不需要 GitHub Actions 或 Vercel CLI token。

## API behavior

- 使用 Zod 驗證姓名、Email、需求說明與長度。
- HTML email 內容會 escape，避免注入。
- 內建 honeypot 與每個 function instance 的簡易 10 分鐘 rate limit。
- 服務未設定或寄送失敗時，前台會顯示中英文錯誤，不會回報假成功。

> Serverless instance 的記憶體 rate limit 不是全域一致。若上線後有大量垃圾詢價，建議再接 Vercel WAF、Upstash Redis 或 Turnstile。
