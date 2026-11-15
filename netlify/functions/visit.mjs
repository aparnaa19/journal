// Visitor log middleman. Receives the browser's visit beacon, adds location,
// device, network and source info, drops bots, and forwards the visit to the
// Google Apps Script web app with the shared secret.
//
// Netlify environment variables (Site configuration -> Environment variables):
//   VISIT_SHEET_URL     the Apps Script web app URL ending in /exec
//   VISIT_SHEET_SECRET  the same long random secret set in the Apps Script
//
// The visitor's IP address is used only for the location / network lookup and
// is never forwarded or stored.

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|slack|vkshare|pinterest|bitly|uptime|monitor|pingdom|statuscake|headless|phantom|lighthouse|curl|wget|python-requests|axios|node-fetch|go-http-client|java\//i;

// Hosting / cloud providers. Real visitors browse from ISPs, mobile carriers,
// companies and universities, not from these. (Google LLC and Microsoft are left
// out on purpose: their staff browse from those networks too.)
const DATACENTER = /amazon technologies|amazon data services|amazon\.com services|\baws\b|digitalocean|linode|akamai connected cloud|\bovh|hetzner|vultr|choopa|the constant company|contabo|leaseweb|scaleway|online s\.a\.s|alibaba|aliyun|tencent cloud|m247|datacamp|hostinger|ionos|godaddy|hostroyale|colocrossing|psychz|quadranet|servers\.com|oracle cloud|google cloud/i;

const SOURCES = [
  [/linkedin\.com|lnkd\.in/, "LinkedIn", true],
  [/indeed\./, "Indeed", true],
  [/glassdoor\./, "Glassdoor", true],
  [/joinhandshake\.com|handshake/, "Handshake", true],
  [/wellfound\.com|angel\.co/, "Wellfound", true],
  [/ziprecruiter\./, "ZipRecruiter", true],
  [/dice\.com/, "Dice", true],
  [/lever\.co/, "Lever", true],
  [/greenhouse\.io/, "Greenhouse", true],
  [/myworkdayjobs\.com|workday\./, "Workday", true],
  [/mail\.google\.com|outlook\./, "Email", false],
  [/(^|\.)google\./, "Google", false],
  [/bing\.com/, "Bing", false],
  [/duckduckgo\.com/, "DuckDuckGo", false],
  [/yahoo\./, "Yahoo", false],
  [/github\.com/, "GitHub", false],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X / Twitter", false],
  [/(^|\.)(facebook\.com|fb\.com)$/, "Facebook", false],
  [/instagram\.com/, "Instagram", false],
  [/reddit\.com/, "Reddit", false],
  [/medium\.com/, "Medium", false],
  [/youtube\.com/, "YouTube", false],
  [/teams\.microsoft\.com|teams\.live\.com/, "Microsoft Teams", false],
  [/chatgpt\.com|openai\.com/, "ChatGPT", false],
  [/claude\.ai/, "Claude", false],
];

function sourceLabel(referrer, utmSource) {
  const probe = (utmSource || "").toLowerCase();
  let host = "";
  try { host = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : ""; } catch {}
  for (const [re, label, recruiting] of SOURCES) {
    if ((probe && re.test(probe)) || (probe && probe === label.toLowerCase()) || (host && re.test(host))) {
      return { source: label, recruiting };
    }
  }
  if (utmSource) return { source: utmSource, recruiting: false };
  if (host) return { source: host, recruiting: false };
  return { source: "Direct", recruiting: false };
}

function deviceLabel(ua) {
  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /CrOS/.test(ua) ? "ChromeOS" :
    /Linux/.test(ua) ? "Linux" : "Other";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /SamsungBrowser/.test(ua) ? "Samsung Internet" :
    /Firefox\/|FxiOS/.test(ua) ? "Firefox" :
    /Chrome\/|CriOS/.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : "Other";
  const mobile = /Mobi|iPhone|Android(?!.*Tablet)/.test(ua) ? " (mobile)" : "";
  return `${os} - ${browser}${mobile}`;
}

async function networkName(ip) {
  if (!ip) return "";
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,connection`, {
      signal: AbortSignal.timeout(2000),
    });
    const data = await res.json();
    if (!data.success) return "";
    return data.connection?.org || data.connection?.isp || "";
  } catch {
    return "";
  }
}

function clip(v, max = 500) {
  if (Array.isArray(v)) return v.slice(0, 50).map(x => clip(String(x), 200));
  if (typeof v === "string") return v.slice(0, max);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v;
  return "";
}

const empty = () => new Response(null, { status: 204 });

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Only accept beacons sent from this site
  const siteHost = new URL(req.url).host;
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  let originHost = "";
  try { originHost = new URL(origin).host; } catch {}
  if (originHost !== siteHost) return new Response("Forbidden", { status: 403 });

  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT_UA.test(ua)) return empty();

  const sheetUrl = process.env.VISIT_SHEET_URL;
  const secret = process.env.VISIT_SHEET_SECRET;
  if (!sheetUrl || !secret) return empty();

  const raw = await req.text();
  if (raw.length > 20000) return new Response("Too large", { status: 413 });
  let v;
  try { v = JSON.parse(raw); } catch { return new Response("Bad request", { status: 400 }); }
  if (!v || typeof v.sessionId !== "string" || !/^s[0-9a-f]{4,20}$/.test(v.sessionId)) {
    return new Response("Bad request", { status: 400 });
  }

  const visit = {};
  for (const [k, val] of Object.entries(v)) visit[k] = clip(val);

  const geo = context.geo || {};
  const { source, recruiting } = sourceLabel(visit.referrer, visit.utmSource);
  const network = await networkName(context.ip);
  // Cloud / hosting networks = automated scanners and preview bots, not people.
  if (network && DATACENTER.test(network)) return empty();

  const record = {
    ...visit,
    source,
    recruiting,
    city: geo.city || "",
    region: geo.subdivision?.name || "",
    country: geo.country?.name || "",
    network,
    device: deviceLabel(ua),
  };

  try {
    await fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, visit: record }),
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Logging must never break the site; ignore failures.
  }
  return empty();
};
