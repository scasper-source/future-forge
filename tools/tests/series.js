const { chromium } = require('playwright');
const EXE = process.env.CHROME || undefined;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await p.goto('http://127.0.0.1:8822/index.html');
  const vis = async () => (await p.$$eval('main > .screen', els => els.filter(e => !e.hidden).map(e => e.id))).join(',');
  await p.click('#btn-start'); await p.click('#domain-grid button:nth-child(1)'); await p.click('#btn-mode-vision');
  await p.click('#btn-cam-on'); await p.waitForFunction(() => !document.getElementById('kit-choice').hidden, null, { timeout: 15000 });
  await p.evaluate(() => FF.vision.loadModel());
  // Synthetic deck: card n morphs a circle (1) into a square (9), black on white line drawing.
  await p.evaluate(() => {
    window.__card = 1;
    FF.vision.grabFrame = function () {
      const c = document.createElement('canvas'); c.width = c.height = 224; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 224, 224);
      const t = (window.__card - 1) / 8; // 0..1
      const r = 70 * (1 - t) + 2;        // corner radius: circle -> square
      g.strokeStyle = '#000'; g.lineWidth = 6; g.lineJoin = 'round';
      g.beginPath(); g.roundRect(112 - 70, 112 - 70, 140, 140, r); g.stroke();
      // a feature that fades in: two "ears" grow with t
      g.beginPath(); g.moveTo(80, 42); g.lineTo(80, 42 - 40 * t); g.moveTo(144, 42); g.lineTo(144, 42 - 40 * t); g.stroke();
      // a feature that fades out: a "beak" shrinks with t
      g.beginPath(); g.moveTo(182, 112); g.lineTo(182 + 30 * (1 - t), 100); g.lineTo(182 + 30 * (1 - t), 124); g.closePath(); g.stroke();
      const id = g.getImageData(0, 0, 224, 224); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 20; id.data[i] += n; id.data[i+1] += n; id.data[i+2] += n; } g.putImageData(id, 0, 0);
      return c;
    };
  });
  await p.click('#kit-grid button:nth-child(2)'); console.log('screen:', await vis(), '|', await p.textContent('#series-deck-name'));
  await p.click('#btn-sorters-2'); await p.click('#btn-series-begin');
  await p.waitForFunction(() => !document.getElementById('screen-series-label').hidden, null, { timeout: 15000 });
  const labelPass = async (rule) => {
    for (let i = 0; i < 9; i++) {
      const txt = await p.textContent('#series-card-number');
      const n = parseInt(txt.match(/CARD (\d+)/)[1], 10);
      await p.evaluate(n => { window.__card = n; }, n);
      const label = rule(n);
      await p.click(label ? '#btn-series-end-1' : '#btn-series-end-0');
      await p.waitForFunction(() => !document.getElementById('btn-series-end-0').disabled);
      await p.waitForTimeout(100);
      if (i < 8) await p.waitForFunction(prev => !document.getElementById('screen-series-label').hidden && document.getElementById('series-card-number').textContent !== prev, txt);
    }
  };
  console.log('A labels 1-4 faces, 5-9 candlestick');
  await labelPass(n => n >= 5 ? 1 : 0);
  await p.waitForFunction(() => !document.getElementById('screen-series-interstitial').hidden, null, { timeout: 20000 });
  console.log('inter:', await p.textContent('#h-series-inter'), '|', await p.textContent('#series-inter-text'));
  await p.click('#btn-series-inter-go');
  await p.waitForFunction(() => !document.getElementById('screen-series-label').hidden);
  console.log('B labels 1-5 faces, 6-9 candlestick');
  await labelPass(n => n >= 6 ? 1 : 0);
  await p.waitForFunction(() => !document.getElementById('screen-series-reveal').hidden, null, { timeout: 20000 });
  console.log('reveal:', await p.textContent('#h-series-reveal'));
  console.log('text:', await p.textContent('#series-reveal-text'));
  console.log('preds:', await p.evaluate(() => Object.entries(FF.app.state.series.preds).map(([c,p]) => c+':'+(p==null?'-':p.toFixed(2))).join(' ')));
  console.log('chart aria:', (await p.$eval('#series-chart-wrap svg', e => e.getAttribute('aria-label'))).slice(0, 200));
  await p.click('#btn-series-table-toggle'); console.log('table rows:', await p.$$eval('#series-table-wrap tbody tr', r => r.length));
  await p.click('#btn-series-swap'); await p.waitForTimeout(2000);
  console.log('after swap text:', await p.textContent('#series-reveal-text'));
  console.log('preds:', await p.evaluate(() => Object.entries(FF.app.state.series.preds).map(([c,p]) => c+':'+(p==null?'-':p.toFixed(2))).join(' ')));
  await p.click('#btn-series-improve'); console.log('screen:', await vis(), '|', await p.textContent('#series-improve-status'));
  await p.evaluate(() => { window.__card = 5; });
  await p.click('#btn-series-imp-1'); await p.waitForFunction(() => !document.getElementById('btn-series-retrain').disabled);
  await p.click('#btn-series-retrain'); await p.waitForFunction(() => !document.getElementById('series-improve-result').hidden, null, { timeout: 15000 });
  console.log('improve result:', await p.textContent('#series-improve-result-text'));
  await p.click('#btn-series-imp-lesson'); console.log('screen:', await vis());
  console.log('concepts:', await p.$$eval('#concepts .concept .text', els => els.map(e => e.textContent).join(' | ')));
  await p.click('#btn-to-connect'); console.log('lesson code:', await p.evaluate(() => FF.app.lessonCode()));
  console.log('ERRORS:', errors);
  await b.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
