// Lokalni posrednik za pauka: dohvata bilo koju http(s) stranicu i vraća je pregledaču sa CORS zaglavljem.
// Pokretanje: node proxy.js   (sluša samo na ovom računaru, port 8787)
const http = require('http');
const PORT = 8787, MAX = 3e6, last = {};
http.createServer(async (req, res) => {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'x-final-url' };
  try {
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
