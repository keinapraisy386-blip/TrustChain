'use strict';
/* TrustChain demo backend: Node built-ins only (no npm install needed).
   Simulated hash-linked ledger stored in data/ledger.json. NOT a real blockchain. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data', 'ledger.json');
const PUB = path.join(__dirname, 'public');
const CAMPS = ['edu', 'med', 'dis'];
const ZERO = '0'.repeat(64);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const rid = n => crypto.randomBytes(n).toString('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hashOf = b => sha(JSON.stringify([b.index, b.prev, b.type, b.camp || '', b.amount, b.ts, b.tx, b.evHash || '']));
const money = n => '₹' + Number(n).toLocaleString('en-IN');

/* ---------- ledger ---------- */
let blocks = [];
function persist() { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA, JSON.stringify({ blocks })); }
function addBlock(r) {
  const p = blocks[blocks.length - 1];
  const b = { index: blocks.length, no: 4820100 + blocks.length, prev: p ? p.hash : ZERO, tx: '0x' + rid(20),
    ts: new Date().toISOString(), status: r.type === 'Donation' ? 'Demo Transaction Confirmed' : 'Demo Record Confirmed', ...r };
  b.hash = hashOf(b); blocks.push(b); return b;
}
function demoDist(c, a, p, ts) {
  const text = `TRUSTCHAIN DEMO RECEIPT\nCampaign: ${c}\nAmount: ${money(a)}\nPurpose: ${p}\nDate: ${ts.slice(0, 10)}\nVendor: Sample Vendor Pvt Ltd (fictional)\nRef: ${rid(6)}`;
  return addBlock({ type: 'Distribution', camp: c, amount: a, ts, purpose: p, evName: 'demo-receipt-' + blocks.length + '.txt', evText: text, evHash: sha(text) });
}
const SEED = [['Donation', 'edu', 125000, 12], ['Donation', 'med', 150000, 11], ['Donation', 'dis', 220000, 10], ['Donation', 'edu', 98000, 8],
  ['Distribution', 'edu', 80000, 6, 'Scholarship fees for 40 students'], ['Donation', 'med', 110000, 5],
  ['Distribution', 'med', 90000, 4, 'Dialysis sessions for 12 patients'], ['Donation', 'dis', 145000, 3],
  ['Distribution', 'dis', 150000, 2, 'Food kits and drinking water for 600 families'], ['Donation', 'edu', 60000, 1]];
const MORE = [['Donation', 'edu', 25000], ['Donation', 'med', 40000], ['Donation', 'dis', 75000], ['Donation', 'dis', 18000],
  ['Distribution', 'dis', 60000, 'Temporary shelter tarpaulins'], ['Donation', 'med', 12500]];
const ago = d => new Date(Date.now() - d * 864e5 - Math.random() * 3e7).toISOString();
function seed() {
  blocks = [];
  addBlock({ type: 'Genesis', camp: '', amount: 0, ts: ago(14), status: 'Demo Genesis Block' });
  for (const [t, c, a, d, p] of SEED) t === 'Donation' ? addBlock({ type: t, camp: c, amount: a, ts: ago(d), donor: 'Anonymous demo donor' }) : demoDist(c, a, p, ago(d));
  persist();
}
function balance(c) {
  return blocks.reduce((s, b) => b.camp !== c ? s : b.type === 'Donation' ? s + b.amount : b.type === 'Distribution' ? s - b.amount : s, 0);
}
function verifyChain() {
  for (let i = 0; i < blocks.length; i++)
    if (hashOf(blocks[i]) !== blocks[i].hash || blocks[i].prev !== (i ? blocks[i - 1].hash : ZERO)) return { ok: false, brokenAt: blocks[i].no };
  return { ok: true, blocks: blocks.length };
}
try { blocks = JSON.parse(fs.readFileSync(DATA, 'utf8')).blocks; } catch (e) {}
if (!blocks.length) seed();

/* ---------- API ---------- */
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const API = {
  'GET /api/state': () => ({ blocks }),
  'GET /api/verify-chain': () => verifyChain(),
  'POST /api/donate': async body => {
    const a = Number(body.amount);
    if (!CAMPS.includes(body.camp)) throw new HttpError(400, 'Unknown campaign.');
    if (!Number.isInteger(a) || a < 1 || a > 1000000) throw new HttpError(400, 'Donation must be a whole amount between ₹1 and ₹10,00,000.');
    await sleep(800); // simulated block confirmation delay
    const b = addBlock({ type: 'Donation', camp: body.camp, amount: a, donor: 'Demo donor' }); persist(); return b;
  },
  'POST /api/distribute': body => {
    const a = Number(body.amount), purpose = String(body.purpose || '').trim(), d = String(body.date || '');
    if (!CAMPS.includes(body.camp)) throw new HttpError(400, 'Unknown campaign.');
    if (!Number.isInteger(a) || a < 1) throw new HttpError(400, 'Distribution amount must be a whole number of at least ₹1.');
    if (a > balance(body.camp)) throw new HttpError(400, `Amount exceeds the available balance of ${money(balance(body.camp))} for this campaign.`);
    if (!purpose || purpose.length > 120) throw new HttpError(400, 'Purpose is required (maximum 120 characters).');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))) throw new HttpError(400, 'Choose a valid date.');
    if (!/^[0-9a-f]{64}$/.test(String(body.evHash))) throw new HttpError(400, 'Evidence hash must be a SHA-256 hex string.');
    const b = addBlock({ type: 'Distribution', camp: body.camp, amount: a, ts: new Date(d + 'T12:00:00').toISOString(), purpose,
      evName: String(body.evName || 'evidence').slice(0, 100), evHash: body.evHash,
      ...(typeof body.evText === 'string' && body.evText.length < 2000 ? { evText: body.evText } : {}) });
    persist(); return b;
  },
  'POST /api/sample': () => {
    for (const [t, c, a, p] of MORE) {
      if (t === 'Donation') addBlock({ type: t, camp: c, amount: a, donor: 'Anonymous demo donor' });
      else if (balance(c) >= a) demoDist(c, a, p, new Date().toISOString());
    }
    persist(); return { ok: true };
  },
  'POST /api/reset': () => { seed(); return { ok: true }; }
};

/* ---------- server ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
function readBody(req) {
  return new Promise((ok, no) => {
    let s = ''; req.on('data', c => { s += c; if (s.length > 1e5) { no(new HttpError(413, 'Request too large.')); req.destroy(); } });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(new HttpError(400, 'Invalid JSON.')); } });
  });
}
http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url.startsWith('/api/')) {
      const h = API[req.method + ' ' + url];
      if (!h) throw new HttpError(404, 'Unknown API route.');
      return send(res, 200, await h(req.method === 'POST' ? await readBody(req) : {}));
    }
    const file = path.join(PUB, url === '/' ? 'index.html' : url);
    if (!file.startsWith(PUB)) throw new HttpError(403, 'Forbidden.');
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, { error: 'Not found.' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(data);
    });
  } catch (e) { send(res, e.code || 500, { error: e.code ? e.message : 'Server error.' }); }
}).listen(PORT, () => console.log(`TrustChain demo running at http://localhost:${PORT}  (simulated ledger, no real funds)`));
