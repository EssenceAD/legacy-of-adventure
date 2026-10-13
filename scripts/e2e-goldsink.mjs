// GOLDSINK e2e (실세이브 따밤): 유료 새로고침 버튼 · 버나드 · 마을 부탁 탭 · 연금술 변환 · 축복 + HUD 아이콘 · 사냥 창 금화 줄 · 다음 이야기 한 줄
//  실행: URL=… node scripts/e2e-goldsink.mjs [phone|pc]   (tests/fixtures/real_gs_ttabam.json 이 없으면 건너뜀)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const FIX = 'tests/fixtures/real_gs_ttabam.json';
if (!fs.existsSync(FIX)) {
  console.error('실세이브가 없어 건너뜀');
  process.exit(0);
}
const save = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/goldsink';
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
const dlgText = () => p.evaluate(() => (document.querySelector('#dlg').hidden ? '' : document.querySelector('#dText').textContent));
/** 대사가 끝까지 찍히게 한 번 누르고 읽기 */
const readDlg = async () => {
  await W(300);
  await p.evaluate(() => !document.querySelector('#dlg').hidden && document.querySelector('#dlg').click());
  await W(200);
  return dlgText();
};
await p.goto(process.env.URL ?? 'http://localhost:5200/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.evaluate(() => {
  window.__P.hunt.auto = null;
  window.__S.gold = 50_000_000;
  window.__P.quests.refreshUsed = 1;
});

// §6 다음 이야기 한 줄 (따밤 2막 · 날짜만 남음)
const sw = await p.evaluate(() => { const e = document.getElementById('storyWait'); return e && !e.hidden ? e.textContent : ''; });
ok(/^다음 이야기: \d+일차 \(지금 \d+일차\) · ☾로 밤을 넘기면 하루가 빨리 가요$/.test(sw), '다음 이야기 한 줄: ' + sw);
await p.screenshot({ path: `${dir}/${name}_hud_story.png` });

// §1 유료 새로고침
await p.locator('#bExp').click();
await W(600);
const rt = await p.locator('#qRef').textContent();
ok(/^새로고침 · 51만 G$/.test(rt.trim()), '새로고침 버튼: ' + rt);
ok(await p.evaluate(() => !!document.querySelector('.qhint')), '의뢰가 0~1개면 「새로고침하면 새 의뢰가 와요」');
await p.screenshot({ path: `${dir}/${name}_board_refresh.png` });
const g0 = await p.evaluate(() => window.__S.gold);
await p.locator('#qRef').click();
const bern = await readDlg();
ok(/수소문 값/.test(bern), '버나드 (첫 유료 새로고침): ' + bern.slice(0, 30));
await settle();
const g1 = await p.evaluate(() => [window.__S.gold, window.__P.gs.refreshPaid, window.__P.quests.list.length]);
ok(Math.abs(g0 - g1[0] - 512000) < 2000 && g1[1] === 1, `금화 −51.2만 · 유료 1번 (${g0 - g1[0]})`);
ok(g1[2] > 1, '새 의뢰 ' + g1[2] + '개');

// §5 마을 부탁 탭
await p.locator('#bExp').click();
await W(500);
await p.locator('[data-bt="1"]').click();
const momo = await readDlg();
ok(/세 개만 들어주면/.test(momo), '모모 (마을 부탁 처음): ' + momo.slice(0, 30));
for (let i = 0; i < 6 && (await dlgText()); i++) await p.evaluate(() => document.querySelector('#dlg').click()), await W(250);
await W(500);
const nf = await p.locator('.fvrow').count();
ok(nf === 3, '마을 부탁 3개 · ' + (await p.evaluate(() => [...document.querySelectorAll('.fvrow b')].map((x) => x.textContent).join(' / '))));
ok((await p.locator('#fvBox').count()) === 1, '보너스 상자 버튼');
await p.screenshot({ path: `${dir}/${name}_favors.png` });
await settle();

// §2 연금술 변환
await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'alchemy')));
await W(500);
await p.locator('[data-alt="1"]').click();
await W(400);
ok((await p.locator('.cvrow').count()) >= 6, '변환 줄 ' + (await p.locator('.cvrow').count()));
const d0 = await p.evaluate(() => window.__P.dust.n);
await p.locator('[data-cq="ash"][data-q="10"]').click();
await W(300);
const sum = await p.locator('.cvsum').textContent();
ok(/합계/.test(sum), '합계 미리보기: ' + sum.trim().slice(0, 40));
await p.screenshot({ path: `${dir}/${name}_convert.png` });
await p.locator('#cvOk').click();
const alc = await readDlg();
ok(/금화는 무겁지/.test(alc), '연금술사 (첫 변환): ' + alc.slice(0, 20));
await settle();
ok((await p.evaluate(() => window.__P.dust.n)) - d0 === 100, '잿빛 가루 +100');

// §3 축복
await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'chapel')));
await W(500);
const bt = await p.locator('#blessB').textContent();
ok(/축복 받기 · 102만 G/.test(bt), '축복 버튼: ' + bt);
await p.locator('#blessB').click();
const aria = await readDlg();
ok(/무사하길/.test(aria), '아리아: ' + aria.slice(0, 20));
await settle();
await W(800);
const ico = await p.evaluate(() => { const e = document.getElementById('blessIco'); return e && !e.hidden ? e.textContent : ''; });
ok(/^✨\d:\d\d$/.test(ico), 'HUD 축복 아이콘: ' + ico);
await p.screenshot({ path: `${dir}/${name}_bless_hud.png` });

// §4 사냥 창 금화 줄
await p.evaluate(() => { window.__P.gs.autoN = 130; window.__openHunt(); });
await W(500);
const tl = await p.locator('.gsTaper').textContent();
ok(/오늘 자동 사냥 금화 50% \(재료는 그대로\) · 130판 · 300판부터 25%/.test(tl), '사냥 창: ' + tl);
await p.evaluate(() => { window.__P.gs.autoN = 87; window.__openHunt(); });
await W(300);
ok(/오늘 자동 사냥 금화 100% · 87\/120판/.test(await p.locator('.gsTaper').textContent()), '사냥 창 87/120판');
await p.screenshot({ path: `${dir}/${name}_hunt_taper.png` });
await settle();

ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
