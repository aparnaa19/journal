import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import "./styles.css";

const allFiles = import.meta.glob("../content/**/*.md", { query: "?raw", import: "default", eager: true });

const CATEGORY_META = {
  "homelab":                   { label: "Homelab",                            navLabel: "Homelab",                  prefix: "HL",  navOrder: 1, color: "var(--accent)", bg: "var(--accent-light)", desc: "SIEM configuration, DNS forensics, network monitoring, and multi-host SOC environments." },
  "endpoint":                  { label: "Endpoint Security",                  navLabel: "Endpoint Security",        prefix: "EP",  navOrder: 2, color: "var(--accent)", bg: "var(--accent-light)", desc: "Threat hunting, behavioral analysis, and endpoint forensics using Windows Event Logs and Splunk." },
  "network-security":          { label: "Network Security",                   navLabel: "Network Security",         prefix: "NS",  navOrder: 3, color: "var(--accent)", bg: "var(--accent-light)", desc: "Packet analysis, network forensics, traffic monitoring, and protocol-level threat detection." },
  "siem":                      { label: "SIEM",                               navLabel: "SIEM",                     prefix: "SI",  navOrder: 4, color: "var(--accent)", bg: "var(--accent-light)", desc: "Cloud misconfiguration analysis, IAM policy review, and cloud-native threat detection." },
  "vulnerability-management":  { label: "Vulnerability Management",           navLabel: "Vulnerability Management", prefix: "VM",  navOrder: 5, color: "var(--accent)", bg: "var(--accent-light)", desc: "Memory forensics, disk imaging, timeline analysis, and end-to-end incident response." },
  "threat-intelligence":       { label: "Threat Intelligence",                navLabel: "Threat Intelligence",      prefix: "TI",  navOrder: 6, color: "var(--accent)", bg: "var(--accent-light)", desc: "CVE analysis, adversary profiling, MITRE ATT&CK mapping, and vulnerability research." },
  "incident-response":         { label: "Incident Response",                  navLabel: "Incident Response",        prefix: "IR",  navOrder: 7, color: "var(--accent)", bg: "var(--accent-light)", desc: "Building SIEM detection rules, tuning alerts, and reducing false positives in real environments." },
  "identity-account":          { label: "Identity & Access Management",       navLabel: "Identity & Access",        prefix: "IA",  navOrder: 8, color: "var(--accent)", bg: "var(--accent-light)", desc: "Identity threats, privilege escalation, account persistence, and access control analysis." },
};

function fileSlug(path) { return path.split("/").pop().replace(".md", ""); }
function fileCategorySlug(path) { const p = path.split("/"); return p[p.length - 2]; }

function parseEntry(content, path, caseNumber) {
  const slug = fileSlug(path);
  const categorySlug = fileCategorySlug(path);
  const lines = content.split("\n");

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : slug;

  let skills = [], tools = [], date = "", type = "", displayTitle = "";
  for (const line of lines.slice(0, 15)) {
    const sm = line.match(/^skills:\s*(.+)$/i);
    if (sm) skills = sm[1].split(",").map(s => s.trim()).filter(Boolean);
    const tm = line.match(/^tools:\s*(.+)$/i);
    if (tm) tools = tm[1].split(",").map(s => s.trim()).filter(Boolean);
    const dm = line.match(/^date:\s*(.+)$/i);
    if (dm) date = dm[1].trim();
    const dtm = line.match(/^display_title:\s*(.+)$/i);
    if (dtm) displayTitle = dtm[1].trim();
    const typem = line.match(/^\*\*(LAB|WRITEUP|CVE REPORT)\*\*$/);
    if (typem) type = typem[1];
  }

  // Strip frontmatter lines and type markers from rendered content
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let cleanContent = content
    .replace(/^\*\*(LAB|WRITEUP|CVE REPORT)\*\*\s*$/gim, "")
    .replace(/^(skills|tools|date|display_title):\s*.*$/gim, "")
    .replace(new RegExp(`^#\\s+${escapedTitle}\\s*$`, "m"), "")
    .replace(new RegExp(`^__${escapedTitle}__\\s*$`, "m"), "")
    .replace(new RegExp(`^\\*\\*${escapedTitle}\\*\\*\\s*$`, "m"), "");

  // Fallback: extract displayTitle from the first bold paragraph in HTML content
  // (for files converted before display_title: was added to the frontmatter)
  if (!displayTitle) {
    const boldMatch = cleanContent.match(/<p[^>]*><strong>([\s\S]*?)<\/strong>/);
    if (boldMatch) {
      const candidate = boldMatch[1].replace(/<[^>]+>/g, "").trim();
      const looksLikeTitle = candidate.length > 8 &&
        !/^\d+[\.\)]/.test(candidate) &&
        !/^(Severity|Status|MITRE|Date|Author|Category|Alert|Type|Priority):/i.test(candidate);
      if (looksLikeTitle) displayTitle = candidate;
    }
  }
  // Strip the doc title paragraph from content (it's now shown as the explicit heading)
  if (displayTitle) {
    cleanContent = cleanContent.replace(/<p[^>]*><strong>[\s\S]*?<\/strong>[^<]*<\/p>\s*/, "");
  }

  let summary = "";
  let pastTitle = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("# ")) { pastTitle = true; continue; }
    if (!pastTitle || !t) continue;
    if (t.startsWith("#") || t.startsWith("|") || t.startsWith("-") || t.startsWith("*") || t.startsWith("!") || t.startsWith("`") || t === "---" || t.startsWith("**") || t.startsWith("<")) continue;
    if (/^(skills|tools|date):/i.test(t)) continue;
    const clean = t.replace(/<[^>]+>/g, "").trim();
    if (clean.length < 15) continue;
    summary = clean.length > 180 ? clean.slice(0, 180) + "…" : clean;
    break;
  }

  const wordCount = content.split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 220));

  return { title, displayTitle, summary, date, type, skills, tools, content: cleanContent, slug, categorySlug, caseNumber, readTime, link: `/${categorySlug}/${slug}` };
}

const entriesByCategory = {};
for (const [path, content] of Object.entries(allFiles)) {
  const cat = fileCategorySlug(path);
  if (!entriesByCategory[cat]) entriesByCategory[cat] = [];
  entriesByCategory[cat].push({ path, content });
}
for (const [cat, files] of Object.entries(entriesByCategory)) {
  const meta = CATEGORY_META[cat] || { prefix: cat.slice(0, 3).toUpperCase() };
  entriesByCategory[cat] = files.map(({ path, content }, i) =>
    parseEntry(content, path, `${meta.prefix}-${String(i + 1).padStart(3, "0")}`)
  );
}

// All defined categories in nav order (even empty ones)
const sortedCategorySlugs = Object.keys(CATEGORY_META).sort((a, b) =>
  CATEGORY_META[a].navOrder - CATEGORY_META[b].navOrder
);

// ── Routing ──────────────────────────────────────────────

function normalizePath(p) { return p.replace(/\/+$/, "") || "/"; }
const basePath = normalizePath(import.meta.env.BASE_URL);

function routePath(pathname) {
  const p = normalizePath(pathname);
  if (basePath === "/") return p;
  if (p === basePath) return "/";
  if (p.startsWith(`${basePath}/`)) return normalizePath(p.slice(basePath.length));
  return p;
}

function browserPath(p) {
  if (basePath === "/") return p;
  return p === "/" ? `${basePath}/` : `${basePath}${p}`;
}

function routeFromPath(pathname) {
  const p = routePath(pathname);
  if (p === "/") return { view: "overview", categorySlug: null, entry: null };
  const em = p.match(/^\/([^/]+)\/([^/]+)$/);
  if (em) {
    const [, catSlug, entrySlug] = em;
    const entry = (entriesByCategory[catSlug] || []).find(e => e.slug === entrySlug);
    if (entry) return { view: "entry", categorySlug: catSlug, entry };
  }
  const cm = p.match(/^\/([^/]+)$/);
  if (cm && entriesByCategory[cm[1]]) return { view: "category", categorySlug: cm[1], entry: null };
  return { view: "overview", categorySlug: null, entry: null };
}

function pushPath(p) {
  const next = browserPath(p);
  if (normalizePath(window.location.pathname) !== normalizePath(next)) window.history.pushState({}, "", next);
}

// ── App ──────────────────────────────────────────────────

function App() {
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));
  const [theme, setTheme] = useState("light");
  const [openingEntry, setOpeningEntry] = useState("");

  useEffect(() => {
    const sync = () => { setRoute(routeFromPath(window.location.pathname)); setOpeningEntry(""); };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function navigateTo(path) {
    pushPath(path);
    setRoute(routeFromPath(path));
    setOpeningEntry("");
    window.scrollTo(0, 0);
  }

  function openEntry(entry) {
    setOpeningEntry(entry.slug);
    setTimeout(() => {
      pushPath(entry.link);
      setRoute({ view: "entry", categorySlug: entry.categorySlug, entry });
      setOpeningEntry("");
      window.scrollTo(0, 0);
    }, 300);
  }

  return (
    <div className={`app theme-${theme}`}>
      <TopBar route={route} navigateTo={navigateTo} theme={theme} setTheme={setTheme} />
      <SocialLinks />
      <main className="workspace">
        {route.view === "overview" && <HomePage navigateTo={navigateTo} />}
        {route.view === "category" && (
          <CategoryPage
            categorySlug={route.categorySlug}
            entries={entriesByCategory[route.categorySlug] || []}
            openEntry={openEntry}
            openingEntry={openingEntry}
          />
        )}
        {route.view === "entry" && <EntryPage entry={route.entry} navigateTo={navigateTo} key={route.entry.slug} />}
      </main>
    </div>
  );
}

// ── Social links ─────────────────────────────────────────

function SocialLinks() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  function handleCopy(value, e) {
    const btnRect = e.currentTarget.getBoundingClientRect();
    const conRect = containerRef.current.getBoundingClientRect();
    const y = btnRect.top + btnRect.height / 2 - conRect.top;
    navigator.clipboard?.writeText(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ value, y });
    timerRef.current = setTimeout(() => setToast(null), 2500);
  }

  const links = [
    {
      type: "link",
      href: "https://github.com/aparnaa19",
      label: "GitHub",
      icon: (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
        </svg>
      ),
    },
    {
      type: "link",
      href: "https://www.linkedin.com/in/aparnaa19/",
      label: "LinkedIn",
      icon: (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
    },
    {
      type: "copy",
      value: "+1 872 899 2174",
      label: "Phone",
      icon: (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.01 2a2 2 0 012-2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
        </svg>
      ),
    },
    {
      type: "copy",
      value: "aparnaa1902@gmail.com",
      label: "Email",
      icon: (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="M22 7l-10 7L2 7"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="social-links" aria-label="Social links" ref={containerRef}>
      {links.map(l => l.type === "link"
        ? (
          <a key={l.label} href={l.href} className="social-link" aria-label={l.label}
            target="_blank" rel="noopener noreferrer">
            {l.icon}
          </a>
        ) : (
          <button key={l.label} className="social-link" aria-label={l.label}
            onClick={e => handleCopy(l.value, e)}>
            {l.icon}
          </button>
        )
      )}
      {toast && (
        <div className="social-copy-banner" style={{ top: `${toast.y}px` }}>
          <span className="social-copy-value">{toast.value}</span>
          <span className="social-copy-tick">✓ copied</span>
        </div>
      )}
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────

function TopBar({ route, navigateTo, theme, setTheme }) {
  const isDark = theme === "dark";
  const { view, categorySlug } = route;
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Entrance: slide in after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  // Auto-hide on scroll down, show on scroll up
  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      setHidden(y > 90 && y > lastY);
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navStyle = {
    transform: `translateX(-50%) translateY(${(!visible || hidden) ? "-140%" : "0"})`,
    opacity: (!visible || hidden) ? 0 : 1,
    pointerEvents: hidden ? "none" : undefined,
  };

  return (
    <header className="topbar" style={navStyle}>
      <nav className="topbar-pill" aria-label="Navigation">
        <button className={view === "overview" ? "active" : ""} onClick={() => navigateTo("/")} type="button">
          Home
        </button>
        {sortedCategorySlugs.map(slug => (
          <button
            key={slug}
            className={categorySlug === slug ? "active" : ""}
            onClick={() => navigateTo(`/${slug}`)}
            type="button"
          >
            {(CATEGORY_META[slug] || {}).navLabel || slug}
          </button>
        ))}
        <button
          aria-label="Toggle color theme"
          aria-pressed={isDark}
          className="theme-toggle"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          type="button"
        >
          <span />
        </button>
      </nav>
    </header>
  );
}

// ── Home page ─────────────────────────────────────────────

// ── Skill Radar ──────────────────────────────────────────
// Values are derived from actual entry counts — grows as you document work.
// Scale: each entry adds ~14 points, capped at 100 (≈7 entries = full axis).

const RS = 380, RCX = 190, RCY = 190, RR = 118, RLEVELS = 5;
const RING_COLORS = [
  "rgba(245,228,235,0.48)", "rgba(236,212,224,0.50)",
  "rgba(225,194,213,0.54)", "rgba(212,174,200,0.57)", "rgba(196,150,185,0.62)",
];

function rAngle(i, n) { return (2 * Math.PI * i / n) - Math.PI / 2; }
function rPt(i, frac, n) {
  const a = rAngle(i, n);
  return [RCX + RR * frac * Math.cos(a), RCY + RR * frac * Math.sin(a)];
}
function rPoly(fracs) {
  return fracs.map((f, i) => rPt(i, f, fracs.length).join(",")).join(" ");
}
function rDataPath(fracs) {
  const N = fracs.length;
  const pts = fracs.map((f, i) => rPt(i, f, N));
  const k = 0.85;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < N; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % N];
    const cx = RCX + ((x1 + x2) / 2 - RCX) * k;
    const cy = RCY + ((y1 + y2) / 2 - RCY) * k;
    d += ` Q ${cx},${cy} ${x2},${y2}`;
  }
  return d + " Z";
}
function rRingPath(f, N) {
  const pts = Array.from({ length: N }, (_, i) => rPt(i, f, N));
  const k = 0.85; // push midpoint inward for spiderweb sag
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < N; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % N];
    const cx = RCX + ((x1 + x2) / 2 - RCX) * k;
    const cy = RCY + ((y1 + y2) / 2 - RCY) * k;
    d += ` Q ${cx},${cy} ${x2},${y2}`;
  }
  return d + " Z";
}

function SkillRadar({ navigateTo }) {
  const [hovered, setHovered] = useState(null);
  const [webProg, setWebProg] = useState(0);
  const [dataProg, setDataProg] = useState(0);

  useEffect(() => {
    let start = null, rafId;
    function step(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      // Web grid draws in over 900ms
      const tw = Math.min(elapsed / 900, 1);
      setWebProg(1 - Math.pow(1 - tw, 3));
      // Data shape fades in after 300ms delay, over 1100ms
      const td = Math.min(Math.max(elapsed - 300, 0) / 1100, 1);
      setDataProg(1 - Math.pow(1 - td, 3));
      if (tw < 1 || td < 1) rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Build axes from real content
  const axes = sortedCategorySlugs.map(slug => {
    const meta = CATEGORY_META[slug];
    const count = (entriesByCategory[slug] || []).length;
    return {
      slug,
      label: meta.navLabel,
      full: meta.label,
      count,
      value: Math.min(100, count * 14),
    };
  });

  const N = axes.length;
  const fracs = axes.map(a => (a.value / 100) * dataProg);
  const totalEntries = axes.reduce((s, a) => s + a.count, 0);

  return (
    <div className="skill-radar-wrap">

      <svg viewBox={`0 0 ${RS} ${RS}`} className="skill-radar-svg"
        aria-label="Skill coverage radar built from your entries"
      >
        <defs>
          <radialGradient id="skillFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(124,29,63,0.52)" />
            <stop offset="100%" stopColor="rgba(124,29,63,0.10)" />
          </radialGradient>
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Web grid scales in from center */}
        <g transform={`translate(${RCX},${RCY}) scale(${webProg}) translate(${-RCX},${-RCY})`}>
          {/* Concentric rings — curved sides for spiderweb look */}
          {Array.from({ length: RLEVELS }, (_, lvl) => (
            <path key={lvl}
              d={rRingPath((lvl + 1) / RLEVELS, N)}
              fill={RING_COLORS[lvl]}
              stroke="rgba(124,29,63,0.18)" strokeWidth="0.8" />
          ))}
          {/* Axis spokes */}
          {axes.map((_, i) => {
            const [x, y] = rPt(i, 1, N);
            return <line key={i} x1={RCX} y1={RCY} x2={x} y2={y}
              stroke={hovered === i ? "rgba(124,29,63,0.50)" : "rgba(124,29,63,0.16)"}
              strokeWidth={hovered === i ? 1.5 : 0.75} />;
          })}
        </g>

        {/* Glow layer */}
        <path d={rDataPath(fracs)} fill="rgba(124,29,63,0.20)"
          filter="url(#radarGlow)" opacity={dataProg} />

        {/* Skill polygon */}
        <path d={rDataPath(fracs)} fill="url(#skillFill)"
          stroke="#7C1D3F" strokeWidth="2" opacity={dataProg} />

        {/* Invisible hit-area per axis for click/hover */}
        {axes.map((ax, i) => {
          const [x, y] = rPt(i, 1, N);
          return (
            <line key={`hit-${i}`} x1={RCX} y1={RCY} x2={x} y2={y}
              stroke="transparent" strokeWidth="20"
              style={{ cursor: ax.count > 0 ? "pointer" : "default" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => ax.count > 0 && navigateTo(`/${ax.slug}`)}
            />
          );
        })}

        {/* Vertex dots (only where there are entries) */}
        {axes.map((ax, i) => {
          if (ax.value === 0) return null;
          const [x, y] = rPt(i, fracs[i], N);
          const hov = hovered === i;
          return (
            <circle key={i} cx={x} cy={y}
              r={hov ? 6.5 : 4.5}
              fill={hov ? "#7C1D3F" : "#A83B5A"} stroke="white"
              strokeWidth={hov ? 2 : 1.6}
              className={hov ? "radar-dot-pulse" : ""}
              style={{ cursor: "pointer", transition: "r 150ms ease, fill 150ms ease" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => navigateTo(`/${ax.slug}`)}
              opacity={dataProg}
            />
          );
        })}

        {/* Labels */}
        {axes.map((ax, i) => {
          const [x, y] = rPt(i, 1.38, N);
          const hov = hovered === i;
          const words = ax.label.split(" ");
          const mid = Math.ceil(words.length / 2);
          const lines = words.length > 1
            ? [words.slice(0, mid).join(" "), words.slice(mid).join(" ")]
            : [ax.label];
          const fs = hov ? "12" : "10.5";
          const fill = hov ? "#7C1D3F" : ax.count > 0 ? "rgba(92,74,82,0.90)" : "rgba(92,74,82,0.38)";
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fontSize={fs} fontWeight="700" fill={fill}
              fontFamily="Inter, sans-serif"
              style={{ userSelect: "none", pointerEvents: "none", transition: "font-size 120ms, fill 120ms" }}
            >
              {lines.length === 1 ? lines[0] : <>
                <tspan x={x} dy="-0.65em">{lines[0]}</tspan>
                <tspan x={x} dy="1.3em">{lines[1]}</tspan>
              </>}
            </text>
          );
        })}
      </svg>

      {/* Hover detail */}
      <div className={`radar-detail${hovered !== null ? " on" : ""}`}>
        {hovered !== null && (() => {
          const ax = axes[hovered];
          return <>
            <span className="radar-detail-name">{ax.full}</span>
            <span className="radar-detail-track">
              <span className="radar-detail-fill" style={{ width: `${ax.value}%` }} />
            </span>
            <span className="radar-detail-pct">
              {ax.count === 0 ? "no entries yet" : `${ax.count} ${ax.count === 1 ? "entry" : "entries"}`}
            </span>
          </>;
        })()}
      </div>

      <p className="radar-total">{totalEntries} {totalEntries === 1 ? "entry" : "entries"} documented</p>
    </div>
  );
}

// ── Knowledge Graph ───────────────────────────────────────

const CAT_GRAPH_COLORS = {
  "homelab":                  "#2BB8AE",
  "endpoint":                 "#5FB6F6",
  "network-security":         "#36CFC9",
  "siem":                     "#8E7CFF",
  "vulnerability-management": "#F59E0B",
  "threat-intelligence":      "#E99A15",
  "incident-response":        "#6BD17B",
  "identity-account":         "#E7D6B6",
};

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const GRAPH_LABEL_ALIASES = [
  [/windows registry forensics/i, "Registry Forensics"],
  [/sysmon event id 13/i, "Sysmon"],
  [/registry run key persistence/i, "Run Key Persistence"],
  [/winlogon shell hijack/i, "Winlogon Hijack"],
  [/evtx log parsing/i, "EVTX Parsing"],
  [/kql threat hunting/i, "KQL Hunting"],
  [/ioc verification/i, "IOC Verification"],
  [/mitre att&ck/i, "MITRE ATT&CK"],
  [/masquerading detection/i, "Masquerading"],
  [/malicious executable path analysis/i, "Path Analysis"],
  [/wazuh/i, "Wazuh"],
  [/elastic.*siem/i, "Elastic SIEM"],
  [/microsoft sentinel/i, "Sentinel"],
  [/windows event logs/i, "Windows Logs"],
  [/privilege escalation/i, "Privilege Escalation"],
  [/failed login/i, "Failed Logins"],
  [/brute force/i, "Brute Force"],
  [/impossible travel/i, "Impossible Travel"],
  [/port scan/i, "Port Scanning"],
  [/packet analysis/i, "Packet Analysis"],
  [/threat hunting/i, "Threat Hunting"],
  [/incident response/i, "Incident Response"],
  [/persistence/i, "Persistence"],
  [/forensics/i, "Forensics"],
  [/powershell/i, "PowerShell"],
  [/python/i, "Python"],
  [/docker/i, "Docker"],
  [/kibana/i, "Kibana"],
  [/elasticsearch/i, "Elasticsearch"],
  [/winlogbeat/i, "Winlogbeat"],
  [/mitre/i, "MITRE ATT&CK"],
  [/dns/i, "DNS"],
];

function graphHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function graphRand(seed, salt = 0) {
  let x = (seed + salt * 374761393) >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return ((x >>> 0) % 10000) / 10000;
}

function graphLabel(raw) {
  const clean = String(raw || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/[:;,.]+$/g, "")
    .trim();
  if (!clean) return "";
  const alias = GRAPH_LABEL_ALIASES.find(([pattern]) => pattern.test(clean));
  if (alias) return alias[1];
  return clean
    .replace(/\b(SIEM|EDR|XDR|IAM|IOC|KQL|CVE|EVTX|DNS|MITRE)\b/gi, m => m.toUpperCase())
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

function graphItemsForEntry(entry) {
  const tools = (entry.tools || []).map(graphLabel).filter(Boolean);
  const skills = (entry.skills || []).map(graphLabel).filter(Boolean);
  return [...new Set([...tools, ...skills])].slice(0, 22);
}

function buildKnowledgeGraph() {
  const nodes = [], edges = [];
  const nodeIdx = {};

  // Tool nodes only — categories are used for color only, not as nodes
  sortedCategorySlugs.forEach(slug => {
    (entriesByCategory[slug] || []).forEach(entry => {
      graphItemsForEntry(entry).forEach(label => {
        if (nodeIdx[label] === undefined) {
          const seed = graphHash(`${slug}:${label}`);
          nodeIdx[label] = nodes.length;
          nodes.push({
            id: label, label,
            catSlug: slug, color: CAT_GRAPH_COLORS[slug] || "#C4627A",
            seed,
            nx: 0.08 + graphRand(seed, 1) * 0.84,
            ny: 0.10 + graphRand(seed, 2) * 0.80,
            vx: 0, vy: 0, count: 1, categories: new Set([slug]),
          });
        } else {
          const node = nodes[nodeIdx[label]];
          node.count++;
          node.categories.add(slug);
        }
      });
    });
  });

  // Edges: tools that co-occur in the same entry get connected
  const edgeSet = new Set();
  sortedCategorySlugs.forEach(slug => {
    (entriesByCategory[slug] || []).forEach(entry => {
      const tools = graphItemsForEntry(entry).filter(label => nodeIdx[label] !== undefined);
      for (let i = 0; i < tools.length; i++) {
        for (let j = i + 1; j < tools.length; j++) {
          const a = nodeIdx[tools[i]], b = nodeIdx[tools[j]];
          const key = a < b ? `${a}-${b}` : `${b}-${a}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push({ s: a, t: b, weight: 1 });
          } else {
            const edge = edges.find(e => (e.s === a && e.t === b) || (e.s === b && e.t === a));
            if (edge) edge.weight++;
          }
        }
      }
    });
  });

  nodes.forEach(n => { n.degree = 0; });
  edges.forEach(({ s, t }) => { nodes[s].degree++; nodes[t].degree++; });
  nodes.forEach(n => {
    n.categories = Array.from(n.categories);
    if (n.categories.length > 1) n.color = "#E7D6B6";
  });

  return { nodes, edges };
}

function KnowledgeGraph({ navigateTo }) {
  const canvasRef = useRef(null);
  const searchRef = useRef("");
  const [search, setSearch] = useState("");
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => { searchRef.current = search; }, [search]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DPR = window.devicePixelRatio || 1;
    let W, H;
    const ctx = canvas.getContext("2d");

    function resize() {
      W = canvas.parentElement.offsetWidth || 960;
      H = Math.max(620, Math.min(820, window.innerHeight * 0.72));
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();

    const { nodes, edges } = buildKnowledgeGraph();

    if (nodes.length === 0) {
      ctx.fillStyle = "rgba(215,215,230,0.4)";
      ctx.font = "14px Inter,sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Add tools: in entry frontmatter to populate the graph", W / 2, H / 2);
      return;
    }

    // ── Physics constants (friend's reference values) ────────
    const REP_D = 250, REP_STR = 13800;
    const SPR_REST = 122, SPR_K = 0.0044;
    const CTR_K = 0.0022;
    const DAMP = 0.915, MAX_V = 7.8;
    const ALPHA_DECAY = 0.986;
    const WALL = 64, MOUSE_R = 172;

    // Node sizing — small dots, hubs only slightly larger
    function nodeR(n) {
      return Math.max(4.2, Math.min(16, 4.5 + Math.sqrt(n.degree + n.count) * 1.42));
    }

    // Init positions
    nodes.forEach(n => {
      n.x = n.nx * W; n.y = n.ny * H;
      n.vx = 0; n.vy = 0; n.fx = 0; n.fy = 0;
      n.r = nodeR(n);
      n.showLabel = n.degree > 2 || n.count > 1 || n.label.length <= 14;
    });

    // Hex color to rgb components for edge blending
    function hexRGB(hex) {
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
    }

    // Adjacency list for BFS
    const adj = nodes.map(() => []);
    edges.forEach(({ s, t }) => { adj[s].push(t); adj[t].push(s); });

    // ── Physics tick ─────────────────────────────────────────
    function physicsTick(alpha, dragIdx) {
      nodes.forEach(n => { n.fx = 0; n.fy = 0; });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (dist < REP_D) {
            const f = alpha * REP_STR * Math.pow(1 - dist / REP_D, 2) / (dist + 8);
            const fx = f * dx / dist, fy = f * dy / dist;
            nodes[i].fx -= fx; nodes[i].fy -= fy;
            nodes[j].fx += fx; nodes[j].fy += fy;
          }
        }
      }

      edges.forEach(({ s, t, weight }) => {
        const a = nodes[s], b = nodes[t];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rest = SPR_REST - Math.min(34, weight * 6);
        const f = alpha * SPR_K * (dist - rest);
        const fx = f * dx / dist, fy = f * dy / dist;
        a.fx += fx; a.fy += fy; b.fx -= fx; b.fy -= fy;
      });

      nodes.forEach((n, i) => {
        if (i === dragIdx) return;
        n.fx += alpha * CTR_K * (W / 2 - n.x);
        n.fy += alpha * CTR_K * (H / 2 - n.y);
        if (n.x < WALL) n.fx += alpha * 3.8 * (1 - n.x / WALL);
        if (n.x > W - WALL) n.fx -= alpha * 3.8 * (1 - (W - n.x) / WALL);
        if (n.y < WALL) n.fy += alpha * 3.8 * (1 - n.y / WALL);
        if (n.y > H - WALL) n.fy -= alpha * 3.8 * (1 - (H - n.y) / WALL);
        n.vx += n.fx;
        n.vy += n.fy;
        n.vx *= DAMP; n.vy *= DAMP;
        const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (spd > MAX_V) { n.vx = n.vx / spd * MAX_V; n.vy = n.vy / spd * MAX_V; }
        n.x = Math.max(n.r + 8, Math.min(W - n.r - 8, n.x + n.vx));
        n.y = Math.max(n.r + 8, Math.min(H - n.r - 8, n.y + n.vy));
      });
    }

    // 1400 warmup ticks at full alpha, 300 at 0.8
    for (let i = 0; i < 650; i++) physicsTick(0.92, -1);
    for (let i = 0; i < 320; i++) physicsTick(0.45, -1);

    // ── BFS wave reveal from highest-degree hubs ─────────────
    const hubCount = Math.max(3, Math.ceil(nodes.length * 0.15));
    const hubSet = new Set(
      nodes.map((_, i) => i)
        .sort((a, b) => nodes[b].degree - nodes[a].degree)
        .slice(0, hubCount)
    );
    const waveDepth = new Array(nodes.length).fill(-1);
    const bfsQ = [];
    nodes.forEach((_, i) => { if (hubSet.has(i)) { waveDepth[i] = 0; bfsQ.push(i); } });
    for (let head = 0; head < bfsQ.length; head++) {
      adj[bfsQ[head]].forEach(nb => {
        if (waveDepth[nb] === -1) { waveDepth[nb] = waveDepth[bfsQ[head]] + 1; bfsQ.push(nb); }
      });
    }
    waveDepth.forEach((v, i) => { if (v === -1) waveDepth[i] = 4; });

    // Wave timing (reference implementation)
    const WAVE_STARTS  = [0, 260, 1080, 1780, 2260];
    const WAVE_SPREADS = [180, 900, 620, 420, 280];
    const NODE_REVEAL  = 420, EDGE_DRAW = 560;

    const revealAt = nodes.map((_, i) => {
      const w = Math.min(waveDepth[i], 4);
      return WAVE_STARTS[w] + graphRand(nodes[i].seed, 7) * WAVE_SPREADS[w];
    });

    // ── Runtime state ────────────────────────────────────────
    const state = {
      animStart: null, alpha: 0.14,
      hovered: null, clicked: null,
      dragging: null, dragOffX: 0, dragOffY: 0,
      mouseX: -999, mouseY: -999, lastTooltip: null,
    };
    let rafId = null, alive = true;

    function easeOut(t) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); }
    function clearGraph() {
      const grad = ctx.createRadialGradient(W * 0.52, H * 0.52, 40, W * 0.52, H * 0.52, Math.max(W, H) * 0.72);
      grad.addColorStop(0, "#11100e");
      grad.addColorStop(1, "#090908");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Draw ─────────────────────────────────────────────────
    function draw(ts) {
      if (!alive) return;

      clearGraph();

      const now = ts || performance.now();
      const { animStart, hovered: hov, clicked } = state;
      const q = searchRef.current.trim().toLowerCase();

      const prog = nodes.map((_, i) =>
        animStart ? easeOut((now - animStart - revealAt[i]) / NODE_REVEAL) : 0
      );

      // Active set (click or search filter)
      let activeSet = null;
      if (clicked !== null) {
        activeSet = new Set([clicked]);
        adj[clicked].forEach(nb => activeSet.add(nb));
      }
      if (q) {
        if (!activeSet) activeSet = new Set();
        nodes.forEach((n, i) => {
          if (n.label.toLowerCase().includes(q)) { activeSet.add(i); adj[i].forEach(nb => activeSet.add(nb)); }
        });
      }

      // Edges — reveal after both endpoints appear + EDGE_DRAW delay
      edges.forEach(({ s, t, weight }) => {
        const edgeP = animStart
          ? easeOut((now - animStart - Math.max(revealAt[s], revealAt[t]) - EDGE_DRAW) / EDGE_DRAW)
          : 0;
        if (edgeP <= 0) return;
        const a = nodes[s], b = nodes[t];
        const isLit = hov === s || hov === t || (clicked !== null && (s === clicked || t === clicked));
        const isDim = !!(activeSet && !activeSet.has(s) && !activeSet.has(t));
        const [ra, ga, ba] = hexRGB(a.color), [rb, gb, bb] = hexRGB(b.color);
        const er = (ra+rb)>>1, eg = (ga+gb)>>1, eb = (ba+bb)>>1;
        const eAlpha = isDim ? 0.018 : isLit ? 0.34 : 0.105;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const bend = Math.min(58, 15 + weight * 7);
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const cx = mx + (-dy / len) * bend * (graphRand(a.seed ^ b.seed, 3) > 0.5 ? 1 : -1);
        const cy = my + (dx / len) * bend * (graphRand(a.seed ^ b.seed, 4) > 0.5 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(cx, cy, b.x, b.y);
        ctx.strokeStyle = `rgba(${er},${eg},${eb},${(eAlpha * edgeP).toFixed(3)})`;
        ctx.lineWidth = isLit ? 1.35 : Math.min(1.1, 0.45 + weight * 0.06);
        ctx.stroke();
      });

      // Nodes
      nodes.forEach((n, i) => {
        const p = prog[i]; if (p <= 0) return;
        const isHov = hov === i;
        const isDim = !!(activeSet && !activeSet.has(i));
        const r = n.r * p * (isHov ? 1.18 : 1);
        const [nr, ng, nb] = hexRGB(n.color);
        ctx.globalAlpha = isDim ? 0.12 * p : p;
        ctx.shadowBlur = isDim ? 0 : isHov ? 22 : Math.max(8, n.r * 1.5);
        ctx.shadowColor = n.color;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isDim
          ? `rgba(${nr},${ng},${nb},0.18)`
          : `rgba(${nr},${ng},${nb},${isHov ? 1 : 0.92})`;
        ctx.fill();
        if (isHov) { ctx.strokeStyle = "rgba(255,255,245,0.95)"; ctx.lineWidth = 1.6; ctx.stroke(); }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        // Label (show for visible, non-dimmed nodes)
        if (!isDim && p > 0.5 && (n.showLabel || isHov || q)) {
          ctx.globalAlpha = Math.min(1, (p - 0.5) / 0.5);
          ctx.shadowColor = "rgba(0,0,0,0.94)"; ctx.shadowBlur = 5;
          ctx.fillStyle = isHov ? "#F7EFE1" : "rgba(220,211,196,0.92)";
          ctx.font = `${isHov ? 700 : 600} ${isHov ? 18 : Math.min(17, 12 + n.r * 0.45)}px Inter, system-ui, sans-serif`;
          ctx.textBaseline = "middle";
          // Flip label to left side when near right edge to prevent cutoff
          const labelW = ctx.measureText(n.label).width;
          const nearRight = n.x + r + 10 + labelW > W - 12;
          ctx.textAlign = nearRight ? "right" : "left";
          ctx.fillText(n.label, nearRight ? n.x - r - 8 : n.x + r + 8, n.y);
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
      });

      // Mouse repulsion
      if (state.mouseX > 0 && state.dragging === null) {
        nodes.forEach(n => {
          const dx = n.x - state.mouseX, dy = n.y - state.mouseY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < MOUSE_R && dist > 1) {
            const f = 5.2 * Math.pow(1 - dist / MOUSE_R, 2);
            n.vx += f * dx / dist; n.vy += f * dy / dist;
          }
        });
        state.alpha = Math.max(state.alpha, 0.12);
      }

      // Settle physics
      if (state.dragging !== null) {
        nodes[state.dragging].vx = 0; nodes[state.dragging].vy = 0;
      }
      if (state.alpha > 0.001) {
        physicsTick(state.alpha, state.dragging);
        state.alpha *= ALPHA_DECAY;
      }

      rafId = requestAnimationFrame(draw);
    }

    // ── IntersectionObserver — BFS grow-in on scroll ─────────
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !state.animStart)
        state.animStart = performance.now();
    }, { threshold: 0.15 });
    observer.observe(canvas.parentElement);
    rafId = requestAnimationFrame(draw);

    // ── Interaction ──────────────────────────────────────────
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
    }
    function findNode(x, y) {
      for (let i = nodes.length - 1; i >= 0; i--)
        if (Math.hypot(nodes[i].x - x, nodes[i].y - y) < Math.max(nodes[i].r * 1.9, 15)) return i;
      return null;
    }
    function updateTooltip(i) {
      const next = i === null ? null : {
        label: nodes[i].label,
        connections: nodes[i].degree,
        x: nodes[i].x,
        y: nodes[i].y,
      };
      const prev = state.lastTooltip;
      if ((!prev && !next) || (prev && next && prev.label === next.label && Math.abs(prev.x - next.x) < 2 && Math.abs(prev.y - next.y) < 2)) return;
      state.lastTooltip = next;
      setTooltip(next);
    }
    function onMouseMove(e) {
      const { x, y } = getPos(e);
      state.mouseX = x; state.mouseY = y;
      if (state.dragging !== null) {
        nodes[state.dragging].x = Math.max(nodes[state.dragging].r, Math.min(W - nodes[state.dragging].r, x + state.dragOffX));
        nodes[state.dragging].y = Math.max(nodes[state.dragging].r, Math.min(H - nodes[state.dragging].r, y + state.dragOffY));
        updateTooltip(state.dragging);
        canvas.style.cursor = "grabbing";
      } else {
        state.hovered = findNode(x, y);
        updateTooltip(state.hovered);
        canvas.style.cursor = state.hovered !== null ? "pointer" : "default";
      }
    }
    function onMouseDown(e) {
      const { x, y } = getPos(e);
      const i = findNode(x, y);
      if (i !== null) { state.dragging = i; state.dragOffX = nodes[i].x - x; state.dragOffY = nodes[i].y - y; e.preventDefault(); }
    }
    function onMouseUp() {
      if (state.dragging !== null) { state.alpha = Math.max(state.alpha, 0.12); state.dragging = null; }
    }
    function onClick(e) {
      const { x, y } = getPos(e);
      const i = findNode(x, y);
      if (i !== null) state.clicked = state.clicked === i ? null : i;
      else state.clicked = null;
    }
    function onLeave() { state.hovered = null; state.mouseX = -999; updateTooltip(null); canvas.style.cursor = "default"; }
    function onResize() {
      resize();
      nodes.forEach(n => { n.x = Math.max(n.r+4, Math.min(W-n.r-4, n.x)); n.y = Math.max(n.r+4, Math.min(H-n.r-4, n.y)); });
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize);

    return () => {
      alive = false;
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
      setTooltip(null);
    };
  }, [navigateTo]);

  const activeCats = sortedCategorySlugs.filter(s => (entriesByCategory[s] || []).length > 0);

  return (
    <div className="graph-section-inner">
      <div className="graph-header-row">
        <div>
          <div className="graph-eyebrow">KNOWLEDGE GRAPH</div>
          <h2 className="graph-title-h2">
            Skills &amp; Expertise
            <span className="graph-tagline">Scroll into view — the graph grows like a web</span>
          </h2>
        </div>
        <div className="graph-right-controls">
          <input
            className="graph-search-input"
            type="text"
            placeholder="Search tools..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="graph-reset-btn" onClick={() => setSearch("")} type="button">Reset</button>
        </div>
      </div>
      <div className="graph-canvas-wrap">
        <canvas ref={canvasRef} className="knowledge-graph-canvas" />
        {activeCats.length > 0 && (
          <div className="graph-legend">
            {activeCats.map(slug => (
              <div key={slug} className="graph-legend-item">
                <span className="graph-legend-dot" style={{ background: CAT_GRAPH_COLORS[slug] || "#C4627A" }} />
                <span>{CATEGORY_META[slug].navLabel}</span>
              </div>
            ))}
          </div>
        )}
        {tooltip && (
          <div className="graph-tooltip" style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
            <span>{tooltip.label}</span>
            <span>&middot;</span>
            <span>{tooltip.connections} {tooltip.connections === 1 ? "connection" : "connections"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeGraphReference() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const searchRef = useRef("");
  const [search, setSearch] = useState("");

  useEffect(() => { searchRef.current = search; }, [search]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const source = buildKnowledgeGraph();
    const graphNodes = source.nodes.map(n => ({
      id: n.label,
      cat: n.catSlug,
      w: Math.max(0.9, Math.min(2.4, 0.75 + Math.sqrt((n.degree || 0) + (n.count || 1)) * 0.18)),
    }));
    const graphEdges = source.edges.map(e => [source.nodes[e.s].label, source.nodes[e.t].label]);
    const nodeIdx = {};
    graphNodes.forEach((s, i) => { nodeIdx[s.id] = i; });

    const catRgb = {};
    Object.entries(CAT_GRAPH_COLORS).forEach(([slug, hex]) => {
      catRgb[slug] = {
        hex,
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
      };
    });

    const neighborSets = {};
    graphNodes.forEach(s => { neighborSets[s.id] = new Set(); });
    graphEdges.forEach(([a, b]) => {
      if (neighborSets[a]) neighborSets[a].add(b);
      if (neighborSets[b]) neighborSets[b].add(a);
    });

    const hubIds = new Set(
      [...graphNodes]
        .sort((a, b) => (neighborSets[b.id]?.size || 0) - (neighborSets[a.id]?.size || 0))
        .slice(0, Math.min(8, graphNodes.length))
        .map(n => n.id)
    );

    const totalEntryMs = 6000;
    const nodeRevealMs = 380;
    const edgeDrawMs = 460;
    const alphaDecay = 0.992;
    const alphaMin = 0.001;
    const alphaMouse = 0.22;
    const baseR = 3.0;

    let W = 0, H = 0, dpr = 1;
    let nodes = [];
    let mouse = { x: -9999, y: -9999, active: false };
    let selectedId = null;
    let hoveredId = null;
    let rafId = null;
    let alpha = 1.0;
    let entryProgress = 0;
    let entryStartTime = null;
    let entryElapsed = 0;
    let entryTriggered = false;
    let dragId = null, dragOffX = 0, dragOffY = 0, didDrag = false;
    let edgeSignals = [];
    let ripples = [];
    let searchIds = new Set();
    let resizeTimer = null;
    let observer = null;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function nodeRevealP(n) {
      if (entryProgress >= 1) return 1;
      return Math.min(1, Math.max(0, (entryElapsed - (n._revealAt || 0)) / nodeRevealMs));
    }

    function nodeRevealEase(n) {
      const p = nodeRevealP(n);
      return p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.pow(1 - p, 3);
    }

    function edgeRevealP(na, nb) {
      if (entryProgress >= 1) return 1;
      const drawAt = Math.max(na._revealAt || 0, nb._revealAt || 0) + nodeRevealMs * 0.5;
      return Math.min(1, Math.max(0, (entryElapsed - drawAt) / edgeDrawMs));
    }

    function tick(forceAlpha) {
      const ca = forceAlpha != null ? forceAlpha : mouse.active ? Math.max(alpha, alphaMouse) : alpha;
      if (ca < alphaMin) return;

      const N = nodes.length;
      const maxV = 1.6, damp = 0.88;
      const repD = 320, repStr = 4200;
      const sprRest = 205, sprK = 0.002;
      const ctrK = 0.0022;
      const mouseR = 165, mouseF = 2.0;

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d2 = dx * dx + dy * dy;
          const endpointPair = nodes[i].cat === "endpoint" && nodes[j].cat === "endpoint";
          const pairRepD = endpointPair ? 390 : repD;
          if (d2 > pairRepD * pairRepD) continue;
          const d3 = Math.sqrt(d2) * d2 || 1;
          const f = ca * (endpointPair ? 7200 : repStr) / d3;
          nodes[i].vx -= dx * f; nodes[i].vy -= dy * f;
          nodes[j].vx += dx * f; nodes[j].vy += dy * f;
        }
      }

      graphEdges.forEach(([eA, eB]) => {
        const ni = nodeIdx[eA], nj = nodeIdx[eB];
        if (ni == null || nj == null) return;
        const na = nodes[ni], nb = nodes[nj];
        const dx = nb.x - na.x, dy = nb.y - na.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const endpointEdge = na.cat === "endpoint" && nb.cat === "endpoint";
        const f = ca * (endpointEdge ? sprK * 0.76 : sprK) * (d - (endpointEdge ? sprRest + 18 : sprRest)) / d;
        na.vx += dx * f; na.vy += dy * f;
        nb.vx -= dx * f; nb.vy -= dy * f;
      });

      const cx = W / 2 - 120, cy = H * 0.48;
      nodes.forEach(n => {
        n.vx += (cx - n.x) * ctrK * ca;
        n.vy += (cy - n.y) * ctrK * ca;
      });
      nodes.forEach(n => {
        if (!n.rightWing) return;
        n.vx += (W * 0.76 - n.x) * 0.0017 * ca;
        n.vy += (H * 0.50 - n.y) * 0.00035 * ca;
      });
      nodes.forEach(n => {
        if (n.cat !== "endpoint") return;
        n.vx += (W * 0.58 - n.x) * 0.00065 * ca;
        n.vy += (H * 0.58 - n.y) * 0.00028 * ca;
      });

      const catK = forceAlpha != null ? 0.006 : 0;
      if (catK > 0) {
        const catSum = {};
        nodes.forEach(n => {
          if (!catSum[n.cat]) catSum[n.cat] = { sx: 0, sy: 0, cnt: 0 };
          catSum[n.cat].sx += n.x; catSum[n.cat].sy += n.y; catSum[n.cat].cnt++;
        });
        nodes.forEach(n => {
          const s = catSum[n.cat];
          if (!s || s.cnt < 2) return;
          n.vx += (s.sx / s.cnt - n.x) * catK * ca;
          n.vy += (s.sy / s.cnt - n.y) * catK * ca;
        });
      }

      if (mouse.active) {
        nodes.forEach(n => {
          const dx = n.x - mouse.x, dy = n.y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d < mouseR) {
            const f = mouseF * (1 - d / mouseR) / d;
            n.vx += dx * f; n.vy += dy * f;
          }
        });
      }

      const wallZone = 150, wallK = 2.2;
      nodes.forEach(n => {
        if (n.x < wallZone) n.vx += wallK * Math.pow(1 - n.x / wallZone, 2) * ca;
        if (n.x > W - wallZone) n.vx -= wallK * Math.pow(1 - (W - n.x) / wallZone, 2) * ca;
        if (n.y < wallZone) n.vy += wallK * Math.pow(1 - n.y / wallZone, 2) * ca;
        if (n.y > H - wallZone) n.vy -= wallK * Math.pow(1 - (H - n.y) / wallZone, 2) * ca;
      });

      nodes.forEach(n => {
        n.vx *= damp; n.vy *= damp;
        const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (spd > maxV) { n.vx *= maxV / spd; n.vy *= maxV / spd; }
        n.x += n.vx; n.y += n.vy;
        const hard = 20;
        if (n.x < hard) { n.x = hard; if (n.vx < 0) n.vx *= -0.3; }
        if (n.x > W - hard) { n.x = W - hard; if (n.vx > 0) n.vx *= -0.3; }
        if (n.y < hard) { n.y = hard; if (n.vy < 0) n.vy *= -0.3; }
        if (n.y > H - hard) { n.y = H - hard; if (n.vy > 0) n.vy *= -0.3; }
      });

      if (forceAlpha == null && !mouse.active) alpha = Math.max(alpha * alphaDecay, 0);
    }

    function initNodes() {
      const cx = W / 2 - 120, cy = H * 0.48;
      const spreadX = W * 0.52;
      const spreadY = H * 0.32;
      const N = graphNodes.length;
      nodes = graphNodes.map((s, i) => {
        const angle = (i / N) * Math.PI * 2;
        const r = 0.35 + graphRand(graphHash(s.id), 2) * 0.65;
        return {
          id: s.id,
          cat: s.cat,
          x: cx + Math.cos(angle) * spreadX * r,
          y: cy + Math.sin(angle) * spreadY * r,
          vx: 0,
          vy: 0,
          radius: baseR * Math.max(0.85, Math.min(2.8, 0.55 + (neighborSets[s.id]?.size || 1) * 0.11)),
        };
      });

      for (let i = 0; i < 1400; i++) tick(1.0);
      const edgeBand = 150;
      nodes.forEach(n => {
        if (n.y < edgeBand) n.y = edgeBand + graphRand(graphHash(n.id), 3) * 60;
        if (n.y > H - edgeBand) n.y = H - edgeBand - graphRand(graphHash(n.id), 4) * 60;
      });
      for (let i = 0; i < 300; i++) tick(0.8);
      nodes.forEach(n => {
        n.rightWing = n.x > W * 0.43;
        if (n.rightWing) n.x = Math.min(W - 42, n.x + W * 0.13);
      });
      alpha = 0;

      nodes.forEach(n => { n._wave = null; });
      const bfsQ = [];
      [...hubIds].forEach(id => {
        const n = nodes[nodeIdx[id]];
        if (n && n._wave == null) { n._wave = 0; bfsQ.push(id); }
      });
      let bfsI = 0;
      while (bfsI < bfsQ.length) {
        const currId = bfsQ[bfsI++];
        const currWave = nodes[nodeIdx[currId]]._wave;
        (neighborSets[currId] || new Set()).forEach(nbId => {
          const nb = nodes[nodeIdx[nbId]];
          if (nb && nb._wave == null) { nb._wave = currWave + 1; bfsQ.push(nbId); }
        });
      }
      nodes.forEach(n => { if (n._wave == null) n._wave = 6; });

      const waveGroups = {};
      nodes.forEach(n => { if (!waveGroups[n._wave]) waveGroups[n._wave] = []; waveGroups[n._wave].push(n); });
      const waveStarts = [0, 630, 3580, 4780, 5270];
      const waveSpreads = [260, 2850, 1100, 415, 185];
      Object.keys(waveGroups).map(Number).sort((a, b) => a - b).forEach((w, wi) => {
        const group = waveGroups[w];
        const start = waveStarts[Math.min(wi, waveStarts.length - 1)];
        const spread = waveSpreads[Math.min(wi, waveSpreads.length - 1)];
        group.forEach((n, i) => { n._revealAt = start + (group.length > 1 ? (i / (group.length - 1)) * spread : 0); });
      });
    }

    function resize() {
      if (!entryTriggered) { entryProgress = 0; entryStartTime = null; entryElapsed = 0; }
      W = wrap.clientWidth || 800;
      H = wrap.clientHeight || 540;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNodes();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const hasSel = selectedId !== null;
      const cx0 = W / 2 - 120, cy0 = H / 2;
      const isGraphLight = false;

      graphEdges.forEach(([a, b]) => {
        const ni = nodeIdx[a], nj = nodeIdx[b];
        if (ni == null || nj == null) return;
        const na = nodes[ni], nb = nodes[nj];
        const aeE = nodeRevealEase(na), beE = nodeRevealEase(nb);
        const ep = edgeRevealP(na, nb);
        if (ep <= 0) return;

        let edgeAlpha;
        if (hasSel) edgeAlpha = (a === selectedId || b === selectedId) ? 0.55 : 0.04;
        else {
          const d = Math.hypot(nb.x - na.x, nb.y - na.y);
          edgeAlpha = 0.24 * Math.max(0, 1 - d / 420);
          if (edgeAlpha < 0.006) return;
        }

        const isHubEdge = hubIds.has(a) && hubIds.has(b);
        const isSemiHub = hubIds.has(a) || hubIds.has(b);
        ctx.lineWidth = isGraphLight
          ? (isHubEdge ? 2.6 : isSemiHub ? 2.0 : 1.35)
          : (isHubEdge ? 2.0 : isSemiHub ? 1.5 : 1.0);
        const cat = catRgb[na.cat] || { r: 196, g: 149, b: 106 };
        const visibleEdgeAlpha = Math.min(0.72, edgeAlpha * 2.25);
        ctx.strokeStyle = isGraphLight
          ? `rgba(${cat.r},${cat.g},${cat.b},${visibleEdgeAlpha})`
          : `rgba(${Math.min(255, cat.r + 50)},${Math.min(255, cat.g + 50)},${Math.min(255, cat.b + 50)},${edgeAlpha})`;

        const ax = cx0 + (na.x - cx0) * aeE, ay = cy0 + (na.y - cy0) * aeE;
        const bx = cx0 + (nb.x - cx0) * beE, by = cy0 + (nb.y - cy0) * beE;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const curve = ((ni + nj) % 2 === 0) ? 14 : -14;
        const cpx = mx - (by - ay) / len * curve, cpy = my + (bx - ax) / len * curve;

        ctx.beginPath();
        if (ep >= 1) {
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(cpx, cpy, bx, by);
          ctx.stroke();
        } else {
          const fwd = (na._revealAt || 0) <= (nb._revealAt || 0);
          const sx = fwd ? ax : bx, sy = fwd ? ay : by;
          const ex = fwd ? bx : ax, ey = fwd ? by : ay;
          const q0x = sx + (cpx - sx) * ep, q0y = sy + (cpy - sy) * ep;
          const q1x = cpx + (ex - cpx) * ep, q1y = cpy + (ey - cpy) * ep;
          const rx = q0x + (q1x - q0x) * ep, ry = q0y + (q1y - q0y) * ep;
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(q0x, q0y, rx, ry);
          ctx.stroke();
          const grd = ctx.createRadialGradient(rx, ry, 0, rx, ry, 5);
          grd.addColorStop(0, `rgba(${Math.min(255, cat.r + 80)},${Math.min(255, cat.g + 80)},${Math.min(255, cat.b + 80)},0.95)`);
          grd.addColorStop(1, `rgba(${cat.r},${cat.g},${cat.b},0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(rx, ry, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      if (entryProgress >= 1) {
        edgeSignals.forEach(sig => {
          const ni = nodeIdx[sig.a], nj = nodeIdx[sig.b];
          if (ni == null || nj == null) return;
          const na = nodes[ni], nb = nodes[nj];
          const ax = cx0 + (na.x - cx0) * nodeRevealEase(na), ay = cy0 + (na.y - cy0) * nodeRevealEase(na);
          const bx = cx0 + (nb.x - cx0) * nodeRevealEase(nb), by = cy0 + (nb.y - cy0) * nodeRevealEase(nb);
          const emx = (ax + bx) / 2, emy = (ay + by) / 2;
          const elen = Math.hypot(bx - ax, by - ay) || 1;
          const ecurve = ((ni + nj) % 2 === 0) ? 14 : -14;
          const cpx = emx - (by - ay) / elen * ecurve;
          const cpy = emy + (bx - ax) / elen * ecurve;
          const t = sig.t;
          const px = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cpx + t * t * bx;
          const py = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cpy + t * t * by;
          const cat = catRgb[na.cat] || { r: 196, g: 149, b: 106 };
          const grd = ctx.createRadialGradient(px, py, 0, px, py, 3.5);
          grd.addColorStop(0, `rgba(${cat.r},${cat.g},${cat.b},0.95)`);
          grd.addColorStop(1, `rgba(${cat.r},${cat.g},${cat.b},0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.textBaseline = "middle";
      const pulseT = Date.now() / 1000;
      const idleGlow = !mouse.active && entryProgress >= 1 && !hasSel;
      const activeSearch = searchIds.size > 0;

      nodes.forEach(n => {
        const cat = catRgb[n.cat] || { hex: "#D8C8A8", r: 216, g: 200, b: 168 };
        const isSel = n.id === selectedId;
        const isNeighbor = hasSel && neighborSets[selectedId]?.has(n.id);
        const dimmed = hasSel && !(isSel || isNeighbor);
        const isHub = hubIds.has(n.id);
        const nEase = nodeRevealEase(n);
        const nProg = nodeRevealP(n);
        const drawX = cx0 + (n.x - cx0) * nEase;
        const drawY = cy0 + (n.y - cy0) * nEase;
        const entryScale = nProg < 1 ? 0.2 + 0.8 * nProg : 1;
        const dotR = (isSel ? n.radius * 1.65 : n.radius) * entryScale;
        const hubPulse = isHub && idleGlow ? 1 + (Math.sin(pulseT * 1.5 + n.x * 0.008) * 0.5 + 0.5) * 0.65 : 1;
        const isSearchMatch = searchIds.has(n.id);
        const glowMult = activeSearch ? (isSearchMatch ? 2.6 : 0.32) : 1;

        if (!dimmed) {
          const glowBase = dotR * (isSel ? 5.5 : isNeighbor ? 4.5 : isHub ? 4.0 : 3.0);
          const glowR = glowBase * (isHub && idleGlow ? hubPulse : 1) * (isSearchMatch ? 1.5 : 1);
          const glowA = (isSel ? 0.34 : isNeighbor ? 0.22 : isHub ? 0.20 : 0.12) * entryScale * glowMult;
          const grd = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, glowR);
          grd.addColorStop(0, `rgba(${cat.r},${cat.g},${cat.b},${glowA})`);
          grd.addColorStop(1, `rgba(${cat.r},${cat.g},${cat.b},0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(drawX, drawY, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = dimmed ? 0.12 : (activeSearch && !isSearchMatch ? entryScale * 0.55 : entryScale);
        ctx.fillStyle = cat.hex;
        ctx.beginPath();
        ctx.arc(drawX, drawY, dotR, 0, Math.PI * 2);
        ctx.fill();
        if (isSel) {
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = cat.hex;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(drawX, drawY, dotR + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        ctx.globalAlpha = 1;

        if (nProg > 0.55) {
          const labelFade = Math.min(1, (nProg - 0.55) / 0.35);
          const lA = (dimmed ? 0.10 : 0.86) * labelFade;
          const lx = drawX + dotR + 5;
          const ly = drawY;
          ctx.font = isHub ? "700 13px Inter,system-ui,sans-serif" : "500 12px Inter,system-ui,sans-serif";
          const tw = ctx.measureText(n.id).width;
          if (!dimmed) {
            ctx.globalAlpha = 0.60 * labelFade;
            ctx.fillStyle = isGraphLight ? "rgba(255,252,247,0.82)" : "rgba(16,13,10,0.82)";
            ctx.beginPath();
            ctx.roundRect(lx - 3, ly - 7, tw + 6, 14, 3);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = isGraphLight ? `rgba(42,23,32,${lA})` : `rgba(240,228,210,${lA})`;
          ctx.fillText(n.id, lx, ly);
          ctx.globalAlpha = 1;
        }
      });

      if (searchIds.size > 0) {
        const pulse = Math.sin(pulseT * 3.0) * 0.5 + 0.5;
        searchIds.forEach(sid => {
          const sn = nodes[nodeIdx[sid]];
          if (!sn) return;
          const rx = cx0 + (sn.x - cx0) * nodeRevealEase(sn);
          const ry = cy0 + (sn.y - cy0) * nodeRevealEase(sn);
          const cat = catRgb[sn.cat] || { r: 216, g: 200, b: 168 };
          ctx.globalAlpha = 0.28 + pulse * 0.55;
          ctx.strokeStyle = `rgba(${Math.min(255, cat.r + 90)},${Math.min(255, cat.g + 90)},${Math.min(255, cat.b + 90)},1)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rx, ry, sn.radius + 4 + pulse * 6, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }

      ripples.forEach(rip => {
        const n = nodes[nodeIdx[rip.id]];
        if (!n) return;
        const rx = cx0 + (n.x - cx0) * nodeRevealEase(n);
        const ry = cy0 + (n.y - cy0) * nodeRevealEase(n);
        const cat = catRgb[n.cat] || { r: 216, g: 200, b: 168 };
        const ease = 1 - Math.pow(1 - rip.t, 2);
        [[ease, 0.78, 2.0, 58], [Math.pow(rip.t, 0.7), 0.28, 1.0, 90]].forEach(([e, maxA, lw, spread]) => {
          const a = maxA * (1 - e);
          if (a < 0.01) return;
          ctx.globalAlpha = a;
          ctx.strokeStyle = `rgba(${Math.min(255, cat.r + 90)},${Math.min(255, cat.g + 90)},${Math.min(255, cat.b + 90)},1)`;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.arc(rx, ry, n.radius + spread * e, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      });

      if (hoveredId !== null && !hasSel && entryProgress >= 1) {
        const n = nodes[nodeIdx[hoveredId]];
        if (n) {
          const tdx = cx0 + (n.x - cx0) * nodeRevealEase(n);
          const tdy = cy0 + (n.y - cy0) * nodeRevealEase(n);
          const count = neighborSets[hoveredId]?.size ?? 0;
          const label = `${n.id}  \u00b7  ${count} connection${count !== 1 ? "s" : ""}`;
          ctx.font = "500 11px Inter, system-ui, sans-serif";
          const tw = ctx.measureText(label).width;
          const px = 10, py = 5;
          let tx = tdx + n.radius + 12;
          let ty = tdy - 16;
          if (tx + tw + px * 2 > W - 6) tx = tdx - tw - px * 2 - n.radius - 12;
          if (ty - py < 4) ty = tdy + 12;
          ctx.fillStyle = isGraphLight ? "rgba(42,23,32,0.92)" : "rgba(255,252,245,0.92)";
          ctx.beginPath();
          ctx.roundRect(tx - px, ty - py, tw + px * 2, 22, 6);
          ctx.fill();
          ctx.fillStyle = isGraphLight ? "rgba(255,252,245,1)" : "rgba(20,16,10,1)";
          ctx.fillText(label, tx, ty + 6);
        }
      }
    }

    function idleGlowActive() {
      return !mouse.active && entryProgress >= 1 && selectedId === null;
    }

    function loop() {
      if (!entryTriggered) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      if (entryStartTime === null) entryStartTime = performance.now();
      entryElapsed = Math.min(totalEntryMs, performance.now() - entryStartTime);
      entryProgress = entryElapsed / totalEntryMs;
      const cur = mouse.active ? Math.max(alpha, alphaMouse) : alpha;
      if (cur >= alphaMin || entryProgress < 1 || idleGlowActive()) tick();
      if (entryProgress >= 1) {
        if (Math.random() < 0.10 && edgeSignals.length < 22) {
          const idx = Math.floor(Math.random() * graphEdges.length);
          const [ea, eb] = graphEdges[idx];
          if (nodeIdx[ea] != null && nodeIdx[eb] != null) edgeSignals.push({ a: ea, b: eb, t: 0, spd: 0.0008 + Math.random() * 0.0012 });
        }
        edgeSignals = edgeSignals.filter(s => { s.t += s.spd; return s.t < 1.0; });
      }
      ripples = ripples.filter(r => { r.t += 0.025; return r.t < 1.0; });
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function findDrawNode(mx, my, loose = 50) {
      let found = null, minD = Infinity;
      nodes.forEach(n => {
        const dx = W / 2 + (n.x - W / 2) * nodeRevealEase(n);
        const dy = H / 2 + (n.y - H / 2) * nodeRevealEase(n);
        const d = Math.hypot(dx - mx, dy - my);
        if (d < n.radius + loose && d < minD) { minD = d; found = n; }
      });
      return found;
    }

    function onMouseMove(e) {
      const rect = wrap.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      if (!mouse.active) alpha = Math.max(alpha, alphaMouse);
      mouse.active = true;

      if (dragId !== null) {
        const dn = nodes[nodeIdx[dragId]];
        if (dn) { dn.x = mouse.x + dragOffX; dn.y = mouse.y + dragOffY; dn.vx = 0; dn.vy = 0; }
        alpha = Math.max(alpha, 0.08);
        didDrag = true;
        wrap.style.cursor = "grabbing";
        return;
      }
      if (entryProgress < 1) { hoveredId = null; return; }
      let found = findDrawNode(mouse.x, mouse.y, 50)?.id || null;
      if (!found && hoveredId) {
        const hn = nodes[nodeIdx[hoveredId]];
        if (hn) {
          const hx = W / 2 + (hn.x - W / 2) * nodeRevealEase(hn);
          const hy = H / 2 + (hn.y - H / 2) * nodeRevealEase(hn);
          if (Math.hypot(hx - mouse.x, hy - mouse.y) < 110) found = hoveredId;
        }
      }
      hoveredId = found;
      wrap.style.cursor = found ? "grab" : "crosshair";
    }

    function onMouseLeave() {
      mouse.active = false;
      hoveredId = null;
      dragId = null;
      wrap.style.cursor = "crosshair";
    }

    function onMouseDown(e) {
      if (entryProgress < 1) return;
      const rect = wrap.getBoundingClientRect();
      const closest = findDrawNode(e.clientX - rect.left, e.clientY - rect.top, 14);
      if (closest) {
        dragId = closest.id;
        dragOffX = closest.x - (e.clientX - rect.left);
        dragOffY = closest.y - (e.clientY - rect.top);
        didDrag = false;
        e.preventDefault();
      }
    }

    function onMouseUp() { dragId = null; }

    function onClick(e) {
      if (didDrag) { didDrag = false; return; }
      const rect = wrap.getBoundingClientRect();
      let clicked = hoveredId;
      if (!clicked) clicked = findDrawNode(e.clientX - rect.left, e.clientY - rect.top, 50)?.id || null;
      if (clicked) ripples.push({ id: clicked, t: 0 });
      selectedId = clicked === selectedId ? null : clicked;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!rafId) {
        rafId = requestAnimationFrame(loop);
      }
    }

    function onResize() {
      cancelAnimationFrame(rafId);
      rafId = null;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        rafId = requestAnimationFrame(loop);
      }, 120);
    }

    function onGraphSearch(event) {
      const q = String(event.detail || "").trim().toLowerCase();
      if (!q) {
        searchIds = new Set();
        return;
      }
      searchIds = new Set(graphNodes.filter(s => s.id.toLowerCase().includes(q)).map(s => s.id));
      if (searchIds.size > 0) alpha = Math.max(alpha, 0.1);
    }

    wrap.addEventListener("mousemove", onMouseMove);
    wrap.addEventListener("mouseleave", onMouseLeave);
    wrap.addEventListener("mousedown", onMouseDown);
    wrap.addEventListener("mouseup", onMouseUp);
    wrap.addEventListener("click", onClick);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize);
    window.addEventListener("knowledge-graph-search", onGraphSearch);

    resize();
    if (prefersReduced) {
      entryTriggered = true;
      entryProgress = 1;
    } else {
      observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !entryTriggered) {
          entryTriggered = true;
          entryProgress = 0;
          observer.disconnect();
        }
      }, { threshold: 0.15 });
      observer.observe(wrap);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      clearTimeout(resizeTimer);
      wrap.removeEventListener("mousemove", onMouseMove);
      wrap.removeEventListener("mouseleave", onMouseLeave);
      wrap.removeEventListener("mousedown", onMouseDown);
      wrap.removeEventListener("mouseup", onMouseUp);
      wrap.removeEventListener("click", onClick);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("knowledge-graph-search", onGraphSearch);
    };
  }, []);

  useEffect(() => {
    // Search is read by the canvas loop without forcing React re-renders per frame.
  }, [search]);

  return (
    <div className="graph-section-inner">
      <div className="graph-header-row">
        <div />
        <div className="graph-right-controls">
          <input
            className="graph-search-input"
            type="text"
            placeholder="Search Tools"
            value={search}
            onChange={e => {
              const value = e.target.value;
              setSearch(value);
              const q = value.trim().toLowerCase();
              searchRef.current = value;
              window.dispatchEvent(new CustomEvent("knowledge-graph-search", { detail: q }));
            }}
            onKeyDown={e => {
              if (e.key === "Escape") {
                setSearch("");
                window.dispatchEvent(new CustomEvent("knowledge-graph-search", { detail: "" }));
              }
            }}
            aria-label="Search tools"
          />
        </div>
      </div>
      <div className="graph-canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="knowledge-graph-canvas" />
      </div>
    </div>
  );
}

function HomePage({ navigateTo }) {
  const totalEntries = Object.values(entriesByCategory).reduce((n, a) => n + a.length, 0);
  const activeCategories = Object.keys(entriesByCategory).filter(k => CATEGORY_META[k] && entriesByCategory[k].length > 0).length;
  const focusRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  function scrollToFocus() {
    focusRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 40); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="home">

      <div className="hero-snap">
        <section className="hero">
          <div className="hero-left">
            <div className="hero-eyebrow">
              <span className="hero-kicker">SOC Analyst · Cybersecurity Portfolio</span>
              {totalEntries > 0 && (
                <span className="hero-entry-count">{totalEntries} {totalEntries === 1 ? "entry" : "entries"} · {activeCategories} focus {activeCategories === 1 ? "area" : "areas"}</span>
              )}
            </div>
            <p className="hero-name">Aparnaa</p>
            <h1 className="hero-headline">
              Security investigations,<br />threat analysis, and<br />
              <span className="hero-accent">detection research.</span>
            </h1>
            <p className="hero-desc">
              Documented case studies from hands-on lab work across endpoint forensics,
              SIEM detection, network analysis, and incident response.
            </p>
            <div className="hero-ctas">
              <button className="cta-primary" onClick={scrollToFocus} type="button">
                Browse Work →
              </button>
            </div>
          </div>
          <div className="hero-right">
            <SkillRadar navigateTo={navigateTo} />
          </div>
        </section>
        <button className={`scroll-hint${scrolled ? " hidden" : ""}`} onClick={scrollToFocus} type="button" aria-label="Scroll to areas of practice">
          <span />
        </button>
      </div>

      <div className="focus-snap" ref={focusRef}>
        <span className="section-label">Areas of Practice</span>
        <div className="focus-grid">
          {sortedCategorySlugs.map((slug, i) => {
            const meta = CATEGORY_META[slug];
            const count = (entriesByCategory[slug] || []).length;
            return (
              <button key={slug} className="focus-card" onClick={() => navigateTo(`/${slug}`)} type="button"
                style={{ animationDelay: `${i * 65}ms` }}>
                <div className="focus-card-top">
                  <span className="focus-title">{meta.label}</span>
                  {count > 0 && <span className="focus-count">{count}</span>}
                </div>
                <span className="focus-desc">{meta.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="graph-section">
        <KnowledgeGraphReference />
      </section>

    </div>
  );
}

function CategoryIcon({ slug }) {
  const icons = {
    "homelab": <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    "endpoint": <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    "network-security": <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></>,
    "siem": <><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></>,
    "vulnerability-management": <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    "threat-intelligence": <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    "incident-response": <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    "identity-account": <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  };
  const paths = icons[slug];
  if (!paths) return null;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );
}


// ── Category page ─────────────────────────────────────────

function CategoryPage({ categorySlug, entries, openEntry, openingEntry }) {
  const meta = CATEGORY_META[categorySlug] || { label: categorySlug, color: "var(--accent)", bg: "var(--accent-light)" };
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 style={{ color: "var(--accent)" }}>{meta.label}</h1>
        <span className="page-count">{entries.length} {entries.length === 1 ? "case" : "cases"}</span>
      </div>
      <div className="cases-list" aria-live="polite">
        {entries.length === 0 ? (
          <div className="empty-row">No cases in this category yet.</div>
        ) : (
          entries.map((entry, i) => (
            <CaseRow key={entry.slug} entry={entry} isOpening={openingEntry === entry.slug} onOpen={openEntry} animDelay={i * 60} />
          ))
        )}
      </div>
    </div>
  );
}

function CaseRow({ entry, isOpening, onOpen, animDelay = 0 }) {
  const meta = CATEGORY_META[entry.categorySlug] || { color: "var(--accent)", bg: "var(--accent-light)" };
  const [expanded, setExpanded] = useState(false);

  function handleClick(e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(entry);
  }

  function handleToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(v => !v);
  }

  return (
    <a
      className={`case-row${isOpening ? " is-opening" : ""}`}
      href={browserPath(entry.link)}
      onClick={handleClick}
      aria-label={`Open ${entry.title}`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="case-row-top">
        <div className="case-row-left">
          <div className="case-row-header">
            {entry.type && <span className="type-label" style={{ background: meta.color }}>{entry.type}</span>}
            {entry.date && <span className="date">{entry.date}</span>}
          </div>
          <h3>{entry.title}</h3>
        </div>
          <button
            className={`case-row-toggle${expanded ? " open" : ""}`}
            onClick={handleToggle}
            aria-label={expanded ? "Collapse" : "Show skills and tools"}
          >
            <svg viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1l4 4 4-4"/>
            </svg>
          </button>
      </div>
      {expanded && (
        <div className="case-row-chips">
          <div className="case-row-chip-group">
            <span className="case-row-chip-label">Skills</span>
            <div className="case-row-chip-list">
              {entry.skills.length > 0
                ? entry.skills.map(s => <span className="mini-label" key={s} style={{ color: meta.color, borderColor: `${meta.color}30`, background: meta.bg }}>{s}</span>)
                : <span className="meta-field-empty">—</span>}
            </div>
          </div>
          <div className="case-row-chip-group">
            <span className="case-row-chip-label">Tools</span>
            <div className="case-row-chip-list">
              {entry.tools.length > 0
                ? entry.tools.map(t => <span className="mini-label tool-chip" key={t}>{t}</span>)
                : <span className="meta-field-empty">—</span>}
            </div>
          </div>
        </div>
      )}
    </a>
  );
}

// ── Code block with copy button ──────────────────────────

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef(null);

  function handleCopy() {
    const text = preRef.current?.innerText || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="code-block-wrap">
      <pre ref={preRef}>{children}</pre>
      <button className={`copy-btn${copied ? " copied" : ""}`} onClick={handleCopy} type="button">
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

// ── Code/query block ──────────────────────────────────────

function detectCodeLang(text) {
  if (!text || text.length < 2) return null;
  // XML / config markup
  if (/^<[!?\/]?\w/.test(text) || /^<!--/.test(text))
    return "xml";
  // KQL / SIEM (needs length to avoid false positives)
  if (text.length >= 5 && /[\w\.]+\s*:\s*["*\w\[\(\\]/.test(text) && /(AND|OR|NOT|\*|\|{2}|&&)/.test(text))
    return "kql";
  // PowerShell cmdlets
  if (/^(Get|Set|New|Remove|Invoke|Start|Stop|Write|Read|Import|Export|Add|Clear|Copy|Move|Rename|Test|Update|Find|Select|Where|ForEach|Sort|Convert|Format|Out|Register|Enable|Disable|Connect)-\w+/.test(text))
    return "powershell";
  // PowerShell variables, loops, control flow
  if (/^\$\w+/.test(text))
    return "powershell";
  if (/^(foreach|if|elseif|else|while|do|switch|try|catch|finally|function|param|return)\s*[\(\{$]/.test(text))
    return "powershell";
  // Python
  if (/^(import |from \w+ import|def |class |print\(|if __name__|for \w+ in |while |try:|except|with )/.test(text))
    return "python";
  // YAML config
  if (text.length >= 3 && (
    /^\w[\w\._-]*:\s*$/.test(text) ||
    /^\w[\w\._-]*:\s*(["'\[\{]|true|false|none|\d)/.test(text) ||
    /^-\s+\w[\w\._-]*:\s*(["'\[\{]|\w)/.test(text)))
    return "yaml";
  // Bash / shell
  if (/^(sudo |apt |yum |pip |pip3 |npm |git |curl |wget |chmod |chown |mkdir |grep |awk |sed |cat |echo |sh |bash |python3? |docker[ -]|docker-compose |kubectl |wsl |cp |mv |rm |tar |ssh |scp )/.test(text))
    return "bash";
  // Short unambiguous shell commands
  if (/^(ls|pwd|wsl|man)(\s.*)?$/.test(text))
    return "bash";
  // Windows CMD / msiexec / NET / reg etc.
  if (/^(msiexec|NET |net |REG |reg add|reg delete|sc |icacls|netsh|wmic|runas)\s/i.test(text))
    return "cmd";
  if ((/^[A-Za-z]:\\/.test(text) || /^\.[\\\/]/.test(text)) && /\.(exe|bat|ps1|cmd|msi)\b/.test(text))
    return "cmd";
  // Generic: function call or assignment
  if (text.length >= 5 && (/^\w[\w\.]+\(.*\)$/.test(text) || /^\w+ ?= ?("|'|\[|\{|\()/.test(text)))
    return "code";
  return null;
}

function QueryBlock({ text, lang = "kql" }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }
  return (
    <div className="query-block">
      <div className="query-block-header">
        <span className="query-lang">{lang}</span>
        <button className="query-copy-btn" onClick={copy} type="button">
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="query-body"><code className="query-text">{text}</code></pre>
    </div>
  );
}

// Lines that look like code continuations (inside an already-started block)
function looksLikeCodeContinuation(text) {
  if (!text) return false;
  if (/^[{}]$/.test(text.trim())) return true;          // bare brace on its own line
  if (/^}\s*\|/.test(text)) return true;                // } | Cmdlet pipe
  if (/\$[A-Za-z_]\w*/.test(text)) return true;         // contains $variable (not currency)
  if (/^<[!?\/]?\w/.test(text) || /^<!--/.test(text)) return true; // XML element
  return false;
}

// Rehype plugin: merge consecutive code-like <p> into a single <pre> block
function rehypeMergeCodeBlocks() {
  function getText(node) {
    if (!node) return "";
    if (node.type === "text") return node.value || "";
    return (node.children || []).map(getText).join("");
  }
  function walk(node) {
    if (!node.children) return;
    const out = [];
    let i = 0;
    while (i < node.children.length) {
      const child = node.children[i];
      if (child.type === "element" && child.tagName === "p") {
        const text = getText(child).trim();
        const lang = detectCodeLang(text);
        if (lang) {
          const lines = [text];
          i++;
          while (i < node.children.length) {
            const next = node.children[i];
            if (next.type === "text" && !next.value.trim()) { i++; continue; }
            if (next.type === "element" && next.tagName === "p") {
              const nt = getText(next).trim();
              if (!nt) { i++; continue; } // skip blank paragraphs inside a code block
              if (detectCodeLang(nt) || looksLikeCodeContinuation(nt)) {
                lines.push(nt); i++; continue;
              }
            }
            break;
          }
          out.push({
            type: "element", tagName: "pre",
            properties: { dataLang: lang },
            children: [{ type: "element", tagName: "code", properties: {},
              children: [{ type: "text", value: lines.join("\n") }]
            }],
          });
          continue;
        }
      }
      walk(child);
      out.push(child);
      i++;
    }
    node.children = out;
  }
  return walk;
}

// ── Entry page ────────────────────────────────────────────

function EntryPage({ entry, navigateTo }) {
  const meta = CATEGORY_META[entry.categorySlug] || { label: entry.categorySlug, color: "var(--accent)" };
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setScrollPct(total > 0 ? (scrolled / total) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="progress-bar" style={{ width: `${scrollPct}%`, background: meta.color }} />
      <div className="entry-container">
        <button className="back-btn" onClick={() => navigateTo(`/${entry.categorySlug}`)} type="button"
          style={{ color: meta.color }}>
          ← {meta.label}
        </button>
        <div className="report-card">
        <article className="markdown-entry">
          <h1 className="entry-doc-title">{entry.displayTitle || entry.title}</h1>
          <div className="case-meta-strip">
            {entry.date && <span className="date">{entry.date}</span>}
            <span className="meta-field">
              <span className="meta-field-label">Skills:</span>
              {entry.skills.length > 0
                ? entry.skills.map(s => <span className="mini-label" key={s} style={{ color: meta.color, borderColor: `${meta.color}30`, background: meta.bg }}>{s}</span>)
                : <span className="meta-field-empty">—</span>}
            </span>
            <span className="meta-field">
              <span className="meta-field-label">Tools:</span>
              {entry.tools.length > 0
                ? entry.tools.map(t => <span className="mini-label tool-chip" key={t}>{t}</span>)
                : <span className="meta-field-empty">—</span>}
            </span>
          </div>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              p: ({ node, children }) => {
                function getText(n) {
                  if (!n) return "";
                  if (n.type === "text") return n.value || "";
                  return (n.children || []).map(getText).join("");
                }
                const text = getText(node).trim();
                // Section heading: only meaningful child is a <strong> (no trailing text)
                const meaningful = (node.children || []).filter(
                  c => c.type !== "text" || c.value?.trim() !== ""
                );
                const isSectionHeading = meaningful.length === 1 &&
                  meaningful[0].tagName === "strong";
                if (isSectionHeading) return <p className="entry-heading">{children}</p>;
                if (text === "↓") return <p className="flow-arrow">{children}</p>;
                return <p>{children}</p>;
              },
              table: ({ node, ...props }) => (
                <div className="data-table-wrap"><table className="data-table" {...props} /></div>
              ),
              pre: ({ node, children }) => {
                const lang = node?.properties?.dataLang;
                if (lang) {
                  function getT(n) {
                    if (!n) return "";
                    if (n.type === "text") return n.value || "";
                    return (n.children || []).map(getT).join("");
                  }
                  return <QueryBlock text={getT(node).trim()} lang={lang} />;
                }
                return <CodeBlock>{children}</CodeBlock>;
              },
              img: ({ node, src, alt, ...props }) => {
                const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                const resolved = src && !src.startsWith("http") && !src.startsWith("/")
                  ? `${base}/media/${src.replace(/^media\//, "")}`
                  : src;
                return (
                  <figure className="md-figure">
                    <img src={resolved} alt={alt} {...props} />
                    {alt && <figcaption>{alt}</figcaption>}
                  </figure>
                );
              },
            }}
          >
            {entry.content}
          </ReactMarkdown>
        </article>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
