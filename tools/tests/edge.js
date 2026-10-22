const { chromium } = require('playwright');
const EXE = process.env.CHROME || undefined;
const URL = 'http://127.0.0.1:8822/index.html';
const results = [];
const ok = (name, cond, info) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); };

async function newPage(b, opts) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, opts || {}));
  const p = await ctx.newPage();
  p.errors = [];
  p.on('console', m => { if (m.type()==='error') p.errors.push(m.text()); });
  p.on('pageerror', e => p.errors.push('PAGEERROR: ' + e.message));
  p.vis = async () => (await p.$$eval('main > .screen', els => els.filter(e => !e.hidden).map(e => e.id))).join(',');
  return p;
}
async function installSyntheticDeck(p) {
  await p.evaluate(() => {
    window.__card = 1;
    FF.vision.grabFrame = function () {
      const c = document.createElement('canvas'); c.width = c.height = 224; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 224, 224);
      const t = (window.__card - 1) / 8; const r = 70 * (1 - t) + 2;
      g.strokeStyle = '#000'; g.lineWidth = 6; g.beginPath(); g.roundRect(42, 42, 140, 140, r); g.stroke();
      g.beginPath(); g.moveTo(80, 42); g.lineTo(80, 42 - 40 * t); g.moveTo(144, 42); g.lineTo(144, 42 - 40 * t); g.stroke();
      g.beginPath(); g.moveTo(182, 112); g.lineTo(182 + 30 * (1 - t), 100); g.lineTo(182 + 30 * (1 - t), 124); g.closePath(); g.stroke();
      const id = g.getImageData(0, 0, 224, 224); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 20; id.data[i] += n; id.data[i+1] += n; id.data[i+2] += n; } g.putImageData(id, 0, 0);
      return c;
    };
  });
}
async function toSeriesSetup(p, domainIdx) {
  await p.goto(URL);
  await p.click('#btn-start'); await p.click('#domain-grid button:nth-child(' + (domainIdx || 1) + ')'); await p.click('#btn-mode-vision');
  await p.click('#btn-cam-on'); await p.waitForFunction(() => !document.getElementById('kit-choice').hidden, null, { timeout: 15000 });
  await p.evaluate(() => FF.vision.loadModel());
  await installSyntheticDeck(p);
  await p.click('#kit-grid button:nth-child(2)');
}
async function labelPass(p, rule, skipCard) {
  for (let i = 0; i < 9; i++) {
    const txt = await p.textContent('#series-card-number');
    const n = parseInt(txt.match(/CARD (\d+)/)[1], 10);
    await p.evaluate(n => { window.__card = n; }, n);
    if (skipCard === n) { await p.click('#btn-series-skip'); }
    else { await p.click(rule(n) ? '#btn-series-end-1' : '#btn-series-end-0'); await p.waitForFunction(() => !document.getElementById('btn-series-end-0').disabled); }
    await p.waitForTimeout(80);
    if (i < 8) await p.waitForFunction(prev => document.getElementById('series-card-number').textContent !== prev, txt);
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

  // ---------- 1. Single sorter series with a skipped card ----------
  {
    const p = await newPage(b, { permissions: ['camera'] });
    await toSeriesSetup(p, 2);
    await p.click('#btn-sorters-1'); await p.click('#btn-series-begin');
    await p.waitForFunction(() => !document.getElementById('screen-series-label').hidden, null, { timeout: 15000 });
    await labelPass(p, n => n >= 5 ? 1 : 0, 3);
    await p.waitForFunction(() => !document.getElementById('screen-series-interstitial').hidden, null, { timeout: 20000 });
    const inter = await p.textContent('#series-inter-text');
    await p.click('#btn-series-inter-go');
    await p.waitForFunction(() => !document.getElementById('screen-series-test').hidden);
    for (let i = 0; i < 9; i++) {
      const n = parseInt((await p.textContent('#series-test-number')).match(/CARD (\d+)/)[1], 10);
      await p.evaluate(n => { window.__card = n; }, n);
      if (n === 7) { await p.click('#btn-series-test-skip'); continue; }
      await p.click('#btn-series-judge'); await p.waitForFunction(() => document.getElementById('btn-series-judge').textContent.includes('Next') || document.getElementById('btn-series-judge').textContent.includes('picture'));
      await p.click('#btn-series-judge'); await p.waitForTimeout(50);
    }
    await p.waitForFunction(() => !document.getElementById('screen-series-reveal').hidden, null, { timeout: 20000 });
    const text = await p.textContent('#series-reveal-text');
    const preds = await p.evaluate(() => FF.app.state.series.preds);
    ok('single sorter: reveal reached', true, text);
    ok('single sorter: skipped test card 7 has no prediction', preds[7] == null && preds[6] != null);
    ok('single sorter: swap hidden', await p.$eval('#btn-series-swap', e => e.hidden));
    ok('single sorter: no JS errors', p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }

  // ---------- 2. Two sorters agree on everything / disagree on everything / one class only ----------
  for (const variant of ['agree', 'disagree', 'oneclass']) {
    const p = await newPage(b, { permissions: ['camera'] });
    await toSeriesSetup(p, 3);
    await p.click('#btn-sorters-2'); await p.click('#btn-series-begin');
    await p.waitForFunction(() => !document.getElementById('screen-series-label').hidden, null, { timeout: 15000 });
    const ruleA = variant === 'oneclass' ? (n => 0) : (n => n >= 5 ? 1 : 0);
    const ruleB = variant === 'agree' ? (n => n >= 5 ? 1 : 0) : variant === 'disagree' ? (n => n >= 5 ? 0 : 1) : (n => n >= 5 ? 1 : 0);
    await labelPass(p, ruleA);
    await p.waitForFunction(() => !document.getElementById('screen-series-interstitial').hidden, null, { timeout: 20000 });
    const inter = await p.textContent('#series-inter-text');
    await p.click('#btn-series-inter-go'); await p.waitForFunction(() => !document.getElementById('screen-series-label').hidden);
    await labelPass(p, ruleB);
    await p.waitForFunction(() => !document.getElementById('screen-series-reveal').hidden, null, { timeout: 20000 });
    const text = await p.textContent('#series-reveal-text');
    if (variant === 'agree') ok('two sorters agree on all: copy', /agreed on every card/.test(text), text);
    if (variant === 'disagree') ok('two sorters disagree on all: copy', /disagreed on every card/.test(text), text);
    if (variant === 'oneclass') ok('sorter A one class only: copy', /called every card FACES/.test(text) && /called every card/.test(inter), text + ' || ' + inter);
    ok('variant ' + variant + ': no JS errors', p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }

  // ---------- 3. Keyboard-only Data Lab + one-class training + nonsense input ----------
  {
    const p = await newPage(b);
    await p.goto(URL);
    await p.keyboard.press('Tab'); // skip link
    await p.keyboard.press('Tab'); // Start (staff button and reset come later in DOM? reset hidden; brand not focusable)
    let active = await p.evaluate(() => document.activeElement.id);
    ok('keyboard: Start reachable by Tab', active === 'btn-start', active);
    await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    await p.waitForFunction(() => document.activeElement.id === 'h-domain');
    await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); // first domain
    ok('keyboard: domain chosen via Enter', (await p.vis()) === 'screen-mode', await p.vis());
    await p.waitForFunction(() => document.activeElement.id === 'h-mode');
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Space'); // Data lab
    ok('keyboard: data lab via Space', (await p.vis()) === 'screen-data-teach', await p.vis());
    await p.waitForFunction(() => document.activeElement.id === 'h-data-teach');
    // one class only: add two readings of class 0 by keyboard
    await p.focus('#btn-data-add'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
    ok('one-class training blocked', await p.$eval('#btn-data-train', e => e.disabled) && /both labels/.test(await p.textContent('#data-train-note')), await p.textContent('#data-train-note'));
    // nonsense numeric input
    const setNum = async (sel, v) => p.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, v);
    await setNum('#field-teach-x-x-num', 'abc'); await setNum('#field-teach-x-x-num', '99999'); await setNum('#field-teach-x-x-num', '-5'); await setNum('#field-teach-x-x-num', '');
    const v = await p.$eval('#field-teach-x-x-num', e => e.value);
    ok('nonsense numeric input clamped', Number(v) <= 180 && Number(v) >= 40, v);
    // load starter, train via Enter key on the screen
    await p.focus('#btn-data-starter'); await p.keyboard.press('Enter');
    await p.keyboard.press('Enter'); // screen-level Enter → train
    await p.waitForFunction(() => !document.getElementById('screen-data-test').hidden, null, { timeout: 15000 });
    await p.waitForFunction(() => document.activeElement.id === 'h-data-test');
    ok('keyboard: Enter trains', true);
    // arrow keys on slider change prediction
    await p.focus('#field-test-x-x-range');
    for (let i = 0; i < 40; i++) await p.keyboard.press('ArrowRight');
    const xv = await p.$eval('#field-test-x-x-num', e => e.value);
    ok('keyboard: slider arrows move reading', Number(xv) > 90, xv);
    await p.focus('#btn-data-to-break'); await p.keyboard.press('Enter'); // → break
    ok('keyboard: Enter → break', (await p.vis()) === 'screen-data-break', await p.vis());
    await p.waitForFunction(() => document.activeElement.id === 'h-data-break');
    await p.focus('#btn-data-declare-fail'); await p.keyboard.press('Enter');
    ok('keyboard: declare failure', (await p.vis()) === 'screen-understand', await p.vis());
    await p.waitForFunction(() => document.activeElement.id === 'h-understand');
    await p.keyboard.press('Tab'); await p.keyboard.press('Space'); // first chip
    const refl = await p.$eval('#reason-reflection', e => !e.hidden);
    ok('keyboard: chip toggles reflection', refl);
    await p.focus('#btn-to-improve'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.activeElement.id === 'h-data-improve');
    await p.focus('#btn-data-improve-1'); await p.keyboard.press('Enter');
    await p.keyboard.press('Enter'); // retrain via screen Enter
    await p.waitForFunction(() => !document.getElementById('data-improve-test').hidden, null, { timeout: 15000 });
    await p.focus('#btn-data-better'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.activeElement.id === 'h-lesson');
    await p.focus('#btn-to-connect'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.activeElement.id === 'h-connect');
    await p.fill('#idea-input', 'contact me at test@example.com or 555-123-4567 about robots'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => !document.getElementById('challenge-card').hidden);
    const card = await p.textContent('#challenge-card');
    ok('idea sanitised (no email/phone)', !/example\.com|555/.test(card) && /robots/.test(card), card.slice(0, 160));
    await p.focus('#btn-to-finish'); await p.keyboard.press('Enter');
    await p.waitForTimeout(100);
    ok('keyboard: reached finish', (await p.vis()) === 'screen-finish');
    ok('keyboard path: no JS errors', p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }

  // ---------- 4. 360px width: no horizontal overflow, targets big enough ----------
  {
    const p = await newPage(b, { viewport: { width: 360, height: 740 }, permissions: ['camera'] });
    await p.goto(URL);
    const check = async (label) => {
      const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      const small = await p.$$eval('button:not([hidden])', els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44); }).map(e => e.id || e.textContent.trim().slice(0, 20)));
      ok('360px ' + label + ': no horizontal scroll', !over);
      ok('360px ' + label + ': all visible buttons >= 44px', small.length === 0, small.join(', '));
    };
    await check('hook');
    await p.click('#btn-start'); await check('domain');
    await p.click('#domain-grid button:nth-child(5)'); await check('mode');
    await p.click('#btn-mode-data'); await p.click('#btn-data-starter'); await check('data-teach');
    await p.click('#btn-data-train'); await p.waitForFunction(() => !document.getElementById('screen-data-test').hidden, null, { timeout: 15000 }); await check('data-test');
    await p.click('#btn-data-to-break'); await check('data-break');
    await p.click('#btn-data-declare-fail'); await check('understand');
    await p.click('#btn-to-improve'); await check('data-improve');
    await p.click('#btn-data-improve-1'); await p.click('#btn-data-retrain'); await p.waitForFunction(() => !document.getElementById('data-improve-test').hidden, null, { timeout: 15000 });
    await p.click('#btn-data-better'); await check('lesson');
    await p.click('#btn-to-connect'); await check('connect');
    await p.click('#btn-skip-idea'); await p.waitForTimeout(200); await check('connect+card');
    await p.click('#btn-to-finish'); await check('finish');
    // vision screens at 360
    await p.click('#btn-replay-switch'); await p.click('#btn-cam-on'); await p.waitForFunction(() => !document.getElementById('kit-choice').hidden, null, { timeout: 15000 }); await check('vision-setup');
    await p.click('#kit-grid button:nth-child(1)'); await check('vision-teach');
    await p.click('#btn-reset'); await check('reset confirm'); await p.click('#btn-reset-yes');
    ok('360px path: no JS errors', p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }

  // ---------- 5. Repeated reset + abandon mid-session + counter persistence ----------
  {
    const p = await newPage(b);
    await p.goto(URL);
    for (let i = 0; i < 10; i++) {
      await p.click('#btn-start'); await p.click('#domain-grid button:nth-child(' + (1 + i % 6) + ')'); await p.click('#btn-mode-data'); await p.click('#btn-data-starter');
      if (i % 3 === 0) { await p.click('#btn-data-train'); await p.waitForFunction(() => !document.getElementById('screen-data-test').hidden, null, { timeout: 15000 }); }
      await p.click('#btn-reset'); await p.click('#btn-reset-yes');
      const st = await p.evaluate(() => FF.app.state.data.points.length + '|' + (FF.app.state.data.model ? 'model' : 'nomodel') + '|' + FF.app.state.domain);
      if (st !== '0|nomodel|null') ok('reset ' + i + ' clears state', false, st);
    }
    ok('10 resets: state clean each time', true);
    ok('10 resets: no JS errors', p.errors.length === 0, p.errors.join(' | '));
    const tally = await p.evaluate(() => JSON.parse(localStorage.getItem('ff.tally.v1') || '{}'));
    ok('tally stores only counts', tally.total === 0 && Object.keys(tally).sort().join(',') === 'byDomain,day,events,total', JSON.stringify(tally).slice(0, 200));
    await p.context().close();
  }

  // ---------- 6. Offline after load + endpoint down → local card ----------
  {
    const p = await newPage(b);
    await p.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: `window.FF_CONFIG = { challengeEndpoint: { enabled: true, url: 'http://127.0.0.1:9/nope', timeoutMs: 1500 }, counter: true, minExamplesPerClass: 3, burstFrames: 3, idleResetMinutes: 0, showKeyboardHints: true, version: 'test' };` }));
    await p.goto(URL);
    await p.context().setOffline(true);
    await p.click('#btn-start'); await p.click('#domain-grid button:nth-child(6)'); await p.click('#btn-mode-data'); await p.click('#btn-data-starter');
    await p.click('#btn-data-train'); await p.waitForFunction(() => !document.getElementById('screen-data-test').hidden, null, { timeout: 15000 });
    await p.click('#btn-data-to-break'); await p.click('#btn-data-skip-break');
    ok('offline: skip break → lesson', (await p.vis()) === 'screen-lesson', await p.vis());
    await p.click('#btn-to-connect'); const t0 = Date.now(); await p.click('#btn-skip-idea');
    await p.waitForFunction(() => !document.getElementById('challenge-card').hidden, null, { timeout: 10000 });
    const card = await p.textContent('#challenge-card');
    ok('offline + endpoint down: local card within timeout', Date.now() - t0 < 4000 && card.length > 50 && /couldn't break/.test(card), (Date.now() - t0) + 'ms ' + card.slice(0, 120));
    ok('offline: lesson code no_failure_found', (await p.evaluate(() => FF.app.lessonCode())) === 'no_failure_found');
    ok('offline: no JS errors (fetch failure is caught)', p.errors.filter(e => !/net::ERR|Failed to load resource|Failed to fetch/.test(e)).length === 0, p.errors.join(' | '));
    await p.context().close();
  }

  // ---------- 7. file:// load ----------
  {
    const p = await newPage(b, { permissions: ['camera'] });
    await p.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
    await p.click('#btn-start'); await p.click('#domain-grid button:nth-child(2)'); await p.click('#btn-mode-vision');
    const note = await p.textContent('#mode-vision-note');
    await p.click('#btn-cam-on'); await p.waitForTimeout(3000);
    const camOn = await p.evaluate(() => FF.vision.cameraOn());
    const st = await p.evaluate(() => FF.vision.loadModel());
    ok('file://: camera works and engine loads', camOn && st === 'ready', 'camera=' + camOn + ' engine=' + st + ' | ' + (await p.$eval('#cam-error', e => e.hidden ? '' : e.textContent)));
    ok('file://: no JS errors', p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }

  // ---------- 8. Idle guard resets an abandoned session ----------
  {
    const p = await newPage(b);
    await p.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: `window.FF_CONFIG = { challengeEndpoint: { enabled: false }, counter: true, minExamplesPerClass: 3, burstFrames: 3, idleResetMinutes: 0.02, showKeyboardHints: true, version: 'test' };` }));
    await p.goto(URL);
    await p.click('#btn-start'); await p.click('#domain-grid button:nth-child(1)');
    await p.waitForTimeout(1500);
    const toastShown = await p.$eval('#toast', e => !e.hidden);
    await p.waitForTimeout(61000);
    ok('idle guard: warning then reset', toastShown && (await p.vis()) === 'screen-hook', 'toast=' + toastShown + ' screen=' + (await p.vis()));
    await p.context().close();
  }

  await b.close();

  // ---------- 9. Camera denied / no camera (separate launches) ----------
  {
    const b2 = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
    const p = await newPage(b2);
    await p.goto(URL);
    await p.click('#btn-start'); await p.click('#domain-grid button:nth-child(1)'); await p.click('#btn-mode-vision');
    await p.click('#btn-cam-on'); await p.waitForFunction(() => !document.getElementById('cam-error').hidden, null, { timeout: 15000 });
    const err = await p.textContent('#cam-error');
    ok('no camera / denied: friendly error + Data Lab offer', /Data Lab/.test(err) && !(await p.$eval('#btn-cam-to-data', e => e.hidden)), err);
    await p.click('#btn-cam-to-data');
    ok('no camera: switched to data lab', (await p.vis()) === 'screen-data-teach');
    ok('no camera: no JS errors', p.errors.length === 0, p.errors.join(' | '));
    await b2.close();
  }

  console.log(results.join('\n'));
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log(fails ? ('\n' + fails + ' FAILURES') : '\nALL PASS');
})().catch(e => { console.error('ERR', e); console.log(results.join('\n')); process.exit(1); });
