/**
 * PORTFOLIO VISITOR LOG - Google Apps Script backend
 * ===================================================
 * Receives visits from the Netlify function (netlify/functions/visit.mjs),
 * writes one row per visit to this Google Sheet, and emails you about the
 * visits worth knowing about.
 *
 * DO NOT commit your real SECRET or email back into GitHub. Fill them in
 * only inside the Apps Script editor.
 *
 * SETUP (in order)
 *  1. Create a Google Sheet -> Extensions -> Apps Script. Delete the sample
 *     code and paste this whole file.
 *  2. Set SECRET (a long random string) and NOTIFY_EMAIL below. Ctrl+S.
 *  3. Choose "testSetup" in the toolbar and click Run. Approve permissions:
 *     "Google hasn't verified this app" -> Advanced -> Go to (project) (unsafe)
 *     -> Allow. Tick ALL boxes, including "send email". You should get a
 *     test row in the "Visits" tab and a test email.
 *  4. Deploy -> New deployment -> type "Web app".
 *     Execute as: Me. Who has access: Anyone. Deploy, copy the URL ending /exec.
 *     (After editing this script later: Deploy -> Manage deployments -> edit
 *      -> Version: New version, so the same URL runs the new code.)
 *  5. Netlify -> Site configuration -> Environment variables:
 *       VISIT_SHEET_URL    = the /exec URL
 *       VISIT_SHEET_SECRET = the same SECRET (tick "Contains secret values")
 *     Then Deploys -> Trigger deploy, and wait for "Published".
 *  6. Open your site with ?notrack at the end on each of your own devices.
 *  7. Test in an incognito window: browse for over a minute, close the tab,
 *     check the sheet for a new row. Delete the test rows afterwards.
 *  8. Gmail filter so alerts never go to Spam: From: (this Google account),
 *     Subject: Portfolio visit -> Create filter -> "Never send it to Spam".
 */

const SECRET = "PASTE-A-LONG-RANDOM-SECRET-HERE";
const NOTIFY_EMAIL = "you@example.com";
const SHEET_NAME = "Visits";
const NOTABLE_SECONDS = 60;

// [header, key in the visit object]
const COLUMNS = [
  ["Session ID", "sessionId"],
  ["First logged", "_created"],
  ["Last update", "_updated"],
  ["Visitor ID", "visitorId"],
  ["Visitor", "_visitorType"],
  ["Visit #", "visitCount"],
  ["First seen", "firstSeen"],
  ["Source", "source"],
  ["Recruiting site", "recruiting"],
  ["Referrer", "referrer"],
  ["UTM", "_utm"],
  ["Landing page", "landingPage"],
  ["Pages viewed", "pagesViewed"],
  ["Posts opened (scroll %)", "postsOpened"],
  ["Contact clicks", "contactClicks"],
  ["Downloads", "downloads"],
  ["Active time (s)", "activeSeconds"],
  ["City", "city"],
  ["Region", "region"],
  ["Country", "country"],
  ["Network", "network"],
  ["Device", "device"],
  ["Screen", "screen"],
  ["Language", "language"],
  ["Timezone", "timezone"],
  ["Updates", "seq"],
  ["Emailed", "_emailed"],
];

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_("bad request");
  }
  if (!body || body.secret !== SECRET || SECRET.indexOf("PASTE-") === 0) return reply_("forbidden");
  if (!body.visit || !body.visit.sessionId) return reply_("bad request");

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    saveVisit_(body.visit);
  } finally {
    lock.releaseLock();
  }
  return reply_("ok");
}

function saveVisit_(v) {
  const sheet = getSheet_();
  const now = new Date();

  v._visitorType = v.returning ? "Returning" : "New";
  v._utm = [v.utmSource, v.utmMedium, v.utmCampaign].filter(String).join(" / ");
  v._updated = now;

  // Upsert: find this session's row
  const idCol = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1);
  const found = idCol.createTextFinder(String(v.sessionId)).matchEntireCell(true).findNext();
  const rowIndex = found ? found.getRow() : sheet.getLastRow() + 1;
  const existing = found
    ? sheet.getRange(rowIndex, 1, 1, COLUMNS.length).getValues()[0]
    : COLUMNS.map(() => "");

  if (!found) v._created = now;

  const row = COLUMNS.map(function (col, i) {
    const key = col[1];
    if (key === "_emailed") return existing[i];
    const value = v[key];
    const empty = value === undefined || value === null || value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (empty) return existing[i];          // never wipe a value with an empty update
    return safe_(value);
  });

  const emailedIdx = COLUMNS.findIndex(function (c) { return c[1] === "_emailed"; });
  if (!row[emailedIdx]) {
    const reasons = notableReasons_(v);
    if (reasons.length) {
      sendAlert_(v, reasons);
      row[emailedIdx] = now;
    }
  }

  sheet.getRange(rowIndex, 1, 1, COLUMNS.length).setValues([row]);
}

function notableReasons_(v) {
  const reasons = [];
  if (v.returning) reasons.push("Returning visitor (visit #" + v.visitCount + ")");
  if (v.recruiting) reasons.push("Came from " + v.source);
  if ((v.activeSeconds || 0) >= NOTABLE_SECONDS) reasons.push("Stayed " + v.activeSeconds + "s");
  if (v.downloads && v.downloads.length) reasons.push("Downloaded " + v.downloads.join(", "));
  if (v.contactClicks && v.contactClicks.length) reasons.push("Contact: " + v.contactClicks.join(", "));
  return reasons;
}

function sendAlert_(v, reasons) {
  const where = [v.city, v.region, v.country].filter(String).join(", ") || "Unknown location";
  const lines = [
    "Why: " + reasons.join("; "),
    "",
    "From: " + where + (v.network ? " (" + v.network + ")" : ""),
    "Source: " + (v.source || "Direct") + (v.referrer ? " - " + v.referrer : ""),
    "Device: " + (v.device || ""),
    "Active time: " + (v.activeSeconds || 0) + "s",
    "Pages: " + (v.pagesViewed || []).join(", "),
    "Posts: " + (v.postsOpened || []).join(", "),
    "Contact clicks: " + ((v.contactClicks || []).join(", ") || "none"),
    "",
    "Sheet: " + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  ];
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: "Portfolio visit: " + where + " - " + reasons[0],
    body: lines.join("\n"),
  });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS.map(function (c) { return c[0]; }));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold");
  }
  return sheet;
}

// Formula-injection protection + list flattening
function safe_(value) {
  if (Array.isArray(value)) value = value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(value)) return "'" + value;
  return value;
}

function reply_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}

// Run once from the editor (step 3) to grant permissions and check everything.
function testSetup() {
  const result = doPost({
    postData: {
      contents: JSON.stringify({
        secret: SECRET,
        visit: {
          sessionId: "s-test-" + Date.now(),
          visitorId: "v-test",
          visitCount: 2,
          returning: true,
          firstSeen: new Date().toISOString(),
          landingPage: "/",
          pagesViewed: ["/", "/siem"],
          postsOpened: ["/siem/test-post (80%)"],
          contactClicks: ["LinkedIn"],
          activeSeconds: 75,
          source: "LinkedIn",
          recruiting: true,
          city: "Test City",
          country: "Test Country",
          device: "Windows - Chrome",
          seq: 1,
        },
      }),
    },
  });
  Logger.log("Result: " + result.getContent() + " (should be ok). Check the sheet and your inbox.");
}
