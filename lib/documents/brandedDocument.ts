/**
 * Printable Mboka documents — bank letters and payment receipts.
 *
 * These leave the product: a counterparty's bank sees them, so they carry the
 * brand rather than the dashboard's chrome. The document is standalone, so it
 * uses the kit's literal hexes instead of the theme's custom properties, and
 * embeds the Chamfer mark inline rather than linking an asset (a saved file
 * with a broken <img> is worse than no mark at all).
 *
 * Colour tokens: indigo #3B2ED3 · ink #131126 · bone #F6F4EF.
 * The back block always sits at 45% opacity of the front.
 */

export type DocumentRow = {
  label: string;
  value: string;
  /** Account numbers, IBANs, references — set in DM Mono. */
  mono?: boolean;
};

export type DocumentSection = {
  title: string;
  rows: DocumentRow[];
};

export type BrandedDocument = {
  /** Browser/window title and the PDF's default filename. */
  fileTitle: string;
  /** Large heading inside the document. */
  heading: string;
  subheading?: string;
  /** Hero figure — the amount on a receipt. Omitted on letters. */
  amount?: string;
  amountCaption?: string;
  sections: DocumentSection[];
  footnote?: string;
};

const MARK = `<svg viewBox="0 0 44 44" width="34" height="34" aria-hidden="true"><rect width="44" height="44" rx="11" fill="#3B2ED3"></rect><path d="M24 18H35V35H18V24Z" fill="#FFFFFF" fill-opacity="0.45"></path><path d="M9 9H26V20L20 26H9Z" fill="#FFFFFF"></path></svg>`;

/** Values come from user input and API responses — never interpolate raw. */
function esc(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRow(row: DocumentRow): string {
  return `<tr><th>${esc(row.label)}</th><td${row.mono ? ' class="mono"' : ""}>${esc(row.value)}</td></tr>`;
}

function renderSection(section: DocumentSection): string {
  if (!section.rows.length) return "";
  return `<section><h2>${esc(section.title)}</h2><table>${section.rows.map(renderRow).join("")}</table></section>`;
}

export function renderBrandedDocument(doc: BrandedDocument): string {
  const generated = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.fileTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --indigo:#3B2ED3; --ink:#131126; --bone:#F6F4EF; --muted:#4C4A66; --muted2:#8B89A6; --line:rgba(19,17,38,0.10); }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bone); color:var(--ink);
         font-family:'DM Sans', system-ui, -apple-system, sans-serif;
         -webkit-font-smoothing:antialiased; padding:32px 20px; }
  .sheet { max-width:640px; margin:0 auto; background:#fff; border:1px solid var(--line);
           border-radius:20px; padding:36px 34px; }
  /* Clear space around the lockup equals a quarter of the mark's height. */
  .brand { display:flex; align-items:center; gap:11px; padding-bottom:9px; }
  .brand__word { font-family:'Space Grotesk', system-ui, sans-serif; font-weight:600;
                 text-transform:uppercase; letter-spacing:0.04em; font-size:16px; }
  h1 { font-family:'Space Grotesk', system-ui, sans-serif; font-size:24px; font-weight:700;
       letter-spacing:-0.02em; margin:22px 0 4px; }
  .sub { color:var(--muted); font-size:13.5px; margin:0; }
  .amount { font-family:'DM Mono', ui-monospace, monospace; font-size:34px; font-weight:500;
            letter-spacing:-0.02em; margin:22px 0 2px; }
  .amount-caption { color:var(--muted); font-size:12.5px; margin:0 0 4px; }
  section { margin-top:26px; }
  h2 { font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
       color:var(--muted2); margin:0 0 8px; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; font-size:13.5px; padding:9px 0; border-bottom:1px solid var(--line);
           vertical-align:top; }
  th { font-weight:500; color:var(--muted); width:44%; }
  td { font-weight:600; word-break:break-word; }
  td.mono { font-family:'DM Mono', ui-monospace, monospace; font-weight:500; }
  tr:last-child th, tr:last-child td { border-bottom:none; }
  footer { margin-top:28px; padding-top:16px; border-top:1px solid var(--line);
           color:var(--muted2); font-size:11.5px; line-height:1.6; }
  @media print {
    body { background:#fff; padding:0; }
    .sheet { border:none; border-radius:0; max-width:none; padding:24px 0; }
  }
</style></head>
<body>
  <main class="sheet">
    <div class="brand">${MARK}<span class="brand__word">Mboka</span></div>
    <h1>${esc(doc.heading)}</h1>
    ${doc.subheading ? `<p class="sub">${esc(doc.subheading)}</p>` : ""}
    ${doc.amount ? `<p class="amount">${esc(doc.amount)}</p>` : ""}
    ${doc.amountCaption ? `<p class="amount-caption">${esc(doc.amountCaption)}</p>` : ""}
    ${doc.sections.map(renderSection).join("")}
    <footer>
      Generated ${esc(generated)} from your Mboka dashboard.
      ${doc.footnote ? esc(doc.footnote) : ""}
    </footer>
  </main>
</body></html>`;
}

/**
 * Open the document in a new tab so the browser's own "Save as PDF" handles
 * the export — no PDF dependency, and the user gets a real PDF rather than a
 * text file. Falls back to downloading the HTML when popups are blocked.
 */
export function openBrandedDocument(doc: BrandedDocument, filenameStem: string): void {
  const html = renderBrandedDocument(doc);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (win) {
    win.document.write(html);
    win.document.close();
    return;
  }
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameStem}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
