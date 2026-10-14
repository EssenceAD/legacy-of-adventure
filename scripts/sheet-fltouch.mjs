// FIRSTLOOK §3 (flTouchHints) 전/후 시트 — 폰 360 · 412 (isMobile+hasTouch = pointer: coarse) · PC 1280 (그대로여야 함)
//  장면: 대화창 · 티저 · 컷신(이야기 막) · 전투 일시정지 시트 · 전 = 실험실 끔 · 후 = 실험실 켬 (vis)
//  [건너뛰기] 0.35초 막이·건너뛰기 동작도 같이 확인 (✓/✗)
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-fltouch · npx vite preview --outDir dist-bot-fltouch --port 4332 --strictPort
//        URL=http://localhost:4332/ node scripts/sheet-fltouch.mjs   → reports/firstlook/touch/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4332/';
const OUT = 'reports/firstlook/touch';
fs.mkdirSync(OUT, { recursive: true });
const SAVE = fs.existsSync('tests/fixtures/real_lotte.json') ? 'tests/fixtures/real_lotte.json' : 'tests/fixtures/beta_town.json';
const DEVS = {
  m360: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  m412: { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  pc1280: { viewport: { width: 1280, height: 800 } },
};
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const errs = [];
const W = (p, ms) => p.waitForTimeout(ms);
const shots = {}; // scene → dev → lab → file

async function ctxFor(dev, lab, save) {
  const ctx = await b.newContext(DEVS[dev]);
  await ctx.addInitScript(([s, lab]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    if (s) {
      localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    }
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  }, [save ? fs.readFileSync(save, 'utf8') : '', lab]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${dev}${lab ? ' lab' : ''}: ${String(e).slice(0, 200)}`));
  return { ctx, p };
}
async function calm(p) {
  for (let i = 0, c = 0; i < 80 && c < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    c = busy ? 0 : c + 1;
    await W(p, busy ? 150 : 400);
  }
}
const shot = async (p, scene, dev, lab) => {
  const f = `${OUT}/${scene}_${dev}_${lab ? 'after' : 'before'}.png`;
  await p.screenshot({ path: f });
  ((shots[scene] ??= {})[dev] ??= {})[lab ? 'after' : 'before'] = f;
};
/** 건너뛰기가 먹었나: 대화가 끝났거나 마지막 줄 고르기가 떴다 */
const skipped = () => document.querySelector('#dlg').hidden || !document.querySelector('#dChoice').hidden;
const keysText = (p) => p.evaluate(() => document.querySelector('#dlg .keys')?.textContent ?? '');

for (const dev of Object.keys(DEVS)) {
  const touch = dev !== 'pc1280';
  for (const lab of [false, true]) {
    const tag = `${dev} ${lab ? '후' : '전'}`;
    // ── 티저 (세이브 없음 → 「터치해서 시작」 → 티저 · 건너뛰기 버튼이 뜬 뒤) ──
    {
      const { ctx, p } = await ctxFor(dev, lab, null);
      await p.goto(URL, { waitUntil: 'networkidle' });
      await p.waitForSelector('#teaser.gate', { timeout: 30000 });
      await p.mouse.click(DEVS[dev].viewport.width / 2, DEVS[dev].viewport.height / 2);
      await p.waitForFunction(() => !document.querySelector('#tSkip').hidden, null, { timeout: 15000 });
      if (lab && touch) {
        await p.evaluate(() => document.querySelector('#tSkip').click());
        await W(p, 120);
        ok(await p.evaluate(() => !document.querySelector('#teaser').hidden && !document.querySelector('#tSkip').hidden), `${tag} 티저: 뜨자마자(0.35초 안) 건너뛰기 탭은 안 먹음`);
      }
      await W(p, 900);
      await shot(p, 'teaser', dev, lab);
      await p.locator('#tSkip').click();
      await p.waitForFunction(() => document.querySelector('#tSkip').hidden, null, { timeout: 5000 }).then(() => ok(true, `${tag} 티저: 건너뛰기 → 마지막 컷`), () => ok(false, `${tag} 티저: 건너뛰기 → 마지막 컷`));
      await ctx.close();
    }
    const { ctx, p } = await ctxFor(dev, lab, SAVE);
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
    await p.locator('#tCont').click();
    await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
    await calm(p);
    // ── 대화창 (처음 해 보기 대화) ──
    await p.evaluate(() => window.__wf.talk('gift'));
    await W(p, 1200);
    const kt = await keysText(p);
    ok(lab && touch ? kt.includes('탭: 다음') && kt.includes('건너뛰기') && !/NEXT|SKIP/.test(kt) : kt === 'Z NEXTX SKIP', `${tag} 대화창 안내 「${kt}」`);
    await shot(p, 'dialogue', dev, lab);
    await p.locator('#dlg').click({ position: { x: 40, y: 200 } });
    await W(p, 300);
    ok(await p.evaluate(() => !document.querySelector('#dlg').hidden), `${tag} 대화창: 탭 = 다음 (아직 대화 중)`);
    await p.locator('#dSkip').click();
    await W(p, 1800);
    ok(await p.evaluate(skipped), `${tag} 대화창: [건너뛰기]/X SKIP → 끝 (고르기 있는 대화는 마지막 줄 고르기)`);
    // 막이: 열리자마자 탭
    if (lab && touch) {
      const r = await p.evaluate(async () => {
        window.__wf.talk('gift');
        const sk = () => document.querySelector('#dlg').hidden || !document.querySelector('#dChoice').hidden;
        document.querySelector('#dSkip').click();
        const a = !sk();
        await new Promise((r) => setTimeout(r, 400));
        document.querySelector('#dSkip').click();
        await new Promise((r) => setTimeout(r, 1800));
        return [a, sk()];
      });
      ok(r[0] && r[1], `${tag} 대화창: 0.35초 안 탭은 무시 · 그 뒤 탭은 건너뛰기 (${r})`);
    }
    await calm(p);
    // ── 컷신 (이야기 2막 · storyFx + 대화창) ──
    await p.evaluate(() => window.__story.playAct(2));
    await W(p, 1800);
    await shot(p, 'cutscene', dev, lab);
    await p.locator('#dSkip').click();
    await W(p, 500);
    await calm(p);
    // ── 전투 일시정지 시트 ──
    await p.evaluate(async () => {
      const T = (ms) => new Promise((r) => setTimeout(r, ms));
      const P = window.__P;
      if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
      for (const a of window.__world.actors) if (a.id) a.hp = 100;
      window.__openHunt('forest');
      await T(700);
      document.querySelector('[data-s="1"]')?.click();
      await T(700);
      document.querySelector('#hMan')?.click();
    });
    await p.waitForFunction(() => !!window.__combat.field() && !!document.querySelector('#cbQuit'), null, { timeout: 15000 });
    await W(p, 1500);
    const caps = await p.evaluate(() => [...document.querySelectorAll('kbd.kc, .cbkeys')].filter((k) => k.offsetParent !== null).length);
    ok(touch ? caps === 0 : caps > 0, `${tag} 전투 키캡 보이는 수 ${caps} (${touch ? '폰 0' : 'PC 그대로'})`);
    await p.locator('#cbQuit').click();
    await W(p, 500);
    await shot(p, 'pause', dev, lab);
    const pt = await p.evaluate(() => document.querySelector('#cbPause').innerText);
    ok(!/\b(Esc|Space|Shift|[A-Z] (NEXT|SKIP))\b/.test(pt) || !touch, `${tag} 일시정지 시트에 키 이름 없음`);
    await ctx.close();
  }
}
await b.close();

// ── 시트: 장면마다 한 장 (줄 = 기기 · 칸 = 전/후) ──
const b2 = await chromium.launch({ channel: 'chrome' });
const pg = await b2.newPage({ viewport: { width: 1400, height: 800 } });
const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const NAME = { dialogue: '대화창', teaser: '티저', cutscene: '컷신 (이야기 2막)', pause: '전투 일시정지 시트' };
for (const [scene, byDev] of Object.entries(shots)) {
  const rows = Object.entries(byDev).map(([dev, s]) => `<tr><th>${dev}</th><td><img src="${uri(s.before)}"></td><td><img src="${uri(s.after)}"></td></tr>`).join('');
  await pg.setContent(`<style>body{margin:0;background:#14121c;color:#eee;font:14px sans-serif}h1{font-size:18px;margin:10px 14px}table{border-spacing:10px}th{writing-mode:vertical-rl;color:#cfd8ff}td img{display:block;max-height:520px;max-width:640px;box-shadow:0 0 0 2px #444}thead th{writing-mode:horizontal-tb}</style>
    <h1>FIRSTLOOK §3 flTouchHints — ${NAME[scene]} · 전(실험실 끔) / 후(실험실 켬) · 폰=isMobile+hasTouch · PC는 그대로여야 함</h1>
    <table><thead><tr><th></th><th>전</th><th>후</th></tr></thead>${rows}</table>`);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/sheet_${scene}.png`, fullPage: true });
  console.error(`→ ${OUT}/sheet_${scene}.png`);
}
await b2.close();
if (errs.length) console.error('페이지 오류:\n' + errs.join('\n'));
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exitCode = fail ? 1 : 0;
