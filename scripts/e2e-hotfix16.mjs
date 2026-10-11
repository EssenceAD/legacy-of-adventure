// HOTFIX16 e2e: §1 단골 제안 손님 카드 → [자세히] → 닫기 → 선택지 그대로 → [단골로 받기] · 자리가 꽉 찼을 때 [○○ 대신 받기] → 확인 → 교체 → 대기 명단
//  §2 「🎯 오늘 n/m」 알약 · 여관 정보 카드 → 펼침 패널 · 받기 · 다 받으면 「오늘 끝!」 · 다음 날 다시 · 장부 카드와 안 겹침 (390×844 · 360×740)
//  실행: dist-bot 미리보기 4190 (또는 URL=…) · node scripts/e2e-hotfix16.mjs [phone|small] → screenshots/hotfix16/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const VP = { phone: { width: 390, height: 844 }, small: { width: 360, height: 740 } };
const dir = 'screenshots/hotfix16';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: VP[name], deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
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
p.on('dialog', (d) => { errs.push('confirm/alert: ' + d.message()); d.accept(); });
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const shot = (k) => p.screenshot({ path: `${dir}/${name}_${k}.png` });
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
/** 제안 대화의 마지막 줄까지 넘겨 선택지가 뜨게 */
const toChoices = async () => {
  for (let i = 0; i < 20; i++) {
    if (await p.evaluate(() => !document.querySelector('#dChoice').hidden)) return true;
    await p.locator('#dlg').click().catch(() => {});
    await W(250);
  }
  return false;
};
const choices = () => p.evaluate(() => [...document.querySelectorAll('#dChoice button')].map((x) => x.textContent));
const pick = (label) => p.evaluate((l) => [...document.querySelectorAll('#dChoice button')].find((x) => x.textContent.includes(l))?.click(), label);

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();

// ── §1 카드: 손님 하나를 방문객으로 만들어 제안 (자리 하나 비우기)
const setup = await p.evaluate(() => {
  const acts = window.__world.actors.filter((a) => !a.role && a.id && !a.leaving);
  const regs = acts.filter((a) => a.status === 'regular');
  const v = regs[regs.length - 1];
  v.status = 'visitor';
  v.rarity = 'special';
  v.runId = null;
  return { id: v.id, name: v.name, regs: regs.length - 1 };
});
await p.evaluate((id) => window.__propose(window.__world.actors.find((a) => a.id === id)), setup.id);
await W(300);
ok(await toChoices(), '제안 대화 선택지');
const card = await p.evaluate(() => { const c = document.querySelector('#propCard'); return c ? { text: c.textContent, bars: c.querySelectorAll('.sb').length, compact: c.classList.contains('compact') } : null; });
ok(!!card && /전투력/.test(card.text) && /Lv\./.test(card.text) && card.bars === 5 && /탱|힐|딜/.test(card.text), `손님 카드: 희귀도·Lv·전투력·능력치 ${card?.bars}개·역할 — ${card?.text.slice(0, 70)}`);
ok(/단골 중 \d+위/.test(card?.text ?? '') && /최약 단골보다/.test(card?.text ?? ''), '단골 중 순위 · 최약 단골 비교');
const ch1 = await choices();
ok(ch1.includes('단골로 받기') && ch1.includes('자세히') && ch1.includes('보내 주기'), '선택지: ' + ch1.join(' / '));
await shot('card');
// 카드가 대화창과 겹치지 않음
const ov = await p.evaluate(() => { const a = document.querySelector('#propCard').getBoundingClientRect(); const d = document.querySelector('#dChoice').getBoundingClientRect(); return { cardBottom: Math.round(a.bottom), dlgTop: Math.round(d.top), top: Math.round(a.top) }; });
ok(ov.cardBottom <= ov.dlgTop + 2 && ov.top >= 0, `카드가 선택지 위 (카드 아래 ${ov.cardBottom} · 선택지 위 ${ov.dlgTop})`);
await pick('자세히');
await W(700);
const det = await p.evaluate(() => ({ win: document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT').textContent : '', card: !!document.querySelector('#propCard') }));
ok(!!det.win && !det.card, `[자세히] → 손님 창 「${det.win}」 · 카드 숨김`);
await p.locator('#winX').click();
await W(800);
ok(await toChoices(), '창 닫으면 제안 대화로 돌아옴');
ok(await p.evaluate(() => !!document.querySelector('#propCard')), '카드 다시 보임');
await pick('단골로 받기');
await W(500);
ok(await p.evaluate((id) => window.__world.actors.find((a) => a.id === id)?.status === 'regular', setup.id), '단골로 받기 → 단골');

// 일반 등급은 작은 카드
await p.evaluate(() => {
  const v = window.__world.actors.find((a) => !a.role && a.id && a.status === 'visitor' && !a.leaving) ?? null;
  window.__v = v;
});
const hasVisitor = await p.evaluate(() => !!window.__v);
if (hasVisitor) {
  await p.evaluate(() => { window.__v.rarity = 'common'; window.__propose(window.__v); });
  await toChoices();
  ok(await p.evaluate(() => document.querySelector('#propCard')?.classList.contains('compact') && document.querySelectorAll('#propCard .sb').length === 0), '일반 등급 = 작은 카드(2줄)');
  // ── 꽉 찼을 때: 대신 받기 (방문객을 그대로 두고 단골을 늘려 자리를 채운다)
  await pick('보내 주기');
  await W(400);
}
const full = await p.evaluate(() => {
  const W = window.__world;
  const cap = () => window.__world.objs; void cap;
  const acts = W.actors.filter((a) => !a.role && a.id && !a.leaving);
  // 방문객 하나 확보
  let v = acts.find((a) => a.status === 'visitor');
  if (!v) {
    v = acts.find((a) => a.status === 'regular');
    v.status = 'visitor';
  }
  v.rarity = 'legend';
  v.lvl = 40;
  window.__v2 = v;
  return { id: v.id, name: v.name };
});
// 자리를 꽉 채운다: 모자라면 다른 방문객·시험용 단골로
await p.evaluate(({ id }) => {
  const W = window.__world;
  const v = W.actors.find((a) => a.id === id);
  const regs = () => W.actors.filter((a) => !a.role && a.id && !a.leaving && (a.status === 'regular' || a.status === 'hero')).length;
  for (const a of W.actors) if (regs() < window.__cap() && !a.role && a.id && a !== v && a.status === 'visitor' && !a.leaving) a.status = 'regular';
  const base = W.actors.find((a) => !a.role && a.id && a.status === 'regular');
  let k = 0;
  while (regs() < window.__cap() && base && k < 20) W.actors.push({ ...base, id: window.__P.nextAdvId++, name: '시험단골' + ++k, equip: { weapon: null, armor: null, acc: null }, runId: null, party: false, lvl: 1, path: null, door: null });
  window.__fillShort = window.__cap() - regs();
}, { id: full.id });
const short = await p.evaluate(() => window.__fillShort);
const before = await p.evaluate(() => ({ wait: window.__P.waitlist.map((w) => w.name) }));
await p.evaluate(() => window.__propose(window.__v2));
await toChoices();
const ch2 = await choices();
const swapLabel = ch2.find((c) => /대신 받기/.test(c));
if (short > 0) ok(false, `자리를 못 채움 (${short})`);
else {
  ok(!!swapLabel && !ch2.includes('단골로 받기'), '꽉 참 → 선택지: ' + ch2.join(' / '));
  await shot('swap_choice');
  await pick('대신 받기');
  await W(500);
  ok(/단골 바꾸기/.test(await p.evaluate(() => document.querySelector('#winT').textContent)), '확인 창 한 번 더');
  await shot('swap_confirm');
  await p.locator('#psOk').click();
  await W(600);
  const after = await p.evaluate((id) => ({ v: window.__world.actors.find((a) => a.id === id)?.status, wait: window.__P.waitlist.map((w) => w.name) }), full.id);
  const weakName = swapLabel.replace(' 대신 받기', '');
  ok(after.v === 'regular' && after.wait[0] === weakName, `[${after.v}] 교체: ${full.name} 단골 · ${weakName} 대기 명단 맨 앞 (${before.wait.length}→${after.wait.length})`);
}
await settle();

// ── §2 알약 · 패널
await p.evaluate(() => { const g = window.__P.goals.list; g.forEach((x) => (x.claimed = false, x.progress = 0)); g[0].progress = g[0].target; });
await W(1300);
const pill = await p.evaluate(() => { const e = document.querySelector('#goalPill'); return { hidden: e.hidden, text: e.textContent, ready: e.classList.contains('ready'), dot: !e.querySelector('.ndot').hidden }; });
ok(!pill.hidden && /🎯 오늘 1\/\d/.test(pill.text) && pill.ready && pill.dot, `알약: ${pill.text} · 반짝 ${pill.ready} · 빨간 점 ${pill.dot}`);
const lap = await p.evaluate(() => { const r = (s) => document.querySelector(s)?.getBoundingClientRect(); const a = r('#goalPill'); const m = r('#mission'); const e = r('#evalbar'); const hit = (x, y) => x && y && x.width && y.width && !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top); return { mission: hit(a, m), eval: hit(a, e), right: Math.round(a.right), vw: innerWidth }; });
ok(!lap.mission && !lap.eval && lap.right <= lap.vw, `알약이 장부 카드·풍경 줄과 안 겹침 (${name})`);
await shot('pill');
await p.evaluate(() => document.querySelector('.top .stat').click());
await W(400);
ok(await p.evaluate(() => !!document.querySelector('#goalPanel')), '여관 정보 카드 → 펼침 패널');
const pan = await p.evaluate(() => ({ text: document.querySelector('#goalPanel').textContent, rows: document.querySelectorAll('#goalPanel .gpr').length }));
ok(pan.rows >= 3 && /초기화까지/.test(pan.text) && /전체 보기/.test(pan.text), `패널: 목표 ${pan.rows}줄 · 초기화까지 · 전체 보기`);
await shot('panel');
const g0 = await p.evaluate(() => window.__S.gold);
await p.locator('#goalPanel [data-gc]').first().click();
await W(500);
ok((await p.evaluate(() => window.__S.gold)) > g0 && (await p.evaluate(() => window.__P.goals.list[0].claimed)), '패널에서 받기 → 금화');
await settle();
await p.evaluate(() => document.querySelector('#goalPanel .gx')?.click());
await W(300);
await p.locator('#goalPill').click();
await W(400);
ok(await p.evaluate(() => !!document.querySelector('#goalPanel')), '알약 → 패널');
await p.evaluate(() => document.querySelector('#goalPanel .gall').click());
await W(500);
ok(/오늘의 목표/.test(await p.evaluate(() => document.querySelector('#winT').textContent)), '[오늘의 목표 전체 보기] → 기존 창');
await settle();
await p.evaluate(() => window.__P.goals.list.forEach((g) => ((g.progress = g.target), (g.claimed = true))));
await W(1300);
const over = await p.evaluate(() => { const e = document.querySelector('#goalPill'); return { text: e.textContent, over: e.classList.contains('over') }; });
ok(/오늘 끝!/.test(over.text) && over.over, '다 받으면 「🎯 오늘 끝!」 회색');
await p.evaluate(() => (window.__P.goals.day = '2000-1-1'));
await W(1500);
const next = await p.evaluate(() => document.querySelector('#goalPill').textContent);
ok(/🎯 오늘 \d+\/\d+/.test(next), '다음 날 다시: ' + next);
ok(errs.length === 0, '페이지 에러·confirm 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
