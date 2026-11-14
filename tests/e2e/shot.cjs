// Quick look: node tests/e2e/shot.cjs <w> <h> <name>
const { chromium } = require('playwright');
(async () => {
  const [w, h, name] = [Number(process.argv[2] || 390), Number(process.argv[3] || 844), process.argv[4] || 'shot'];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(process.env.URL || 'http://localhost:4173/');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `tests/e2e/shots/${name}.png` });
  await b.close();
})();
