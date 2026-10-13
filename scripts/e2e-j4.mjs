// CHECKIN §J4 정석 조작 작은 것 — 「새 화면 미리 보기」(실험실)를 켠 폰에서 (플래그 backRule · confirmSheet · pressFeel)
//  1) 뒤로가기 · Esc · 창 밖 누르기 = 맨 위 창 하나만 · 창이 없으면 아무것도 안 함(게임 페이지 밖으로 안 나감)
//  2) 인물 메뉴 · 확인 시트도 맨 위 층으로 (밑의 창은 그대로)
//  3) 확인 시트: 보관함 팔기 · 손님 내보내기 · 전투 포기 — 그만두기/바깥/Esc = false(그대로) · 확인 = true(실행)
//  4) 누르는 느낌: 버튼을 누르면 .prs (0.08초 이상) → 떼면 빠짐
//  실행: URL=http://localhost:4363/ node scripts/e2e-j4.mjs   (BOT_BUILD 빌드)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4363/';
const save = JSON.parse(fs.readFileSync(fs.existsSync('tests/fixtures/real_lotte.json') ? 'tests/fixtures/real_lotte.json' : 'tests/fixtures/beta_town.json', 'utf8'));
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-visualLab', 'true');
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const navs = [];
p.on('framenavigated', (f) => { if (f === p.mainFrame() && !f.url().startsWith(URL)) navs.push(f.url()); });
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const st = () => p.evaluate(() => ({ win: document.querySelector('#win').classList.contains('on'), title: document.querySelector('#winT').textContent, sheet: !!document.querySelector('#csheet'), pm: !!document.querySelector('#pmenu'), guard: !!history.state?.legacyGuard, url: location.href }));
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 400);
  }
};
const back = async () => { await p.evaluate(() => history.back()); await W(400); };
const esc = async () => { await p.keyboard.press('Escape'); await W(300); };

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
await W(1200);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.evaluate(() => { window.__P.hunt.auto = null; });

// ── 1) 창이 없을 때: 화면을 한 번 누르면 바닥 항목 · 뒤로가기는 아무것도 안 함 ──
const box = await p.locator('#dayv').boundingBox();
await p.mouse.click(box.x + 4, box.y + 4);
await W(400);
await settle();
let s = await st();
ok(s.guard, '창 없음 · 화면을 누르면 뒤로가기 바닥 항목(legacyGuard)');
await back();
s = await st();
ok(!s.win && s.url.startsWith(URL) && s.guard && !navs.length, '창 없음 + 뒤로가기 → 그대로 (페이지 밖으로 안 나감 · 바닥 다시 깔림)');
await back();
s = await st();
ok(s.url.startsWith(URL) && !navs.length, '두 번 더 뒤로가기도 그대로');
await esc();
s = await st();
ok(!s.win && s.url.startsWith(URL), '창 없음 + Esc → 아무것도 안 함');

// ── 2) 쌓인 창: 뒤로가기 · Esc · 바깥 누르기 모두 맨 위 하나만 ──
const openTwo = async () => {
  await p.evaluate(() => window.__openMenu());
  await W(400);
  const t1 = (await st()).title;
  await p.locator('#winB .mtile:not(.lock)').first().click();
  await W(500);
  return t1;
};
let t1 = await openTwo();
let t2 = (await st()).title;
ok(t1 !== t2, `메뉴(${t1}) → 다른 창(${t2})`);
await back();
s = await st();
ok(s.win && s.title === t1, '뒤로가기 → 맨 위 창만 닫힘 (메뉴로)');
await back();
s = await st();
ok(!s.win && s.url.startsWith(URL), '한 번 더 → 메뉴도 닫힘');
await back();
s = await st();
ok(!s.win && s.url.startsWith(URL) && !navs.length, '창 없음 → 뒤로가기 그대로');
t1 = await openTwo();
await esc();
s = await st();
ok(s.win && s.title === t1, 'Esc → 맨 위 창만');
await esc();
ok(!(await st()).win, 'Esc 한 번 더 → 닫힘');
t1 = await openTwo();
await W(500);
await p.mouse.click(206, 40);
await W(400);
s = await st();
ok(s.win && s.title === t1, '바깥(어두운 곳) 누르기 → 맨 위 창만 (예전: 쌓인 창 전부 닫힘)');
await p.mouse.click(206, 40);
await W(400);
ok(!(await st()).win, '바깥 한 번 더 → 닫힘');

// ── 3) 인물 메뉴: Esc · 뒤로가기가 메뉴부터 ──
const actor = await p.evaluate(() => window.__world.actors.find((a) => a.id && !a.role && !a.hidden)?.id ?? null);
if (actor != null) {
  await p.evaluate((id) => window.__pmenu(window.__world.actors.find((a) => a.id === id), 200, 500), actor);
  await W(300);
  ok((await st()).pm, '인물 메뉴 열림');
  await esc();
  ok(!(await st()).pm, 'Esc → 인물 메뉴 닫힘');
  await p.evaluate((id) => window.__pmenu(window.__world.actors.find((a) => a.id === id), 200, 500), actor);
  await W(300);
  await back();
  s = await st();
  ok(!s.pm && s.url.startsWith(URL) && !navs.length, '뒤로가기 → 인물 메뉴만 닫힘 (페이지 그대로)');
} else ok(true, '인물 없음 · 건너뜀');

// ── 4) 확인 시트: 보관함 팔기 ──
const sold = await p.evaluate(() => {
  const ks = ['bench', 'flowerbed', 'lamp', 'well', 'barrel', 'tree', 'bush', 'statue'];
  const o = window.__world.objs.find((x) => !x.con && ks.includes(x.kind)) ?? window.__world.objs.find((x) => !x.con && window.__def(x.kind).deco && !window.__def(x.kind).pioneerDeco && !window.__def(x.kind).levelDeco && !x.fromProp);
  if (!o) return null;
  window.__store.putAway([o]);
  window.__store.open();
  return o.kind;
});
if (sold) {
  await W(500);
  const n0 = await p.evaluate(() => window.__P.decor.store.length);
  const g0 = await p.evaluate(() => window.__S.gold);
  const sellBtn = p.locator('#winB [data-sell]').last();
  await sellBtn.click();
  await W(500);
  s = await st();
  ok(s.sheet && s.win, `팔기 → 아래 확인 시트 (${sold})`);
  const sh = await p.locator('#csheet').boundingBox();
  ok(sh && sh.y + sh.height >= 915 - 4 && sh.y > 915 / 2, `시트가 화면 아래쪽 (y ${Math.round(sh?.y ?? 0)}~${Math.round((sh?.y ?? 0) + (sh?.height ?? 0))})`);
  ok(await p.locator('#cshOk.red').count() === 1, '확인 버튼 = 빨강(위험)');
  await p.locator('#cshNo').click();
  await W(300);
  s = await st();
  ok(!s.sheet && s.win && (await p.evaluate(() => window.__P.decor.store.length)) === n0, '그만두기 → false (그대로 · 창 그대로)');
  await sellBtn.click();
  await W(400);
  await back();
  s = await st();
  ok(!s.sheet && s.win && (await p.evaluate(() => window.__P.decor.store.length)) === n0, '뒤로가기 → 시트만 닫힘 (보관함 창 그대로)');
  await sellBtn.click();
  await W(400);
  await esc();
  s = await st();
  ok(!s.sheet && s.win, 'Esc → 시트만 닫힘');
  await sellBtn.click();
  await W(600);
  await p.mouse.click(206, 60);
  await W(300);
  ok(!(await st()).sheet && (await st()).win, '바깥 누르기 → 시트만 닫힘');
  await sellBtn.click();
  await W(500);
  await p.locator('#cshOk').click();
  await W(500);
  const n1 = await p.evaluate(() => window.__P.decor.store.length);
  const g1 = await p.evaluate(() => window.__S.gold);
  ok(n1 === n0 - 1 && g1 >= g0, `확인 → true (팔림 · 보관함 ${n0}→${n1} · 금화 +${g1 - g0})`);
  await settle();
} else ok(true, '팔 장식 없음 · 건너뜀');

// ── 5) 확인 시트: 손님 내보내기 ──
const vis = await p.evaluate(() => {
  const regs = window.__world.actors.filter((a) => a.id && !a.role && a.status === 'regular' && a.runId == null && !a.heroId && !a.legendId);
  if (!regs.length) return null;
  regs[0].status = 'visitor';
  regs[0].leaveDay = window.__S.day + 2;
  window.__showActor(regs[0]);
  return regs[0].id;
});
if (vis != null) {
  await W(400);
  await p.locator('#aBye').click();
  await W(500);
  ok((await st()).sheet, '내보내기 → 확인 시트 (두 번 누르기 대신)');
  await p.locator('#cshNo').click();
  await W(300);
  ok(!(await p.evaluate((id) => !!window.__world.actors.find((a) => a.id === id)?.leaving, vis)) && (await st()).win, '그만두기 → 그대로');
  await p.locator('#aBye').click();
  await W(500);
  await p.locator('#cshOk').click();
  await W(500);
  ok(await p.evaluate((id) => !!window.__world.actors.find((a) => a.id === id)?.leaving, vis), '확인 → 체크아웃 (떠나는 중)');
  await settle();
} else ok(true, '단골 없음 · 건너뜀');

// ── 6) 누르는 느낌 ──
await p.evaluate(() => window.__openMenu());
await W(400);
const t = await p.locator('#winB .mtile').first().boundingBox();
await p.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
await p.mouse.down();
const pressed = await p.evaluate(() => !!document.querySelector('#winB .mtile.prs'));
await p.mouse.up();
const still = await p.evaluate(() => !!document.querySelector('.prs'));
await W(200);
const gone = await p.evaluate(() => !document.querySelector('.prs'));
ok(pressed && gone, `누르는 느낌: 누르면 .prs (뗀 직후 ${still ? '남음' : '빠짐'}) → 0.2초 뒤 빠짐`);
ok(await p.evaluate(() => document.body.classList.contains('j4press')), 'body.j4press');
await settle();

// ── 7) 전투 포기: 시트 · Esc는 시트만 · 확인 = 패배 ──
await p.evaluate(() => { const P = window.__P; P.runs.length = 0; P.hunt.auto = null; P.hunt.best.forest = Math.max(P.hunt.best.forest ?? 0, 3); if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt'); for (const a of window.__world.actors) if (a.id) a.hp = 100; });
await p.evaluate(() => window.__openHunt('forest'));
await W(600);
await p.locator('[data-s="1"]').click({ timeout: 5000 }).catch(() => {});
await W(600);
await p.locator('#hMan').click({ timeout: 5000 }).catch(() => {});
await W(2600);
if (await p.evaluate(() => !!window.__combat.field())) {
  await back();
  ok(await p.evaluate(() => !document.querySelector('#cbPause').hidden) && p.url().startsWith(URL), '전투 중 뒤로가기 → 일시정지 (페이지 그대로)');
  await back();
  ok(await p.evaluate(() => document.querySelector('#cbPause').hidden), '한 번 더 → 계속 (일시정지 닫힘)');
  await p.locator('#cbQuit').click();
  await W(300);
  await p.locator('#cbGiveUp').click();
  await W(500);
  ok((await st()).sheet, '포기하기 → 확인 시트');
  await esc();
  ok(!(await st()).sheet && (await p.evaluate(() => !window.__combat.field().done && !document.querySelector('#cbPause').hidden)), 'Esc → 시트만 닫힘 (일시정지 카드 그대로 · 전투 계속)');
  await p.locator('#cbGiveUp').click();
  await W(500);
  await p.locator('#cshOk').click();
  await W(600);
  ok(await p.evaluate(() => window.__combat.field()?.done === 'lose' || !window.__combat.field()), '확인 → 포기 (패배)');
} else ok(false, '전투를 시작하지 못함');

ok(!navs.length, '게임 페이지 밖으로 나간 적 없음 ' + navs.join(','));
ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
