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
  if (!msg || !msg.text) {
    return new Response("no text", { status: 200 });
  }

  const userId = msg.from?.id?.toString() ?? "";
  if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId)) {
    console.warn("[telegram] blocked user", userId);
    return new Response("forbidden user", { status: 200 });
  }

  const chatId = msg.chat.id;
  const trimmed = msg.text.trim();

  // ============================================================
  // 명령어 처리
  // ============================================================
  if (trimmed.startsWith("/")) {
    return handleCommand(trimmed, chatId);
  }

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
      date_end: e.dateEnd ?? null,
      date_label: e.dateLabel ?? null,
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
