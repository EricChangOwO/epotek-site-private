import nodemailer from "nodemailer";
import { z } from "zod";

export const runtime = "nodejs";

const inquirySchema = z.object({
  name: z.string().trim().min(1, "請填寫姓名").max(80),
  company: z.string().trim().max(120).default(""),
  email: z.email("請填寫有效的 Email").max(254),
  message: z.string().trim().min(10, "需求說明至少需要 10 個字").max(4000),
  source: z.string().trim().max(300).optional(),
  language: z.enum(["zh-Hant", "en"]).default("zh-Hant"),
  website: z.string().max(0, "Spam detected").optional().default("")
});

type Inquiry = z.infer<typeof inquirySchema>;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimits = new Map<string, number[]>();

function getClientIp(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (rateLimits.get(key) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimits.set(key, recent);
    return true;
  }

  recent.push(now);
  rateLimits.set(key, recent);
  return false;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\u0022": "&quot;",
      "'": "&#039;"
    };
    return entities[character] || character;
  });
}

function buildMessage(inquiry: Inquiry) {
  const subject = `[網站詢價] ${inquiry.company || inquiry.name}`;
  const rows = [
    ["姓名", inquiry.name],
    ["公司", inquiry.company || "—"],
    ["Email", inquiry.email],
    ["語言", inquiry.language],
    ["來源頁面", inquiry.source || "—"]
  ];
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th style="padding:8px 12px;text-align:left;border:1px solid #d7e0d5;background:#ebf0e9">${escapeHtml(label)}</th><td style="padding:8px 12px;border:1px solid #d7e0d5">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  return {
    subject,
    text: `${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n需求說明:\n${inquiry.message}`,
    html: `<h2 style="color:#0f2e20">Epotek 網站詢價</h2><table style="border-collapse:collapse">${htmlRows}</table><h3 style="margin-top:24px;color:#0f2e20">需求說明</h3><p style="white-space:pre-wrap">${escapeHtml(inquiry.message)}</p>`
  };
}

async function sendWithResend(inquiry: Inquiry) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  const to = process.env.CONTACT_TO || "sales@epotek.com.tw";
  if (!apiKey || !from) return false;

  const message = buildMessage(inquiry);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: inquiry.email,
      ...message
    }),
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the message (${response.status})`);
  }
  return true;
}

async function sendWithSmtp(inquiry: Inquiry) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM;
  const to = process.env.CONTACT_TO || "sales@epotek.com.tw";
  if (!host || !user || !pass || !from) return false;

  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000
  });

  await transporter.sendMail({
    from,
    to,
    replyTo: inquiry.email,
    ...buildMessage(inquiry)
  });
  return true;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20_000) {
    return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const wantsEnglish =
    typeof payload === "object" &&
    payload !== null &&
    "language" in payload &&
    payload.language === "en";
  const parsed = inquirySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: wantsEnglish
          ? "Please check the required fields and try again."
          : parsed.error.issues[0]?.message || "詢價內容格式不正確。"
      },
      { status: 400 }
    );
  }

  const rateLimitKey = `${getClientIp(request)}:${parsed.data.email.toLowerCase()}`;
  if (isRateLimited(rateLimitKey)) {
    return Response.json(
      {
        ok: false,
        error:
          parsed.data.language === "en"
            ? "Too many inquiries. Please try again later."
            : "詢價送出次數過多，請稍後再試。"
      },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  try {
    const sent =
      (await sendWithResend(parsed.data)) || (await sendWithSmtp(parsed.data));
    if (!sent) {
      console.error("No email provider is configured");
      return Response.json(
        {
          ok: false,
          error:
            parsed.data.language === "en"
              ? "Email service is not configured. Please email sales@epotek.com.tw directly."
              : "寄信服務尚未設定，請直接來信 sales@epotek.com.tw。"
        },
        { status: 503 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Contact email failed", error);
    return Response.json(
      {
        ok: false,
        error:
          parsed.data.language === "en"
            ? "Unable to send your inquiry. Please try again later or email us directly."
            : "目前無法送出詢價，請稍後再試或直接來信。"
      },
      { status: 502 }
    );
  }
}
