'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const requireAudit = createRequire(path.join(root, '.lighthouse/package.json'));
const out = path.join(root, 'test-results/lighthouse');
fs.mkdirSync(out, { recursive: true });
const categories = ['performance', 'accessibility', 'best-practices'];
const results = [];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const dist = path.join(root, 'dist'), file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, bytes) => {
    res.statusCode = error ? 404 : 200;
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(error ? '' : bytes);
  });
});
(async () => {
  const { default: lighthouse, desktopConfig } = await import(requireAudit.resolve('lighthouse'));
  const { default: puppeteer } = await import(requireAudit.resolve('puppeteer'));
  const live = process.argv.includes('--live');
  if (!live) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = live ? 'https://admin.vertexishere.com/' : 'http://127.0.0.1:' + server.address().port;
  try {
    for (const device of ['mobile', 'desktop']) {
      for (let run = 1; run <= 3; run++) {
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        try {
          const port = Number(new URL(browser.wsEndpoint()).port);
          const result = await lighthouse(url, { port, logLevel: 'error', output: ['json', 'html'], onlyCategories: categories }, device === 'desktop' ? desktopConfig : undefined);
          if (result.lhr.runtimeError) throw Error(result.lhr.runtimeError.message);
          const scores = Object.fromEntries(categories.map(key => [key, Math.round(result.lhr.categories[key].score * 100)]));
          const failures = Object.values(result.lhr.audits).filter(a => a.score !== null && a.score < 1).map(a => ({ id: a.id, title: a.title, score: a.score, displayValue: a.displayValue, details: a.details }));
          const item = { device, run, scores, failures, version: result.lhr.lighthouseVersion, fetchTime: result.lhr.fetchTime, url: result.lhr.finalDisplayedUrl };
          results.push(item);
          const prefix = path.join(out, device + '-' + run);
          fs.writeFileSync(prefix + '.json', result.report[0]);
          fs.writeFileSync(prefix + '.html', result.report[1]);
          console.log(JSON.stringify({ device, run, scores, failures: failures.map(f => f.id) }));
        } finally { await browser.close(); }
      }
    }
    const summary = { scope: live ? 'Live signed-out sign-in page; no authenticated panels' : 'Built signed-out sign-in page; no authenticated panels', results,
      medians: Object.fromEntries(['mobile', 'desktop'].map(device => [device, Object.fromEntries(categories.map(key => [key, results.filter(r => r.device === device).map(r => r.scores[key]).sort((a,b) => a-b)[1]]))])) };
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log('MEDIANS', JSON.stringify(summary.medians));
    if (Object.values(summary.medians).some(scores => Object.values(scores).some(score => score < 100))) process.exitCode = 1;
  } finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); if (server.listening) server.close(); process.exitCode = 1; });
