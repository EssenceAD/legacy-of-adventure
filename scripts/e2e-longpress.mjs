// 핫픽스: 모바일 전투 중 길게 누르기 메뉴(이미지·링크) — 안드로이드 크롬 · 삼성 인터넷 · 설치한 PWA(standalone)
//  · 전투 버튼 그림: pointer-events none · draggable false · touch-callout none
//  · 평타·스킬 빠른 연타 + 800ms 길게 누르기(실제 터치) → contextmenu 막힘 · 선택 영역 없음 · 전투 계속
//  · 전투 중 링크(<a>) 못 누름 → 전투 끝나면 다시
//  · 입력칸 · 우편 글은 길게 누르기(붙여넣기·복사) 그대로
//  실행: URL=… node scripts/e2e-longpress.mjs [chrome|samsung]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const kind = process.argv[2] ?? 'chrome';
const UA = {
  chrome: 'Mozilla/5.0 (Linux; Android 14; SM-F721N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-F721N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
}[kind];
const save = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const dir = 'screenshots/longpress';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: UA });
await ctx.addInitScript((s) => {
  // 설치한 PWA(standalone) 흉내
  try {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm(q));
  } catch {}
  // 막히지 않은 contextmenu 세기 (맨 나중 단계에서 defaultPrevented 확인)
  window.__cm = { total: 0, open: 0, targets: [] };
  window.addEventListener('contextmenu', (e) => setTimeout(() => { window.__cm.total++; if (!e.defaultPrevented) { window.__cm.open++; window.__cm.targets.push(e.target?.tagName + '.' + (e.target?.className ?? '')); } }), false);
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 500);
  }
};
const cdp = await ctx.newCDPSession(p);
/** 실제 터치로 길게 누르기 */
const longPress = async (x, y, ms) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await W(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const center = async (sel) => { const r = await p.locator(sel).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
await p.evaluate(() => { const P = window.__P; P.runs.length = 0; P.hunt.auto = null; P.hunt.best.forest = 10; if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt'); for (const a of window.__world.actors) if (a.id) a.hp = 100; });
await p.evaluate(() => window.__openHunt('forest'));
await W(600);
await p.locator('[data-s="10"]').click({ timeout: 5000 });
await W(700);
await p.locator('#hMan').click({ timeout: 5000 });
await W(2600);
ok(await p.evaluate(() => !!window.__combat.field() && document.body.classList.contains('in-combat')), '전투 시작 · body.in-combat');

// 1) 전투 화면의 그림·링크 조사
const audit = await p.evaluate(() => {
  const root = document.querySelector('.cbt');
  const imgs = [...root.querySelectorAll('img')].map((im) => { const cs = getComputedStyle(im); return { pe: cs.pointerEvents, callout: cs.webkitTouchCallout ?? cs.getPropertyValue('-webkit-touch-callout'), drag: im.draggable }; });
  const links = [...document.querySelectorAll('a[href]')].filter((a) => a.offsetParent !== null).map((a) => ({ pe: getComputedStyle(a).pointerEvents, cls: a.className }));
  return { imgs, links };
});
ok(audit.imgs.length > 0 && audit.imgs.every((x) => x.pe === 'none' && x.drag === false), `전투 그림 ${audit.imgs.length}개: 누르기·끌기 안 됨`);
ok(audit.links.every((l) => l.pe === 'none'), `전투 중 보이는 링크 ${audit.links.length}개: 모두 못 누름`);

// 2) 빠른 연타 + 길게 누르기
const atk = await center('#cbAtk');
const s1 = await center('#cbS1');
const s2 = await center('#cbS2');
for (let i = 0; i < 20; i++) {
  const [x, y] = [atk, s1, s2][i % 3];
  await p.touchscreen.tap(x, y);
  await W(40);
}
for (const [x, y] of [atk, s1, s2]) await longPress(x, y, 850);
await W(300);
const after = await p.evaluate(() => ({ cm: window.__cm, sel: String(getSelection()), alive: !!window.__combat.field() && !window.__combat.field().done || true }));
// 합성 contextmenu (실기기의 길게 누르기와 같은 이벤트)도 막히는지
const synth = await p.evaluate(() => ['#cbAtk', '#cbAtk img', '#cbS1', '#cbS1 img', '#cbUlt img', '[data-ally="0"] img'].map((sel) => { const el = document.querySelector(sel); if (!el) return null; const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; }));
ok(after.cm.open === 0, `막히지 않은 길게 누르기 메뉴 0 (실제 터치 contextmenu ${after.cm.total}번 · 열린 것 ${after.cm.open} ${after.cm.targets.join(',')})`);
ok(synth.filter((x) => x !== null).every(Boolean), '전투 버튼·그림 contextmenu 모두 막힘 ' + JSON.stringify(synth));
ok(after.sel === '', '선택 영역 없음');
await p.screenshot({ path: `${dir}/${kind}_combat.png` });
ok(await p.evaluate(() => !!window.__combat.field()), '전투 계속 (입력 막힘 없음)');

// 3) 전투 끝 → 링크 다시
await p.locator('#cbQuit').click({ timeout: 3000 }).catch(() => {});
await W(300);
await p.locator('#cbGiveUp').click({ timeout: 3000 }).catch(() => {});
await W(2500);
await p.evaluate(() => { const bs = [...document.querySelectorAll('#cbRes button')]; (bs.find((x) => /마을|닫기|돌아/.test(x.textContent)) ?? bs[bs.length - 1])?.click(); });
await W(1200);
ok(await p.evaluate(() => !document.body.classList.contains('in-combat')), '전투 끝 → in-combat 풀림');
await clear();
await p.evaluate(() => window.__openNotices());
await W(500);
ok(await p.evaluate(() => { const a = document.querySelector('#kPin a.kakao'); return !!a && getComputedStyle(a).pointerEvents !== 'none'; }), '전투 밖: 톡방 링크 누를 수 있음');
await clear();

// 4) 입력칸 · 우편 글은 그대로 (길게 눌러 붙여넣기 · 복사)
const inputs = await p.evaluate(() => {
  const host = document.createElement('div');
  host.innerHTML = '<textarea id="t1"></textarea><div class="mails"><small id="m1">우편 글</small></div>';
  document.querySelector('#view').appendChild(host);
  const r = ['#t1', '#m1'].map((sel) => { const el = document.querySelector(sel); const cs = getComputedStyle(el); const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return { sel, us: cs.userSelect || cs.webkitUserSelect, blocked: e.defaultPrevented }; });
  host.remove();
  return r;
});
ok(inputs.every((x) => x.us === 'text' && !x.blocked), '입력칸 · 우편 글: 선택·길게 누르기 메뉴 그대로 ' + JSON.stringify(inputs));
ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
