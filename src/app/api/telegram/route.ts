import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseMessageToEvents } from "@/lib/gptParser";

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

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
    entities?: TelegramEntity[];
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

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
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
  if (!msg || !msg.text) {
    return new Response("no text", { status: 200 });
  }

  const userId = msg.from?.id?.toString() ?? "";
  if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId)) {
    console.warn("[telegram] blocked user", userId);
    return new Response("forbidden user", { status: 200 });
  }

  const chatId = msg.chat.id;

  try {
    if (supabaseAdmin) {
      await supabaseAdmin.from("raw_messages").insert({
        source: "telegram",
        external_id: msg.message_id.toString(),
        user_id: userId,
        text: msg.text,
        metadata: { chat_id: chatId, date: msg.date, entities: msg.entities ?? null },
      });
    }

    let combinedText = msg.text;
    const urls = extractUrls(msg.text, msg.entities);
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

    await sendReply(chatId, "⏳ GPT로 해석 중...");

    const result = await parseMessageToEvents(combinedText, todayISO());

    if (result.events.length === 0) {
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

    const rows = result.events.map((e) => ({
      id: genId(),
      date: e.date,
      time: e.time ?? null,
      ticker: e.ticker || "-",
      company_name: e.companyName,
      market: e.market ?? "NONE",
      type: e.type,
      title: e.title,
      summary: e.summary,
      is_important: e.isImportant ?? false,
      source: "telegram",
      raw_message_id: msg.message_id.toString(),
    }));

    const { error } = await supabaseAdmin.from("events").insert(rows);
    if (error) {
      console.error("[telegram] insert error", error);
      await sendReply(chatId, `❌ DB 저장 실패: ${error.message}`);
      return new Response("insert failed", { status: 200 });
    }

    // 관련 기사 링크가 있으면 event_articles에 저장 (이 메시지로 만든 모든 이벤트에 연결)
    if (fetchedArticles.length > 0) {
      const articleRows: Array<{
        event_id: string;
        title: string;
        source: string;
        url: string;
      }> = [];
      const today = todayISO();
      for (const ev of rows) {
        for (const art of fetchedArticles) {
          articleRows.push({
            event_id: ev.id,
            title: art.title,
            source: art.source,
            url: art.url,
          });
        }
      }
      const { error: artErr } = await supabaseAdmin
        .from("event_articles")
        .insert(articleRows.map((r) => ({ ...r, published_at: today })));
      if (artErr) {
        console.warn("[telegram] event_articles insert failed", artErr);
      }
    }

    const summary = result.events
      .map(
        (e) =>
          `• ${e.date}${e.time ? ` ${e.time}` : ""} · <b>${e.title}</b> (${e.companyName})`,
      )
      .join("\n");
    await sendReply(
      chatId,
      `✅ ${result.events.length}개 이벤트 등록 완료\n\n${summary}\n\n➡️ https://jucalch.vercel.app/calendar`,
    );

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
