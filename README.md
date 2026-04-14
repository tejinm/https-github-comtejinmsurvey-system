# Survey System

Customer satisfaction survey system with QR code support.
Each QR code embeds a service unit and market identifier — responses in the
database are automatically tagged with where they came from.

---

## Setup

```bash
npm install
node qr-generator.js    # generates QR codes into /data/qr-codes/
npm start               # starts server on http://localhost:3000
```

---

## Test the full flow

1. Open a survey as if you were a customer who just scanned a QR code:
   - German  → http://localhost:3000/survey/de?unit=baumeister&market=DE&lang=de
   - English → http://localhost:3000/survey/en?unit=smith-tech&market=GB&lang=en
   - French  → http://localhost:3000/survey/fr?unit=dupont-services&market=FR&lang=fr

2. Fill out the form and submit.

3. View results → http://localhost:3000/results
   Use the Unit / Market dropdowns to filter.

---

## Test the API directly with curl

```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "unit":          "baumeister",
    "market":        "DE",
    "lang":          "de",
    "q1_overall":    5,
    "q2_timeliness": 4,
    "q3_recommend":  5,
    "comments":      "Sehr schnell und professionell"
  }'
```

---

## QR codes

Generated files live in `/data/qr-codes/`:
- `{unit}-{market}.png`             ← raw QR image (for digital use)
- `{unit}-{market}-printsheet.html` ← self-contained print card (open in browser → Ctrl+P)

To add a new unit or market, edit the `technicians` array in `qr-generator.js`
and re-run `node qr-generator.js`.

---

## Project structure

```
survey-system/
  server.js          ← Express server, API, results viewer
  db.js              ← SQLite database layer
  qr-generator.js    ← QR code + print sheet generator
  surveys/
    survey-de.html   ← German survey
    survey-en.html   ← English survey
    survey-fr.html   ← French survey
  data/
    surveys.db       ← SQLite database (auto-created)
    qr-codes/        ← generated QR images and print sheets
  .env               ← PORT, DB_PATH, BASE_URL
```
