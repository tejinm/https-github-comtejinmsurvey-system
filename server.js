const express    = require('express');
const crypto     = require('crypto');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml   = require('sanitize-html');
const path       = require('path');
require('dotenv').config();

const {
  insertResponse, getAllResponses,
  getResponsesByUnit, getResponsesByMarket, getResponsesByUnitAndMarket,
  isDuplicateKey, getDistinctUnits, getDistinctMarkets,
} = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Survey routes ─────────────────────────────────────────────────────────────

app.get('/start', (req, res) => {
  const { lang, unit, market } = req.query;
  const params = new URLSearchParams({ unit: unit||'', market: market||'', lang: lang||'en' });
  const target = { de:'de', fr:'fr' }[lang] || 'en';
  res.redirect(`/survey/${target}?${params.toString()}`);
});

app.get('/survey/de', (req, res) => res.sendFile(path.join(__dirname, 'surveys', 'survey-de.html')));
app.get('/survey/en', (req, res) => res.sendFile(path.join(__dirname, 'surveys', 'survey-en.html')));
app.get('/survey/fr', (req, res) => res.sendFile(path.join(__dirname, 'surveys', 'survey-fr.html')));

// ── Submission API ────────────────────────────────────────────────────────────

app.post('/api/submit', (req, res) => {
  try {
    const {
      unit, market, lang,
      q1_resolved, q2_satisfaction, q3_professionalism, q3_comment,
      q4_ease, q5_time, q6_improvement, nps_score,
    } = req.body;

    if (!unit || typeof unit !== 'string' || !unit.trim())
      return res.status(400).json({ error: 'Missing required field: unit' });
    if (!market || typeof market !== 'string' || !market.trim())
      return res.status(400).json({ error: 'Missing required field: market' });
    if (!q1_resolved)
      return res.status(400).json({ error: 'Please answer question 1' });

    const ip      = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ipHash  = crypto.createHash('sha256').update(ip).digest('hex');
    const dedupe  = crypto.createHash('sha256')
      .update(`${unit.toLowerCase()}-${market.toUpperCase()}-${Math.floor(Date.now()/60000)}`)
      .digest('hex');

    if (isDuplicateKey(dedupe))
      return res.status(200).json({ success: true, note: 'duplicate' });

    const clean = (v) => v ? sanitizeHtml(v, { allowedTags:[], allowedAttributes:{} }).trim() : null;

    const record = {
      survey_id:          uuidv4(),
      unit:               unit.toLowerCase().trim(),
      market:             market.toUpperCase().trim(),
      lang:               (lang||'en').toLowerCase().trim(),
      q1_resolved:        q1_resolved || null,
      q2_satisfaction:    q2_satisfaction    ? parseInt(q2_satisfaction)    : null,
      q3_professionalism: q3_professionalism ? parseInt(q3_professionalism) : null,
      q3_comment:         clean(q3_comment),
      q4_ease:            q4_ease  ? parseInt(q4_ease)  : null,
      q5_time:            q5_time  ? parseInt(q5_time)  : null,
      q6_improvement:     clean(q6_improvement),
      nps_score:          (nps_score !== null && nps_score !== undefined && nps_score !== '') ? parseInt(nps_score) : null,
      submitted_at:       new Date().toISOString(),
      ip_hash:            ipHash,
      dedupe_key:         dedupe,
    };

    insertResponse(record);
    console.log(`Survey submitted: ${record.survey_id} | unit=${record.unit} | market=${record.market} | NPS=${record.nps_score}`);
    return res.status(201).json({ success: true, survey_id: record.survey_id });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Results viewer ────────────────────────────────────────────────────────────

app.get('/results', (req, res) => {
  const { unit, market } = req.query;
  let responses;
  if (unit && market)   responses = getResponsesByUnitAndMarket(unit, market);
  else if (unit)        responses = getResponsesByUnit(unit);
  else if (market)      responses = getResponsesByMarket(market);
  else                  responses = getAllResponses();

  const units   = getDistinctUnits();
  const markets = getDistinctMarkets();

  const stars   = (n) => n ? '★'.repeat(n)+'☆'.repeat(5-n) : '—';
  const fmt     = (iso) => iso ? iso.replace('T',' ').substring(0,16) : '—';
  const resolved = (v) => ({ yes:'✓ Yes', partially:'~ Partially', no:'✗ No' }[v] || '—');
  const npsColor = (n) => n === null || n === undefined ? '' :
    n >= 9 ? 'color:#16a34a' : n >= 7 ? 'color:#d97706' : 'color:#dc2626';

  const rows = responses.map(r => `
    <tr>
      <td>${fmt(r.submitted_at)}</td>
      <td><strong>${r.unit}</strong></td>
      <td>${r.market}</td>
      <td>${r.lang}</td>
      <td>${resolved(r.q1_resolved)}</td>
      <td class="stars">${stars(r.q2_satisfaction)}</td>
      <td class="stars">${stars(r.q3_professionalism)}</td>
      <td class="stars">${stars(r.q4_ease)}</td>
      <td class="stars">${stars(r.q5_time)}</td>
      <td style="${npsColor(r.nps_score)};font-weight:600">${r.nps_score !== null && r.nps_score !== undefined ? r.nps_score : '—'}</td>
      <td>${r.q3_comment||''}</td>
      <td>${r.q6_improvement||''}</td>
    </tr>`).join('');

  const uOpts = units.map(u   => `<option value="${u}" ${u===unit?'selected':''}>${u}</option>`).join('');
  const mOpts = markets.map(m => `<option value="${m}" ${m===market?'selected':''}>${m}</option>`).join('');

  res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Survey Results</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:system-ui,sans-serif;padding:2rem;background:#f5f5f5;color:#333;}
  h1{margin-bottom:1.5rem;font-size:1.4rem;color:#1a1a2e;}
  form{background:#fff;padding:1rem 1.5rem;border-radius:10px;border:1px solid #e0e0e0;display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:1.5rem;}
  label{font-size:.82rem;color:#666;display:block;margin-bottom:4px;}
  select{padding:7px 10px;border:1px solid #ccc;border-radius:7px;font-size:.9rem;}
  button{padding:7px 16px;background:#00B09B;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:.9rem;}
  button.clear{background:#fff;color:#333;border:1px solid #ccc;}
  .count{font-size:.88rem;color:#666;margin-bottom:.75rem;}
  .wrap{overflow-x:auto;}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0;min-width:900px;}
  th{background:#1a1a2e;color:#fff;padding:10px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;}
  td{padding:9px 12px;border-bottom:1px solid #eee;font-size:.85rem;vertical-align:top;}
  tr:last-child td{border-bottom:none;}
  tr:hover td{background:#fafafa;}
  .stars{color:#f59e0b;letter-spacing:1px;}
  .empty{text-align:center;padding:3rem;color:#999;}
</style>
</head><body>
<h1>Survey Results — Hisense Europe</h1>
<form method="GET" action="/results">
  <div><label>Service Unit</label><select name="unit"><option value="">All units</option>${uOpts}</select></div>
  <div><label>Market</label><select name="market"><option value="">All markets</option>${mOpts}</select></div>
  <button type="submit">Filter</button>
  <a href="/results"><button type="button" class="clear">Clear</button></a>
</form>
<p class="count">${responses.length} response${responses.length!==1?'s':''}</p>
<div class="wrap"><table>
  <thead><tr>
    <th>Submitted</th><th>Unit</th><th>Market</th><th>Lang</th>
    <th>Resolved?</th><th>Satisfaction</th><th>Professionalism</th>
    <th>Ease</th><th>Time</th><th>NPS</th><th>Tech comment</th><th>Improvement</th>
  </tr></thead>
  <tbody>${rows||'<tr><td colspan="12" class="empty">No responses yet.</td></tr>'}</tbody>
</table></div>
</body></html>`);
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Test survey: http://localhost:${PORT}/survey/de?unit=baumeister&market=DE&lang=de`);
  console.log(`Results:     http://localhost:${PORT}/results`);
});
