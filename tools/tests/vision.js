const { chromium } = require('playwright');
const EXE = process.env.CHROME || undefined;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', m => { if (m.type()==='error') errors.push(m.text()); if (m.text().includes('[Future Forge]')) console.log('LOG', m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await p.goto('http://127.0.0.1:8822/index.html');
  const vis = async () => (await p.$$eval('main > .screen', els => els.filter(e => !e.hidden).map(e => e.id))).join(',');
  await p.click('#btn-start'); await p.click('#domain-grid button:nth-child(3)'); await p.click('#btn-mode-vision');
  console.log('screen:', await vis());
  await p.click('#btn-cam-on'); await p.waitForTimeout(1500);
  console.log('kit visible:', await p.$eval('#kit-choice', e => !e.hidden), '| cam error:', await p.$eval('#cam-error', e => e.hidden ? 'none' : e.textContent));
  console.log('camera on:', await p.evaluate(() => FF.vision.cameraOn()), 'video size', await p.evaluate(() => [document.getElementById('cam').videoWidth, document.getElementById('cam').videoHeight]));
  // Wait for engine
  await p.evaluate(() => FF.vision.loadModel());
  console.log('engine:', await p.evaluate(() => FF.vision.status + ' / ' + FF.vision.engineName));
  // Synthetic frame injection: shape parameter controls what the "camera" sees.
  await p.evaluate(() => {
    window.__syn = { kind: 'A', angle: 0, cover: 0, bg: '#ffffff' };
    const orig = FF.vision.grabFrame;
    FF.vision.grabFrame = function () {
      const v = FF.vision.video; if (!v || !v.videoWidth) return null;
      const c = document.createElement('canvas'); c.width = c.height = FF.vision.inputSize;
      const g = c.getContext('2d');
      g.fillStyle = window.__syn.bg; g.fillRect(0, 0, 224, 224);
      g.save(); g.translate(112, 112); g.rotate(window.__syn.angle);
      if (window.__syn.kind === 'A') { g.fillStyle = '#1f7a3a'; g.fillRect(-60, -60, 120, 120); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.fillText('CU', -28, 14); }
      else { g.fillStyle = '#e0a800'; g.beginPath(); g.arc(0, 0, 65, 0, Math.PI * 2); g.fill(); g.fillStyle = '#000'; g.font = 'bold 40px sans-serif'; g.fillText('GO', -30, 14); }
      g.restore();
      if (window.__syn.cover) { g.fillStyle = '#c99'; g.fillRect(0, 0, 224, 224 * window.__syn.cover); }
      // sensor-like noise
      const id = g.getImageData(0, 0, 224, 224); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 24; id.data[i] += n; id.data[i+1] += n; id.data[i+2] += n; } g.putImageData(id, 0, 0);
      return c;
    };
  });
  await p.click('#kit-grid button:nth-child(1)'); console.log('screen:', await vis());
  for (let i = 0; i < 5; i++) { await p.evaluate(() => { window.__syn.kind = 'A'; window.__syn.angle = (Math.random()-0.5)*0.3; }); await p.click('#btn-add-a'); await p.waitForTimeout(150); }
  for (let i = 0; i < 5; i++) { await p.evaluate(() => { window.__syn.kind = 'B'; window.__syn.angle = (Math.random()-0.5)*0.3; }); await p.click('#btn-add-b'); await p.waitForTimeout(150); }
  await p.waitForFunction(() => !document.getElementById('btn-add-a').disabled);
  console.log('counts:', await p.textContent('#count-a'), '/', await p.textContent('#count-b'), '| train enabled:', await p.$eval('#btn-vision-train', e => !e.disabled));
  await p.fill('#class-a-name', 'Green'); await p.fill('#class-b-name', 'Gold');
  await p.click('#btn-vision-train'); await p.waitForFunction(() => !document.getElementById('screen-vision-test').hidden, null, { timeout: 15000 });
  console.log('screen:', await vis());
  await p.evaluate(() => { window.__syn.kind = 'A'; window.__syn.angle = 0; }); await p.waitForTimeout(1200);
  console.log('meter A:', await p.textContent('#meter-say'));
  await p.evaluate(() => { window.__syn.kind = 'B'; }); await p.waitForTimeout(1200);
  console.log('meter B:', await p.textContent('#meter-say'));
  await p.click('#btn-to-break'); console.log('screen:', await vis());
  await p.evaluate(() => { window.__syn.kind = 'A'; window.__syn.angle = Math.PI / 2; window.__syn.cover = 0.5; window.__syn.bg = '#ffd27f'; }); await p.waitForTimeout(1500);
  console.log('meter broken A (rotated, covered, gold bg):', await p.textContent('#meter-say'), await p.textContent('#meter-note'));
  await p.click('#btn-declare-fail'); console.log('screen:', await vis(), '|', await p.textContent('#understand-snapshot'));
  await p.click('#reason-chips button:nth-child(1)'); await p.click('#reason-chips button:nth-child(3)');
  await p.click('#btn-to-improve'); console.log('screen:', await vis());
  await p.click('#btn-improve-add-a'); await p.waitForFunction(() => !document.getElementById('btn-retrain').disabled);
  console.log('added:', await p.textContent('#improve-added'));
  await p.click('#btn-retrain'); await p.waitForFunction(() => !document.getElementById('improve-step-test').hidden, null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  console.log('meter after retrain (same broken condition):', await p.textContent('#meter-say'));
  await p.evaluate(() => { window.__syn.kind = 'B'; window.__syn.angle = 0; window.__syn.cover = 0; window.__syn.bg = '#fff'; }); await p.waitForTimeout(1200);
  console.log('meter B still:', await p.textContent('#meter-say'));
  await p.click('#btn-improve-better'); console.log('screen:', await vis());
  await p.click('#btn-to-connect'); await p.click('#btn-skip-idea'); await p.waitForTimeout(300);
  console.log('card:', (await p.textContent('#challenge-card')).slice(0, 200));
  await p.click('#btn-to-finish'); console.log('screen:', await vis());
  await p.click('#btn-replay-same'); console.log('replay screen:', await vis(), '| camera still on:', await p.evaluate(() => FF.vision.cameraOn()));
  await p.click('#btn-reset'); await p.click('#btn-reset-yes'); console.log('after reset:', await vis(), '| camera on:', await p.evaluate(() => FF.vision.cameraOn()));
  console.log('ERRORS:', errors);
  await b.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
