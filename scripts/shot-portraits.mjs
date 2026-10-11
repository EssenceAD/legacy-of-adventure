// 초상화 작업 확인 스크린샷: 케미 대화(드워프+엘프 · 엘프를 먼저 넣어도 드워프가 맥주 타령) · 단골 제안 · 원정 보고서 — SE/PC
// 실행: dist-bot 미리보기 4190 · node scripts/shot-portraits.mjs [se|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'se';
const OUT = 'screenshots/portraits';
fs.mkdirSync(OUT, { recursive: true });
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
}, save);
const p = await ctx.newPage();
const W = (ms) => p.waitForTimeout(ms);
const out = [];
await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(300);
  }
};
await clear();
const port = () => p.evaluate(() => ({ src: document.querySelector('#dPort').getAttribute('src').split('/').pop(), name: document.querySelector('#dName').textContent, text: document.querySelector('#dText').textContent }));
// ① 케미: 단골 둘을 드워프·엘프로 (엘프를 먼저 넘긴다)
const ids = await p.evaluate(() => {
  const g = window.__world.actors.filter((a) => a.id && !a.role && !a.hidden).slice(0, 2);
  // 직업 짝이 먼저 잡히지 않게 직업은 마법사·기사 (짝 없는 조합) · 종족만 엘프·드워프
  Object.assign(g[0], { race: 'elf', kind: 'mage' });
  Object.assign(g[1], { race: 'dwarf', kind: 'knight' });
  return [g[0].id, g[1].id];
});
await p.evaluate((ids) => { const [e, d] = ids.map((id) => window.__world.actors.find((a) => a.id === id)); window.__chemTalk(e, d, 2); }, ids);
await W(1200);
for (let i = 0; i < 3; i++) {
  await W(900);
  const s = await port();
  out.push(`케미 ${i}: ${s.src} · ${s.name} · ${s.text}`);
  if (i === 1) await p.screenshot({ path: `${OUT}/${name}_chem.png` });
  await p.locator('#dlg').click().catch(() => {});
}
await clear();
// ② 단골 제안 (손님 대사 + 고르기)
await p.evaluate(() => {
  const g = window.__arrive('visitor');
  window.__uiTalk([['@' + g.id, '솔바람 여관… 정말 마음에 들어요. 여기 눌러앉아도 될까요?'], ['narr', '단골이 되면 원정에 보낼 수 있어요.']]);
});
await W(1500);
const s2 = await port();
out.push(`제안: ${s2.src} · ${s2.name}`);
await p.screenshot({ path: `${OUT}/${name}_propose.png` });
await clear();
// ③ 원정 보고서: 원정을 바로 끝나게 → 보고서 대화(서술) 뒤 보고서 창 맨 위 파티 초상화
// 새 원정을 진짜 클릭으로 보내고, 시험용으로 끝 시각만 지금으로
await p.locator('#bExp').click().catch(() => {});
await W(900);
await p.locator('.quest').first().click().catch(() => {});
await W(900);
await p.locator('.pm:not([disabled])').first().click().catch(() => {});
await W(400);
await p.locator('#pGo').click().catch(() => {});
await W(900);
await clear();
await p.evaluate(() => { for (const r of window.__P.runs) if (!r.result) { r.end = Date.now(); r.start = Date.now() - 60000; } });
let got = false;
for (let i = 0; i < 90 && !got; i++) {
  await W(1000);
  if (await p.evaluate(() => !document.querySelector('#dlg').hidden)) await p.locator('#dlg').click().catch(() => {});
  got = await p.evaluate(() => /원정 보고서/.test(document.querySelector('#winT').textContent) && document.querySelector('#win').classList.contains('on'));
  if (!got && (await p.evaluate(() => document.querySelector('#win').classList.contains('on')))) await p.locator('#winX').click().catch(() => {});
}
const rp = await p.evaluate(() => [...document.querySelectorAll('.repparty img')].map((i) => i.getAttribute('src').split('/').pop()));
out.push(`보고서: ${got} · 파티 초상화 ${rp.join(', ')}`);
await p.screenshot({ path: `${OUT}/${name}_report.png` });
console.log(out.join('\n'));
await b.close();
