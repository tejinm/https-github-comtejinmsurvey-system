const QRCode = require('qrcode');
const path   = require('path');
const fs     = require('fs');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR  = path.join(__dirname, 'data', 'qr-codes');

// ── Predefine all technician / unit / market combinations here ────────────────
const technicians = [
  { unit: 'baumeister',      market: 'DE', lang: 'de' },
  { unit: 'baumeister',      market: 'AT', lang: 'de' },
  { unit: 'dupont-services', market: 'FR', lang: 'fr' },
  { unit: 'smith-tech',      market: 'GB', lang: 'en' },
];

// Scan-prompt text per language (printed on the card)
const scanPrompt = { de: 'Scannen Sie, um unseren Service zu bewerten',
                     fr: 'Scannez pour évaluer notre service',
                     en: 'Scan to rate our service' };

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function generate() {
  for (const tech of technicians) {
    const { unit, market, lang } = tech;
    const params  = new URLSearchParams({ unit, market, lang });
    const url     = `${BASE_URL}/start?${params.toString()}`;
    const slug    = `${unit}-${market}`;
    const pngPath = path.join(OUT_DIR, `${slug}.png`);
    const htmPath = path.join(OUT_DIR, `${slug}-printsheet.html`);

    // Generate PNG
    await QRCode.toFile(pngPath, url, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    console.log(`QR PNG:        ${pngPath}`);

    // Generate base64 version for embedding in HTML
    const base64 = await QRCode.toDataURL(url, {
      width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Build self-contained print sheet
    const prompt  = scanPrompt[lang] || scanPrompt.en;
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>QR — ${unit} / ${market}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #fff;
    }
    .card {
      text-align: center;
      padding: 2.5rem 3rem;
      border: 2px solid #222;
      border-radius: 16px;
      width: 340px;
    }
    .card img { width: 220px; height: 220px; display: block; margin: 0 auto 1.5rem; }
    .prompt  { font-size: 1rem; font-weight: 500; color: #111; margin-bottom: 1rem; }
    .unit    { font-size: 1.4rem; font-weight: 700; color: #111; letter-spacing: 0.02em; }
    .market  { font-size: 1rem; color: #666; margin-top: 4px; }
    .url     { font-size: 0.65rem; color: #bbb; margin-top: 1.25rem; word-break: break-all; }
    @media print {
      body { min-height: unset; }
      .card { border: 1.5pt solid #000; page-break-inside: avoid; }
      .url  { display: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${base64}" alt="QR code for ${unit} ${market}">
    <p class="prompt">${prompt}</p>
    <p class="unit">${unit.toUpperCase()}</p>
    <p class="market">${market}</p>
    <p class="url">${url}</p>
  </div>
</body>
</html>`;

    fs.writeFileSync(htmPath, html, 'utf8');
    console.log(`Print sheet:   ${htmPath}`);
  }

  console.log(`\nDone — ${technicians.length} QR code(s) generated in ${OUT_DIR}`);
}

generate().catch(err => {
  console.error('QR generation failed:', err);
  process.exit(1);
});
