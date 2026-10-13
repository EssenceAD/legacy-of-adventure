// CHECKIN §A1·A2 e2e: 실제 저장 + 「새 화면 미리 보기」(propFilter·storyInbox 켜짐)
//  ① 평범한 손님 → 제안 대화 없음 · 「다음에 또 올게요!」 · 대기 명단 X · 정산 수 +1
//  ② 쓸 만한 손님(희귀) → 「📖 새 이야기 1」 배지에 모임 (오늘 저절로 뜰 몫은 다 쓴 상태)
//  ③ 배지 누르기 → 제안 대화 + 손님 카드 · ④ 손님이 떠나면 배지에서 조용히 빠짐 · ⑤ 설정 두 줄
//  실행: URL=http://localhost:4311/ node scripts/e2e-propfilter.mjs [phone|pc] → screenshots/propfilter/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const saveFile = fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/real_lotte.json';
const save = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/propfilter';
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
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
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
    await W(busy ? 200 : 600);
  }
};
const dlgOn = () => p.evaluate(() => !document.querySelector('#dlg').hidden);

await p.goto(process.env.URL ?? 'http://localhost:4311/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
// 오늘 저절로 뜰 몫은 다 쓴 상태로 (그 뒤는 배지만)
await p.evaluate(() => {
  const d = new Date();
  window.__P.inbox = { day: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, shown: 99 };
});
const pre = await p.evaluate(() => ({ regs: window.__world.actors.filter((x) => !x.role && x.id && (x.status === 'regular' || x.status === 'hero')).length, inbox: !!window.__inbox }));
ok(pre.inbox && pre.regs > 0, `준비: DEV __inbox · 단골 ${pre.regs}명`);

// ① 평범한 손님: 지금 단골에 있는 직업 · Lv1 · 일반
const r1 = await p.evaluate(async () => {
  const W = window.__world;
  const reg = W.actors.find((x) => !x.role && x.id && x.status === 'regular');
  const g = window.__arrive('visitor');
  Object.assign(g, { rarity: 'common', lvl: 1, xp: 0, kind: reg.kind });
  const q0 = window.__P.daily.cur.quietBye ?? 0;
  const w0 = window.__P.waitlist.length;
  window.__inbox.propose(g);
  await new Promise((r) => setTimeout(r, 400));
  return { leaving: !!g.leaving, quiet: (window.__P.daily.cur.quietBye ?? 0) - q0, wait: window.__P.waitlist.length - w0, float: document.body.innerText.includes('다음에 또 올게요!') || [...document.querySelectorAll('#over *')].some((e) => e.textContent.includes('다음에 또 올게요!')), pend: window.__inbox.pending() };
});
ok(r1.leaving, '평범한 손님은 떠남');
ok(r1.float, '「다음에 또 올게요!」 떠다니는 글씨');
ok(r1.quiet === 1, `정산 카드 수 +1 (${r1.quiet})`);
ok(r1.wait === 0, '대기 명단엔 안 들어감');
ok(r1.pend === 0, '배지에 안 쌓임');
ok(!(await dlgOn()), '제안 대화 없음');
await p.screenshot({ path: `${dir}/${name}_01_quiet.png` });

// ② 쓸 만한 손님(희귀) → 배지
const gid = await p.evaluate(async () => {
  const g = window.__arrive('visitor');
  g.rarity = 'special';
  window.__inbox.propose(g);
  return g.id;
});
await W(1500);
const badge = await p.evaluate(() => { const b = document.getElementById('propBadge'); return b && !b.hidden ? b.textContent : ''; });
ok(badge === '📖 새 이야기 1', `배지 「${badge}」`);
ok(!(await dlgOn()), '저절로 뜨지 않음 (오늘 몫 다 씀)');
await p.screenshot({ path: `${dir}/${name}_02_badge.png` });

// ③ 배지 누르기 → 제안 대화 + 손님 카드
await p.locator('#propBadge').click();
await W(800);
ok((await dlgOn()) && (await p.evaluate(() => !!document.getElementById('propCard'))), '배지 → 제안 대화 + 손님 카드');
await p.screenshot({ path: `${dir}/${name}_03_card.png` });
await settle();

// ④ 다시 모아 두고, 손님이 떠나면 배지에서 조용히 빠짐
await p.evaluate((id) => {
  const g = window.__world.actors.find((x) => x.id === id);
  if (g && !g.leaving && g.status === 'visitor') window.__inbox.propose(g);
  else {
    const h = window.__arrive('visitor');
    h.rarity = 'special';
    window.__inbox.propose(h);
    window.__lastId = h.id;
  }
}, gid);
await W(800);
const before = await p.evaluate(() => window.__inbox.pending());
await p.evaluate((id) => {
  const g = window.__world.actors.find((x) => x.id === (window.__lastId ?? id));
  if (g) g.leaving = true;
}, gid);
await W(1200);
const after = await p.evaluate(() => ({ n: window.__inbox.pending(), hidden: document.getElementById('propBadge')?.hidden !== false }));
ok(before === 1 && after.n === 0 && after.hidden, `떠나면 배지에서 빠짐 (${before} → ${after.n})`);

// ⑤ 설정 두 줄
await p.evaluate(() => window.__openMenu());
await W(400);
await p.evaluate(() => [...document.querySelectorAll('.mtile')].find((b) => b.textContent.trim() === '설정')?.click());
await W(500);
const rows = await p.evaluate(() => ({ f: [...(document.querySelector('#mPropF')?.options ?? [])].map((o) => o.textContent), i: [...(document.querySelector('#mInbox')?.options ?? [])].map((o) => o.textContent) }));
ok(rows.f.join('|') === '쓸 만한 손님만|모두|안 받기(대기 명단에만)', `설정 「단골 제안 받을 손님」 ${rows.f.join('|')}`);
ok(rows.i.join('|') === '모아 보기|바로 보기', `설정 「곁이야기」 ${rows.i.join('|')}`);

ok(!errs.length, '에러 없음' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ propfilter 모두 통과');
process.exit(fail ? 1 : 0);
