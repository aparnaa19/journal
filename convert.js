// Usage: node convert.js <path-to-docx> <category>
// Example: node convert.js "C:/Users/me/Downloads/writeup.docx" endpoint
//
// Categories: homelab, endpoint, network-security, siem,
//             vulnerability-management, threat-intelligence, incident-response, identity-account

const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const [,, docxPath, category] = process.argv;

const CATEGORIES = [
  "homelab", "endpoint", "network-security", "siem",
  "vulnerability-management", "threat-intelligence", "incident-response", "identity-account"
];

if (!docxPath || !category) {
  console.log("\nUsage:  node convert.js <path-to-docx> <category>");
  console.log("Example: node convert.js \"C:/Downloads/my-writeup.docx\" endpoint\n");
  console.log("Categories:", CATEGORIES.join(", "));
  process.exit(1);
}

if (!CATEGORIES.includes(category)) {
  console.error(`\nUnknown category "${category}". Valid options:\n${CATEGORIES.join(", ")}\n`);
  process.exit(1);
}

if (!fs.existsSync(docxPath)) {
  console.error(`\nFile not found: ${docxPath}\n`);
  process.exit(1);
}

const mediaDir = path.join(__dirname, "public", "media");
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

const contentDir = path.join(__dirname, "content", category);
if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

const rawName = path.basename(docxPath, ".docx");
const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const outPath = path.join(contentDir, `${slug}.md`);

let imgCount = 0;

const options = {
  styleMap: [
    "p[style-name='Heading 1'] => h2:fresh",
    "p[style-name='Heading 2'] => h3:fresh",
    "p[style-name='Heading 3'] => h4:fresh",
    "p[style-name='Heading 4'] => h5:fresh",
    "p[style-name='Code'] => pre",
    "p[style-name='Code Block'] => pre",
    "p[style-name='Preformatted Text'] => pre",
    "r[style-name='Code Char'] => code",
    "r[style-name='Inline Code'] => code",
  ],
  convertImage: mammoth.images.imgElement(function (image) {
    return image.read("base64").then(function (data) {
      const ext = (image.contentType || "image/png").split("/")[1].split(";")[0] || "png";
      const filename = `${slug}-${++imgCount}.${ext}`;
      fs.writeFileSync(path.join(mediaDir, filename), Buffer.from(data, "base64"));
      return { src: `media/${filename}` };
    });
  }),
};

mammoth.convertToHtml({ path: docxPath }, options).then(function (result) {
  const title = rawName.replace(/[-_]/g, " ");
  let html = result.value;

  // Extract the Word document's own title (first heading or bold paragraph)
  const headingMatch = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
  const boldMatch = html.match(/<p><strong>([\s\S]*?)<\/strong><\/p>/);
  const rawDisplayTitle = (headingMatch || boldMatch || [null, ""])[1] || "";
  const displayTitle = rawDisplayTitle.replace(/<[^>]+>/g, "").trim();

  // Strip duplicate title paragraph (mammoth echoes the doc title as first bold paragraph)
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  html = html.replace(new RegExp(`<p><strong>${escapedTitle}<\\/strong><\\/p>\\s*`, "gi"), "");

  // Demote headings by one level (h1→h2, h2→h3 etc.) so they don't collide with page title style
  html = html.replace(/<(\/?)h([1-5])(\s|>)/g, (_, slash, n, rest) => `<${slash}h${+n + 1}${rest}`);

  // Convert ```lang ... ``` fences (written in Word) into <pre data-lang> blocks
  html = html.replace(/<p>```(\w*)<\/p>([\s\S]*?)<p>```<\/p>/g, function(_, lang, inner) {
    const lines = [];
    inner.replace(/<p>([\s\S]*?)<\/p>/g, function(__, line) {
      lines.push(line.replace(/<[^>]+>/g, ""));
    });
    const attr = lang ? ` data-lang="${lang}"` : "";
    return `<pre${attr}><code>${lines.join("\n")}</code></pre>`;
  });

  // Strip LAB / WRITEUP / CVE REPORT type markers
  html = html.replace(/<p><strong>(LAB|WRITEUP|CVE REPORT)<\/strong><\/p>\s*/gi, "");

  const header = [
    `# ${title}`,
    `display_title: ${displayTitle || title}`,
    `skills: `,
    `tools: `,
    ``,
  ].join("\n");

  fs.writeFileSync(outPath, header + "\n" + html);

  console.log(`\n✓ Saved:  content/${category}/${slug}.md`);
  if (imgCount > 0) console.log(`✓ Images: ${imgCount} image(s) saved to public/media/`);
  console.log(`\nOpen the file and fill in the skills: and tools: lines at the top.\n`);

  if (result.messages.length > 0) {
    console.log("Warnings:");
    result.messages.forEach(m => console.log(" -", m.message));
  }
}).catch(function (err) {
  console.error("Conversion failed:", err.message);
  process.exit(1);
});
