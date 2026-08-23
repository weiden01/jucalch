import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  parseMessageToEvents,
  extractTextFromImage,
  type ExistingEventContext,
  type LinkedEvent,
} from "@/lib/gptParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanAscii(v: string | undefined): string | undefined {
  if (!v) return v;
  // eslint-disable-next-line no-control-regex
  return v.replace(/[^\x20-\x7e]/g, "").trim();
}

const BOT_TOKEN = cleanAscii(process.env.TELEGRAM_BOT_TOKEN);
const WEBHOOK_SECRET = cleanAscii(process.env.TELEGRAM_WEBHOOK_SECRET);
const ALLOWED_USER_IDS = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
    caption?: string;
    caption_entities?: TelegramEntity[];
    entities?: TelegramEntity[];
    document?: TelegramDocument;
    photo?: TelegramPhotoSize[];
    date: number;
  };
}

async function sendReply(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  }).catch((e) => console.error("[telegram] sendReply failed", e));
}

function extractUrls(text: string, entities?: TelegramEntity[]): string[] {
  const urls = new Set<string>();
  const urlRegex = /https?:\/\/[^\s<>]+/g;
  const matches = text.match(urlRegex);
  if (matches) matches.forEach((u) => urls.add(u));
  if (entities) {
    for (const e of entities) {
      if (e.type === "text_link" && e.url) urls.add(e.url);
      if (e.type === "url") urls.add(text.substring(e.offset, e.offset + e.length));
    }
  }
  return Array.from(urls);
}

interface FetchedArticle {
  url: string;
  title: string;
  source: string;
  bodyText: string;
}

function extractTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return decodeEntities(og[1]).trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t?.[1]) return decodeEntities(t[1]).replace(/\s+/g, " ").trim();
  return null;
}

function extractSourceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return url;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

async function fetchArticle(url: string, maxBodyChars = 6000): Promise<FetchedArticle | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; jucalch-bot/1.0; +https://jucalch.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const title = extractTitle(html) ?? extractSourceFromUrl(url);
    const source = extractSourceFromUrl(url);

    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxBodyChars);

    return { url, title, source, bodyText };
  } catch (e) {
    console.warn("[telegram] fetchArticle failed", url, e);
    return null;
  }
}

function genId(): string {
  return `tg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// GPT 응답에서 date/time 필드 정규화 (빈값, "-", "null" 같은 placeholder → null)
function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t === "-" || t.toLowerCase() === "null" || t.toLowerCase() === "none") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}
function cleanTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t === "-" || t.toLowerCase() === "null") return null;
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}
function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t === "-" || t.toLowerCase() === "null") return null;
  return t;
}

// ============================================================
// Telegram 파일 다운로드
// ============================================================
async function tgGetFileUrl(fileId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(10000) },
    );
    const json = (await res.json()) as { ok: boolean; result?: { file_path: string } };
    if (!json.ok || !json.result?.file_path) return null;
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`;
  } catch (e) {
    console.warn("[telegram] getFileUrl failed", e);
    return null;
  }
}

async function tgFetchAsText(fileUrl: string, maxChars = 20000): Promise<string | null> {
  try {
    const res = await fetch(fileUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const raw = await res.text();
    // HTML이면 태그 제거, 아니면 원본 반환
    const looksHtml = /<html|<body|<!doctype/i.test(raw.slice(0, 500));
    const cleaned = looksHtml
      ? raw
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
          .replace(/\s+/g, " ")
          .trim()
      : raw;
    return cleaned.slice(0, maxChars);
  } catch (e) {
    console.warn("[telegram] fetchAsText failed", e);
    return null;
  }
}

async function tgFetchAsBase64DataUrl(fileUrl: string, mime = "image/jpeg"): Promise<string | null> {
  try {
    const res = await fetch(fileUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.warn("[telegram] fetchAsBase64 failed", e);
    return null;
  }
}

function isTextLikeFile(doc: TelegramDocument): boolean {
  const mime = (doc.mime_type ?? "").toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (["application/xml", "application/json", "application/xhtml+xml"].includes(mime)) return true;
  if (doc.file_name && /\.(html?|txt|md|xml|json|csv)$/i.test(doc.file_name)) return true;
  return false;
}

// ============================================================
// 중복 판단 유틸
// ============================================================
function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·•\-–—_/,.·]/g, "")
    .replace(/발표|공시|결정|예정|일정|이벤트/g, "");
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (longer.includes(shorter) && shorter.length >= 3) return 0.85;
  // 간단한 자카드 (bigram)
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = bigrams(na);
  const B = bigrams(nb);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

async function fetchRecentEventsForContext(): Promise<ExistingEventContext[]> {
  if (!supabaseAdmin) return [];
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 120);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, date, date_end, date_label, company_name, ticker, type, title")
    .gte("date", fmt(from))
    .lte("date", fmt(to))
    .order("date", { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    date: r.date as string,
    dateEnd: (r.date_end as string | null) ?? null,
    dateLabel: (r.date_label as string | null) ?? null,
    companyName: r.company_name as string,
    ticker: (r.ticker as string) ?? "-",
    type: r.type as string,
    title: r.title as string,
  }));
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// ============================================================
// 명령어 처리기
// ============================================================
async function handleCommand(text: string, chatId: number): Promise<Response> {
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();

  if (cmd === "/start" || cmd === "/help") {
    await sendReply(
      chatId,
      [
        "<b>jucalch 봇 사용법</b>",
        "",
        "📝 <b>이벤트 등록</b>: 그냥 뉴스/텍스트/URL 보내면 자동 파싱",
        "",
        "📋 <b>/list</b> — 다가오는 이벤트 20개 목록",
        "🗑️ <b>/delete &lt;id&gt;</b> — 특정 이벤트 삭제 (id 뒷자리 6~8자만 입력해도 OK)",
        "💥 <b>/clear yes</b> — 전체 이벤트 삭제 (yes 없으면 무시)",
        "❓ <b>/help</b> — 이 도움말",
      ].join("\n"),
    );
    return new Response("help", { status: 200 });
  }

  if (cmd === "/list") {
    if (!supabaseAdmin) {
      await sendReply(chatId, "❌ DB 연결 없음");
      return new Response("no db", { status: 200 });
    }
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id, date, time, title, company_name")
      .gte("date", todayISO())
      .order("date", { ascending: true })
      .order("time", { ascending: true, nullsFirst: true })
      .limit(20);
    if (error) {
      await sendReply(chatId, `❌ 조회 실패: ${error.message}`);
      return new Response("list err", { status: 200 });
    }
    if (!data || data.length === 0) {
      await sendReply(chatId, "📭 등록된 다가오는 이벤트가 없음.");
      return new Response("empty", { status: 200 });
    }
    const lines = data.map((e) => {
      const shortId = String(e.id).slice(-8);
      const time = e.time ? ` ${e.time}` : "";
      return `<code>${shortId}</code> · ${e.date}${time} · ${e.title} (${e.company_name})`;
    });
    await sendReply(
      chatId,
      [`📋 다가오는 이벤트 <b>${data.length}개</b>`, "", ...lines, "", "삭제: /delete &lt;id 뒷 8자리&gt;"].join("\n"),
    );
    return new Response("listed", { status: 200 });
  }

  if (cmd === "/delete") {
    if (!supabaseAdmin) {
      await sendReply(chatId, "❌ DB 연결 없음");
      return new Response("no db", { status: 200 });
    }
    if (!arg) {
      await sendReply(chatId, "사용법: <code>/delete &lt;id&gt;</code>\n먼저 /list 로 id 확인");
      return new Response("no arg", { status: 200 });
    }
    // arg가 id 전체 또는 뒷 몇 자리
    const { data: matches, error: qErr } = await supabaseAdmin
      .from("events")
      .select("id, date, title, company_name")
      .ilike("id", `%${arg}%`)
      .limit(10);
    if (qErr) {
      await sendReply(chatId, `❌ 조회 실패: ${qErr.message}`);
      return new Response("q err", { status: 200 });
    }
    if (!matches || matches.length === 0) {
      await sendReply(chatId, `⚠️ <code>${arg}</code> 에 해당하는 이벤트 없음`);
      return new Response("no match", { status: 200 });
    }
    if (matches.length > 1) {
      const lines = matches.map(
        (e) => `<code>${String(e.id).slice(-8)}</code> · ${e.date} · ${e.title}`,
      );
      await sendReply(
        chatId,
        [`⚠️ 여러 개 매치됨 (${matches.length}). 더 구체적으로:`, "", ...lines].join("\n"),
      );
      return new Response("multi", { status: 200 });
    }
    const target = matches[0];
    const { error: delErr } = await supabaseAdmin.from("events").delete().eq("id", target.id);
    if (delErr) {
      await sendReply(chatId, `❌ 삭제 실패: ${delErr.message}`);
      return new Response("del err", { status: 200 });
    }
    await sendReply(
      chatId,
      `🗑️ 삭제 완료\n${target.date} · <b>${target.title}</b> (${target.company_name})`,
    );
    return new Response("deleted", { status: 200 });
  }

  if (cmd === "/clear") {
    if (!supabaseAdmin) {
      await sendReply(chatId, "❌ DB 연결 없음");
      return new Response("no db", { status: 200 });
    }
    if (arg !== "yes") {
      await sendReply(
        chatId,
        "⚠️ 전체 이벤트 삭제 확인이 필요함.\n실행: <code>/clear yes</code>",
      );
      return new Response("need confirm", { status: 200 });
    }
    const { count: before } = await supabaseAdmin
      .from("events")
      .select("id", { count: "exact", head: true });
    const { error: delErr } = await supabaseAdmin
      .from("events")
      .delete()
      .not("id", "is", null);
    if (delErr) {
      await sendReply(chatId, `❌ 전체 삭제 실패: ${delErr.message}`);
      return new Response("clear err", { status: 200 });
    }
    await sendReply(chatId, `💥 전체 이벤트 삭제 완료 (${before ?? 0}개)`);
    return new Response("cleared", { status: 200 });
  }

  await sendReply(
    chatId,
    `모르는 명령어: <code>${cmd}</code>\n/help 로 사용법 확인`,
  );
  return new Response("unknown cmd", { status: 200 });
}

// ============================================================
// Health check + 환경변수 오염 진단
// ============================================================
function checkKey(raw: string | undefined, expectedPrefix: string, expectedLen?: number) {
  if (!raw) return { present: false };
  // eslint-disable-next-line no-control-regex
  const nonAsciiCount = [...raw].filter((c) => c.charCodeAt(0) > 126).length;
  const clean = raw.replace(/[^\x20-\x7e]/g, "");
  return {
    present: true,
    rawLen: raw.length,
    cleanLen: clean.length,
    nonAsciiChars: nonAsciiCount,
    startsWithExpected: raw.startsWith(expectedPrefix),
    expectedLen,
    lenMatchesExpected: expectedLen ? raw.length === expectedLen : undefined,
  };
}

export async function GET() {
  return Response.json({
    ok: true,
    hasBotToken: !!BOT_TOKEN,
    hasSecret: !!WEBHOOK_SECRET,
    allowedUserCount: ALLOWED_USER_IDS.length,
    hasSupabaseAdmin: !!supabaseAdmin,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    diagnostics: {
      OPENAI_API_KEY: checkKey(process.env.OPENAI_API_KEY, "sk-", 156),
      SUPABASE_SERVICE_ROLE_KEY: checkKey(process.env.SUPABASE_SERVICE_ROLE_KEY, "eyJ"),
      NEXT_PUBLIC_SUPABASE_URL: checkKey(process.env.NEXT_PUBLIC_SUPABASE_URL, "https://"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: checkKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "eyJ"),
      TELEGRAM_BOT_TOKEN: checkKey(process.env.TELEGRAM_BOT_TOKEN, "88", 46),
    },
  });
}

// ============================================================
// Telegram webhook
// ============================================================
export async function POST(req: NextRequest) {
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (receivedSecret !== WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const msg = update.message;
  if (!msg) return new Response("no message", { status: 200 });

  const hasText = !!(msg.text || msg.caption);
  const hasDoc = !!msg.document;
  const hasPhoto = !!(msg.photo && msg.photo.length > 0);
  if (!hasText && !hasDoc && !hasPhoto) {
    return new Response("no content", { status: 200 });
  }

  const userId = msg.from?.id?.toString() ?? "";
  if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId)) {
    console.warn("[telegram] blocked user", userId);
    return new Response("forbidden user", { status: 200 });
  }

  const chatId = msg.chat.id;
  const textOrCaption = (msg.text ?? msg.caption ?? "").trim();

  // ============================================================
  // 명령어 처리 (텍스트만)
  // ============================================================
  if (textOrCaption.startsWith("/")) {
    return handleCommand(textOrCaption, chatId);
  }

  try {
    if (supabaseAdmin) {
      await supabaseAdmin.from("raw_messages").insert({
        source: "telegram",
        external_id: msg.message_id.toString(),
        user_id: userId,
        text: textOrCaption,
        metadata: {
          chat_id: chatId,
          date: msg.date,
          entities: msg.entities ?? msg.caption_entities ?? null,
          document: msg.document ?? null,
          photoCount: msg.photo?.length ?? 0,
        },
      });
    }

    let combinedText = textOrCaption;
    const entities = msg.entities ?? msg.caption_entities ?? [];
    const urls = extractUrls(textOrCaption, entities);
    const fetchedArticles: FetchedArticle[] = [];
    if (urls.length > 0) {
      await sendReply(chatId, `🔗 링크 ${urls.length}개 열어보는 중...`);
      for (const url of urls.slice(0, 5)) {
        const article = await fetchArticle(url);
        if (article) {
          fetchedArticles.push(article);
          combinedText += `\n\n[관련 기사: ${article.title} (${article.source})]\n${article.bodyText}`;
        }
      }
    }

    // ============================================================
    // 첨부 문서 처리 (HTML/TXT/MD 등)
    // ============================================================
    if (hasDoc && msg.document) {
      const doc = msg.document;
      if (isTextLikeFile(doc)) {
        await sendReply(chatId, `📄 파일 처리 중: <code>${doc.file_name ?? doc.file_id}</code>`);
        const url = await tgGetFileUrl(doc.file_id);
        if (url) {
          const text = await tgFetchAsText(url);
          if (text) {
            combinedText += `\n\n[첨부 파일: ${doc.file_name ?? "document"}]\n${text}`;
          } else {
            await sendReply(chatId, `⚠️ 파일 내용을 읽지 못했음`);
          }
        } else {
          await sendReply(chatId, `⚠️ 파일 다운로드 실패`);
        }
      } else {
        await sendReply(
          chatId,
          `⚠️ 지원하지 않는 파일 형식: <code>${doc.mime_type ?? "unknown"}</code>. HTML/TXT/MD/XML/CSV만 파싱 가능.`,
        );
      }
    }

    // ============================================================
    // 이미지 처리 (GPT-4o-mini Vision)
    // ============================================================
    if (hasPhoto && msg.photo && msg.photo.length > 0) {
      const biggest = msg.photo[msg.photo.length - 1];
      await sendReply(chatId, `🖼️ 이미지 해석 중 (Vision API)...`);
      const fileUrl = await tgGetFileUrl(biggest.file_id);
      if (fileUrl) {
        const dataUrl = await tgFetchAsBase64DataUrl(fileUrl);
        if (dataUrl) {
          try {
            const extracted = await extractTextFromImage(dataUrl);
            if (extracted.trim()) {
              combinedText += `\n\n[이미지에서 추출된 텍스트]\n${extracted}`;
            } else {
              await sendReply(chatId, `⚠️ 이미지에서 이벤트를 찾지 못함`);
            }
          } catch (e) {
            console.warn("[telegram] vision failed", e);
            await sendReply(chatId, `⚠️ Vision API 오류`);
          }
        } else {
          await sendReply(chatId, `⚠️ 이미지 다운로드 실패`);
        }
      }
    }

    await sendReply(chatId, "⏳ GPT로 해석 중...");

    // 1) 최근 60일 ~ 향후 120일 기존 이벤트를 컨텍스트로 GPT에 제공
    const existingEvents = await fetchRecentEventsForContext();
    const result = await parseMessageToEvents(combinedText, todayISO(), existingEvents);

    if (result.events.length === 0 && result.linkedEvents.length === 0) {
      await sendReply(
        chatId,
        "⚠️ 등록할 수 있는 이벤트를 찾지 못했어.\n날짜가 명확한지 확인해줘 (예: 2026-09-17, 다음 주 화, 이번주 금요일 등).",
      );
      return new Response("no events", { status: 200 });
    }

    if (!supabaseAdmin) {
      await sendReply(chatId, "❌ DB 관리자 클라이언트 미설정 (SUPABASE_SERVICE_ROLE_KEY 확인)");
      return new Response("no supabase admin", { status: 200 });
    }

    // 2) 규칙 기반 안전망: GPT가 놓친 중복을 추가 감지
    // (같은 날짜 + 같은 회사 + 같은 type + 제목 유사도 0.7+)
    const linkedFromRule: LinkedEvent[] = [];
    const trulyNewEvents: typeof result.events = [];
    for (const e of result.events) {
      const dup = existingEvents.find(
        (x) =>
          x.date === e.date &&
          x.type === e.type &&
          normalizeForCompare(x.companyName) === normalizeForCompare(e.companyName) &&
          titleSimilarity(x.title, e.title) >= 0.7,
      );
      if (dup) {
        linkedFromRule.push({
          existingId: dup.id,
          reason: `규칙 기반 중복 감지 (같은 날/회사/유형/유사 제목: ${e.title})`,
        });
      } else {
        trulyNewEvents.push(e);
      }
    }

    // 3) 신규 이벤트 INSERT (date/time/label 필드 sanitize)
    const newRows = trulyNewEvents
      .map((e) => {
        const date = cleanDate(e.date);
        if (!date) return null;
        return {
          id: genId(),
          date,
          date_end: cleanDate(e.dateEnd),
          date_label: cleanText(e.dateLabel),
          time: cleanTime(e.time),
          ticker: e.ticker?.trim() || "-",
          company_name: e.companyName,
          market: e.market ?? "NONE",
          type: e.type,
          title: e.title,
          summary: e.summary,
          is_important: e.isImportant ?? false,
          source: "telegram",
          raw_message_id: msg.message_id.toString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (newRows.length > 0) {
      const { error } = await supabaseAdmin.from("events").insert(newRows);
      if (error) {
        console.error("[telegram] insert error", error);
        await sendReply(chatId, `❌ DB 저장 실패: ${error.message}`);
        return new Response("insert failed", { status: 200 });
      }
    }

    // 4) 연결(link) 이벤트 처리: 기존 이벤트에 기사 첨부 + 필드 업데이트
    const allLinked = [...result.linkedEvents, ...linkedFromRule];
    const linkedInfo: Array<{ id: string; title: string; date: string; note?: string }> = [];
    for (const link of allLinked) {
      // 업데이트할 필드 준비 (date/text sanitize)
      const updates: Record<string, unknown> = {};
      const upDateEnd = cleanDate(link.updateDateEnd);
      if (upDateEnd) updates.date_end = upDateEnd;
      const upLabel = cleanText(link.updateDateLabel);
      if (upLabel) updates.date_label = upLabel;
      const upSummary = cleanText(link.updateSummary);
      if (upSummary) updates.summary = upSummary;
      if (typeof link.updateIsImportant === "boolean")
        updates.is_important = link.updateIsImportant;
      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabaseAdmin
          .from("events")
          .update(updates)
          .eq("id", link.existingId);
        if (updErr) console.warn("[telegram] link update failed", link.existingId, updErr);
      }
      // 표시용 정보 조회
      const existing = existingEvents.find((x) => x.id === link.existingId);
      if (existing) {
        linkedInfo.push({
          id: existing.id,
          title: existing.title,
          date: existing.date,
          note: link.reason,
        });
      }
    }

    // 5) 기사 첨부: 신규 이벤트 + 연결된 기존 이벤트 모두에 추가
    if (fetchedArticles.length > 0) {
      const targetIds = [
        ...newRows.map((r) => r.id),
        ...allLinked.map((l) => l.existingId),
      ];
      const today = todayISO();
      const articleRows = targetIds.flatMap((eventId) =>
        fetchedArticles.map((art) => ({
          event_id: eventId,
          title: art.title,
          source: art.source,
          url: art.url,
          published_at: today,
        })),
      );
      if (articleRows.length > 0) {
        const { error: artErr } = await supabaseAdmin
          .from("event_articles")
          .insert(articleRows);
        if (artErr) {
          console.warn("[telegram] event_articles insert failed", artErr);
        }
      }
    }

    // 6) 사용자에게 결과 통보
    const parts: string[] = [];
    if (newRows.length > 0) {
      const newSummary = trulyNewEvents
        .map(
          (e) =>
            `• ${e.date}${e.time ? ` ${e.time}` : ""} · <b>${e.title}</b> (${e.companyName})`,
        )
        .join("\n");
      parts.push(`✅ ${newRows.length}개 이벤트 <b>신규</b> 등록\n${newSummary}`);
    }
    if (linkedInfo.length > 0) {
      const linkSummary = linkedInfo
        .map(
          (l) =>
            `• ${l.date} · <b>${l.title}</b>` +
            (fetchedArticles.length > 0 ? " (기사 추가)" : " (정보 병합)"),
        )
        .join("\n");
      parts.push(`🔗 ${linkedInfo.length}개 기존 이벤트에 <b>연결</b>\n${linkSummary}`);
    }
    if (parts.length === 0) {
      parts.push("⚠️ 처리된 이벤트가 없음.");
    }
    parts.push("➡️ https://jucalch.vercel.app/calendar");
    await sendReply(chatId, parts.join("\n\n"));

    return new Response("ok", { status: 200 });
  } catch (err) {
    const stack = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error("[telegram] handler error", stack);
    const short = stack.slice(0, 1200);
    await sendReply(chatId, `<pre>${short.replace(/</g, "&lt;")}</pre>`);
    // 200으로 리턴해서 Telegram 재시도 방지
    return new Response("error handled", { status: 200 });
  }
}
