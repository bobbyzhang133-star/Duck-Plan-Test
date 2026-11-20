// Disposable loopback QA transport. Command secrets remain only in private /tmp.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const device = process.argv[2];
if (!['phone', 'ipad'].includes(device)) throw new Error('Specify phone or ipad');
const port = device === 'phone' ? 8896 : 8897;
const folder = '/private/tmp/duckplan-count-native-qa';
fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
const command = path.join(folder, `${device}-command.json`), results = path.join(folder, `${device}-results.jsonl`);
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.url === '/command') {
    res.setHeader('Content-Type', 'application/json');
    if (!fs.existsSync(command)) { res.writeHead(404); return res.end('{"error":"No QA command"}'); }
    return res.end(fs.readFileSync(command));
  }
  if (req.url === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100000) req.destroy(); });
    req.on('end', () => {
      try {
        const record = JSON.parse(body);
        // Guard against accidentally writing native/API credentials to evidence.
        const forbidden = /password|cookie|authorization|recovery|(?:^|_)token(?:$|_)/i;
        const scan = value => { if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { if (forbidden.test(key)) throw new Error('Credential field'); scan(child); } };
        scan(record);
        fs.appendFileSync(results, JSON.stringify(record) + '\n', { mode: 0o600 });
        res.end('ok');
      } catch { res.writeHead(400); res.end('Invalid or sensitive QA evidence'); }
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(port, '127.0.0.1', () => console.log(`Disposable ${device} QA collector ready on localhost${port}`));
