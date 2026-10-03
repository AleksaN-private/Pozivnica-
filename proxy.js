// Lokalni posrednik za pauka: dohvata bilo koju http(s) stranicu i vraća je pregledaču sa CORS zaglavljem.
// Pokretanje: node proxy.js   (sluša samo na ovom računaru, port 8787)
const http = require('http');
const PORT = 8787, MAX = 3e6, last = {};
const KEY = process.env.ANTHROPIC_API_KEY, MODEL = process.env.PAUK_MODEL || 'claude-sonnet-5-5';
const body = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 2e5) no(new Error('prevelik zahtev')); }); req.on('end', () => ok(b)); });
// Poenta (neobavezno): šalje pročitane tekstove Claude-u preko TVOG ključa (ANTHROPIC_API_KEY). Bez ključa ovaj deo ne radi.
async function poenta(req, res, h) {
  if (!KEY) { res.writeHead(501, h); return res.end('ANTHROPIC_API_KEY nije podešen (vidi kljuc.txt u uputstvu)'); }
  const { query, texts } = JSON.parse(await body(req));
  const corpus = texts.map(t => '### ' + t.title + '\n' + t.text).join('\n\n').slice(0, 60000);
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 700,
      system: 'Pišeš na srpskom (latinica), kratko i direktno. Koristi ISKLJUČIVO priložene tekstove. Ako nešto nije u tekstovima, napiši „nije u izvorima“ — ništa ne izmišljaj.',
      messages: [{ role: 'user', content: 'Pojam koji je korisnik tražio: „' + query + '“.\nNa osnovu tekstova koje su paukovi pročitali napiši POENTU u 3–5 rečenica: šta je to, kako i kada je nastalo, zašto i čemu služi, i šta je najvažnije/najmanje poznato iza toga.\n\n' + corpus }] }) });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || ('Anthropic API ' + r.status));
  res.writeHead(200, { ...h, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(j.content.map(c => c.text || '').join(''));
}
http.createServer(async (req, res) => {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'x-final-url' };
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...h, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST' }); return res.end(); }
    if (req.method === 'POST' && req.url === '/poenta') return await poenta(req, res, h);
    const u = new URL(req.url, 'http://x'), target = new URL(u.searchParams.get('url'));
    if (u.pathname !== '/fetch' || !/^https?:$/.test(target.protocol)) throw new Error('samo http/https');
    const wait = (last[target.host] || 0) + 400 - Date.now();           // pristojnost: 400 ms razmaka po sajtu
    last[target.host] = Date.now() + Math.max(0, wait);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const r = await fetch(target, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 PaukCrawler/1.0', 'Accept': 'text/html,*/*' } });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) throw new Error('stranica je prevelika');
    console.log(r.status, target.href);
    res.writeHead(r.ok ? 200 : 502, { ...h, 'Content-Type': 'text/html; charset=utf-8', 'x-final-url': r.url });
    res.end(r.ok ? buf : 'sajt je vratio ' + r.status);
  } catch (e) { res.writeHead(500, h); res.end(String(e.message || e)); }
}).listen(PORT, '127.0.0.1', () => console.log('Pauk proxy radi na http://localhost:' + PORT + '  (Ctrl+C za kraj)'));
