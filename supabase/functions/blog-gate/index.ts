// blog-gate: the doorman for erikortega.com/blog.
// Visitors get one riddle about Erik and one random riddle. Both right → a 7-day pass.
// One wrong answer locks that device for 24 h; one IP gets a limited number of tries per day.
// Answers are checked here, never in the page. Deployed with verify_jwt = false (public).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const PASS_DAYS = 7;
const LOCK_HOURS = 24;
const IP_TRIES_PER_DAY = 8;      // a whole household shares one IP
const PHOTO_URL_SECONDS = 3600;

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const enc = new TextEncoder();
async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}
const ipOf = (req: Request) =>
  (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
const since = (hours: number) => new Date(Date.now() - hours * 3600e3).toISOString();

// "La Pera!" → "pera"; "the  Moon." → "moon"; accents and punctuation ignored.
const ARTICLES = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "the", "a", "an"]);
function norm(s: string) {
  const words = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/).filter(Boolean);
  while (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  return words.join(" ");
}
function matches(given: string, answers: string[]) {
  const g = norm(given);
  if (!g) return false;
  return answers.some((a) => {
    const n = norm(a);
    return n === g || n.replace(/e?s$/, "") === g.replace(/e?s$/, "");
  });
}

const validDevice = (d: unknown) => typeof d === "string" && /^[A-Za-z0-9-]{16,64}$/.test(d);

async function lockStatus(device: string, ipHash: string) {
  const dev = await sb.from("blog_gate_challenges").select("answered_at").eq("device", device)
    .eq("ok", false).gte("answered_at", since(LOCK_HOURS)).order("answered_at", { ascending: false }).limit(1);
  if (dev.data && dev.data.length) {
    return { locked: true, until: new Date(new Date(dev.data[0].answered_at).getTime() + LOCK_HOURS * 3600e3).toISOString() };
  }
  const ip = await sb.from("blog_gate_challenges").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).gte("created_at", since(24)).or("ok.is.null,ok.eq.false");
  if ((ip.count || 0) >= IP_TRIES_PER_DAY) return { locked: true, until: null };
  return { locked: false, until: null };
}

async function riddlesById(ids: number[]) {
  const { data } = await sb.from("blog_riddles").select("id,bank,q_es,q_en,answers").in("id", ids);
  const byId = new Map((data || []).map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as { id: number; bank: string; q_es: string; q_en: string; answers: string[] }[];
}

async function challenge(device: string, ipHash: string) {
  const lock = await lockStatus(device, ipHash);
  if (lock.locked) return json({ locked: true, until: lock.until });

  // Same device, unanswered challenge from the last day → same riddles (no shopping for easy ones by reloading).
  const open = await sb.from("blog_gate_challenges").select("id,riddle_ids").eq("device", device)
    .is("answered_at", null).gte("created_at", since(LOCK_HOURS)).order("created_at", { ascending: false }).limit(1);
  let row = open.data && open.data[0];

  if (!row) {
    const { data: pool } = await sb.from("blog_riddles").select("id,bank").eq("active", true);
    const pick = (bank: string) => {
      const p = (pool || []).filter((r) => r.bank === bank);
      return p.length ? p[crypto.getRandomValues(new Uint32Array(1))[0] % p.length].id : null;
    };
    const ids = [pick("me"), pick("random")].filter((x): x is number => x !== null);
    if (!ids.length) return json({ error: "no_riddles" }, 503);
    const ins = await sb.from("blog_gate_challenges").insert({ riddle_ids: ids, device, ip_hash: ipHash })
      .select("id,riddle_ids").single();
    if (ins.error) return json({ error: "server" }, 500);
    row = ins.data;
  }
  const rs = await riddlesById(row.riddle_ids);
  return json({ challenge: row.id, riddles: rs.map((r) => ({ es: r.q_es, en: r.q_en })) });
}

async function answer(device: string, ipHash: string, id: string, answers: string[]) {
  const { data: c } = await sb.from("blog_gate_challenges").select("*").eq("id", id).maybeSingle();
  if (!c || c.device !== device) return json({ error: "bad_challenge" }, 400);
  if (c.answered_at) return json({ error: "already_answered" }, 409);

  const rs = await riddlesById(c.riddle_ids);
  const ok = rs.length > 0 && rs.every((r, i) => matches((answers || [])[i], r.answers));
  // Mark answered only if still unanswered (one shot, even with two tabs racing).
  const upd = await sb.from("blog_gate_challenges").update({ answered_at: new Date().toISOString(), ok })
    .eq("id", id).is("answered_at", null).select("id");
  if (!upd.data || !upd.data.length) return json({ error: "already_answered" }, 409);

  if (!ok) return json({ ok: false, until: new Date(Date.now() + LOCK_HOURS * 3600e3).toISOString() });

  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const expires = new Date(Date.now() + PASS_DAYS * 86400e3).toISOString();
  await sb.from("blog_gate_sessions").insert({ token_hash: await sha256(token), device, expires_at: expires });
  return json({ ok: true, token, expires });
}

async function entries(token: string) {
  if (typeof token !== "string" || token.length < 20) return json({ error: "no_pass" }, 401);
  const { data: s } = await sb.from("blog_gate_sessions").select("expires_at")
    .eq("token_hash", await sha256(token)).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) return json({ error: "no_pass" }, 401);

  const { data } = await sb.from("blog_entries").select("id,date,lang,moment,title,alt,photo_path,paragraphs,en,es")
    .order("date", { ascending: false });
  const out = await Promise.all((data || []).map(async (e) => {
    let photo = null;
    if (e.photo_path) {
      const u = await sb.storage.from("blog").createSignedUrl(e.photo_path, PHOTO_URL_SECONDS);
      if (u.data) photo = { src: u.data.signedUrl };
    }
    const { photo_path: _p, ...rest } = e;
    return { ...rest, photo };
  }));
  return json({ entries: out, expires: s.expires_at });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  try {
    if (body.action === "entries") return await entries(body.token as string);
    if (!validDevice(body.device)) return json({ error: "bad_device" }, 400);
    const ipHash = await sha256("blog-gate:" + ipOf(req) + ":" + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    if (body.action === "challenge") return await challenge(body.device as string, ipHash);
    if (body.action === "answer") return await answer(body.device as string, ipHash, String(body.challenge), body.answers as string[]);
    return json({ error: "action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});
