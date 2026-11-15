// Anonymous visitor log: builds a short summary of each visit and sends it to
// the Netlify function (netlify/functions/visit.mjs) when the tab is hidden or closed.
//   ?notrack  -> never log this device (saved in localStorage)
//   ?track    -> turn logging back on for this device
// Disabled on localhost / file:// so local previews never send anything.

const ENDPOINT = "/.netlify/functions/visit";

function store(kind) {
  try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch { return null; }
}
function get(kind, key) { try { return store(kind)?.getItem(key) ?? null; } catch { return null; } }
function set(kind, key, val) { try { store(kind)?.setItem(key, val); } catch {} }
function del(kind, key) { try { store(kind)?.removeItem(key); } catch {} }

function randomId(prefix) {
  const bytes = new Uint8Array(6);
  (window.crypto || {}).getRandomValues?.(bytes);
  return prefix + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

function currentPath() {
  return (window.location.pathname.replace(/\/+$/, "") || "/");
}

function isPostPath(p) {
  return /^\/[^/]+\/[^/]+$/.test(p);
}

export function startVisitorLog() {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  if (window.location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "") return;

  // Opt-out / opt-in switches
  const params = new URLSearchParams(window.location.search);
  if (params.has("notrack")) set("local", "vl_notrack", "1");
  if (params.has("track")) del("local", "vl_notrack");
  if (get("local", "vl_notrack") === "1") return;

  // Visitor (permanent, per browser) — random and anonymous
  let visitorId = get("local", "vl_vid");
  const isNewVisitor = !visitorId;
  if (!visitorId) {
    visitorId = randomId("v");
    set("local", "vl_vid", visitorId);
    set("local", "vl_first", new Date().toISOString());
    set("local", "vl_count", "0");
  }

  // Session (one visit = one tab session). Survives reloads, ends when the tab closes.
  let s = null;
  try { s = JSON.parse(get("session", "vl_session") || "null"); } catch {}
  if (!s || !s.sessionId) {
    const visitCount = (parseInt(get("local", "vl_count") || "0", 10) || 0) + 1;
    set("local", "vl_count", String(visitCount));
    const ref = document.referrer;
    let referrer = "";
    try { if (ref && new URL(ref).hostname !== host) referrer = ref; } catch {}
    s = {
      sessionId: randomId("s"),
      visitorId,
      visitCount,
      returning: !isNewVisitor && visitCount > 1,
      firstSeen: get("local", "vl_first") || "",
      startedAt: new Date().toISOString(),
      landingPage: currentPath(),
      referrer,
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      pages: [],          // paths in the order first viewed
      scroll: {},         // path -> max scroll %
      contacts: [],       // e.g. "LinkedIn", "Email (copied)"
      downloads: [],      // file names
      activeMs: 0,
      seq: 0,
    };
  }
  s.visitorId = visitorId;

  const save = () => set("session", "vl_session", JSON.stringify(s));
  const addUnique = (list, v) => { if (v && !list.includes(v)) list.push(v); };

  // ── Pages viewed (SPA navigation) ──
  function recordPage() {
    addUnique(s.pages, currentPath());
    recordScroll();
    save();
  }
  const origPush = history.pushState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args);
    setTimeout(recordPage, 0);
    return r;
  };
  window.addEventListener("popstate", () => setTimeout(recordPage, 0));

  // ── Scroll depth per page ──
  function recordScroll() {
    const el = document.documentElement;
    const total = el.scrollHeight - el.clientHeight;
    const pct = total > 0 ? Math.min(100, Math.round((window.scrollY / total) * 100)) : 100;
    const p = currentPath();
    if (!(p in s.scroll) || pct > s.scroll[p]) s.scroll[p] = pct;
  }
  let scrollTimer = null;
  window.addEventListener("scroll", () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => { scrollTimer = null; s.scrolled = true; recordScroll(); save(); }, 500);
  }, { passive: true });

  // ── Clicks: contacts and downloads ──
  document.addEventListener("click", e => {
    const el = e.target.closest?.("a, button");
    if (!el) return;
    const href = el.getAttribute("href") || "";
    const label = el.getAttribute("aria-label") || "";
    if (el.tagName === "A") {
      if (/^mailto:/i.test(href)) addUnique(s.contacts, "Email");
      else if (/^tel:/i.test(href)) addUnique(s.contacts, "Phone");
      else if (/linkedin\.com/i.test(href)) addUnique(s.contacts, "LinkedIn");
      else if (/github\.com/i.test(href)) addUnique(s.contacts, "GitHub");
      if (/\.pdf(\?|#|$)/i.test(href)) addUnique(s.downloads, decodeURIComponent(href.split("/").pop().split(/[?#]/)[0]));
    } else if (el.classList.contains("social-link") && label) {
      addUnique(s.contacts, `${label} (copied)`);
    }
    save();
  }, true);

  // ── Active time: only while the tab is visible ──
  let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  function flushTime() {
    if (visibleSince != null) { s.activeMs += Date.now() - visibleSince; visibleSince = null; }
  }

  // ── Sending ──
  let lastSent = "";
  function send() {
    flushTime();
    recordScroll();
    if (s.activeMs < 2000 && !s.scrolled &&!s.contacts.length && !s.downloads.length) { save(); return; }

    const posts = s.pages.filter(isPostPath).map(p => `${p} (${s.scroll[p] ?? 0}%)`);
    const body = {
      sessionId: s.sessionId,
      visitorId: s.visitorId,
      visitCount: s.visitCount,
      returning: s.returning,
      firstSeen: s.firstSeen,
      startedAt: s.startedAt,
      landingPage: s.landingPage,
      referrer: s.referrer,
      utmSource: s.utmSource,
      utmMedium: s.utmMedium,
      utmCampaign: s.utmCampaign,
      pagesViewed: s.pages,
      postsOpened: posts,
      contactClicks: s.contacts,
      downloads: s.downloads,
      activeSeconds: Math.round(s.activeMs / 1000),
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      language: navigator.language || "",
      timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })(),
    };
    const key = JSON.stringify({ ...body, activeSeconds: Math.floor(body.activeSeconds / 5) });
    if (key === lastSent) { save(); return; }
    lastSent = key;
    s.seq += 1;
    body.seq = s.seq;
    save();

    const payload = JSON.stringify(body);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "text/plain" }))) return;
    } catch {}
    try { fetch(ENDPOINT, { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "text/plain" } }); } catch {}
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
    else visibleSince = Date.now();
  });
  window.addEventListener("pagehide", send);

  recordPage();
}
