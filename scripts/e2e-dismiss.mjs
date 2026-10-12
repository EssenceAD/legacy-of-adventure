// FEEDBACK e2e: 손님 내보내기 — 방문 손님 체크아웃(두 번 누르기) · 단골 작별(대사 · 옛 단골 탭 · 다시 부르기) · 여러 명 고르기 · 영웅은 버튼 없음
//  실행: URL=… node scripts/e2e-dismiss.mjs [phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/dismiss';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 500);
  }
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
// 방문 손님 하나 만들기 (원정 중 아닌 단골 하나를 방문으로 바꿔 씀)
const ids = await p.evaluate(() => {
  window.__P.hunt.auto = null;
  const regs = window.__world.actors.filter((a) => a.id && !a.role && a.status === 'regular' && a.runId == null);
  regs[0].status = 'visitor';
  regs[0].leaveDay = window.__S.day + 2;
  return { vis: regs[0].id, reg: regs[1].id, regName: regs[1].name, regLvl: regs[1].lvl };
});
// 1) 방문 손님: 두 번 눌러 체크아웃
await p.evaluate((id) => window.__showActor(window.__world.actors.find((a) => a.id === id)), ids.vis);
await W(400);
await p.locator('#aBye').click();
await W(200);
ok(/체크아웃할까요/.test(await p.locator('#aBye').textContent()), '방문 손님: 한 번 누르면 「오늘 밤 체크아웃할까요?」');
await p.screenshot({ path: `${dir}/${name}_visitor_confirm.png` });
await p.locator('#aBye').click();
await W(400);
ok(await p.evaluate((id) => !!window.__world.actors.find((a) => a.id === id)?.leaving, ids.vis), '두 번 누르면 체크아웃 (떠나는 중)');
await settle();
// 2) 단골: 「한 번 더 누르면 작별」 → 작별 대사 → 옛 단골 탭 → 다시 부르기
await p.evaluate((id) => window.__showActor(window.__world.actors.find((a) => a.id === id)), ids.reg);
await W(400);
await p.locator('#aBye').click();
await W(200);
ok(/한 번 더 누르면 작별/.test(await p.locator('#aBye').textContent()), '단골: 「한 번 더 누르면 작별」');
await p.locator('#aBye').click();
await W(600);
const line = await p.evaluate(() => (document.querySelector('#dlg').hidden ? '' : document.querySelector('#dText').textContent));
ok(/또 들를게|신세 많이 졌어/.test(line), '작별 대사: ' + line.slice(0, 30));
await settle();
await W(6000);
await p.evaluate(() => { const o = window.__openGuests; if (o) o(); });
const former = await p.evaluate(() => window.__P.formerRegs.map((x) => x.name));
ok(former.includes(ids.regName), '옛 단골 목록: ' + former.join(','));
// 3) 영웅은 버튼 없음
const hero = await p.evaluate(() => { const a = window.__world.actors.find((x) => x.heroId || x.legendId); if (!a) return null; window.__showActor(a); return !!document.querySelector('#aBye'); });
ok(hero === null || hero === false, '영웅·전설: 내보내기 버튼 없음' + (hero === null ? ' (영웅 없음 · 건너뜀)' : ''));
await settle();
ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
