// HOTFIX20 e2e: 단골 제안 카드가 화면 전환(사냥·이웃 방문·사진 모드) 위에 남지 않고, 끊긴 제안은 마을로 돌아오면 다시 뜬다 · 💌 배지
//  실행: URL=… [LAB=1] node scripts/e2e-hotfix20.mjs [phone|pc] → screenshots/hotfix20/*.png
//   LAB=1: 「새 화면 미리 보기」(실험실) 켬 — §A2 이야기 모아 보기 등. 끊긴 제안은 모아 두지 않고 바로 다시 뜬다
const LAB = process.env.LAB === '1';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/hotfix20' + (LAB ? '_lab' : '');
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript(([s, lab]) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
}, [JSON.stringify(save), LAB]);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) { const cs = document.querySelector('#dChoice'); const bs = cs && !cs.hidden ? [...cs.querySelectorAll('button')] : []; (bs[bs.length - 1] ?? document.querySelector('#dlg')).click(); return true; } if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
const card = () => p.evaluate(() => !!document.getElementById('propCard'));
const dlgOn = () => p.evaluate(() => !document.querySelector('#dlg').hidden);
const pending = () => p.evaluate(() => window.__pendingProp());
/** 손님 한 명을 방문 손님으로 들이고 제안 대화를 띄운다 */
const propose = () =>
  p.evaluate(() => {
    let a = window.__world.actors.find((x) => x.status === 'visitor' && !x.leaving && !x.hidden);
    if (!a) {
      window.__arrive('visitor');
      a = window.__world.actors.find((x) => x.status === 'visitor' && !x.leaving);
    }
    window.__propose(a);
    return a.id;
  });
/** 제안이 아닌 대화(돌아온 뒤 주민 한마디 「다른 여관 구경 재밌죠?」·「좋은 사진이군」 등)가 먼저 뜨면 넘긴다 — 제안은 그 뒤 대기열에서 */
const skipOther = () =>
  p.evaluate(() => {
    if (document.getElementById('propCard') || document.querySelector('#dlg').hidden) return;
    const cs = document.querySelector('#dChoice');
    const bs = cs && !cs.hidden ? [...cs.querySelectorAll('button')] : [];
    (bs[bs.length - 1] ?? document.querySelector('#dlg')).click();
  });
/** 마을로 돌아오면 끊긴 제안이 다시 뜨는가 (대기열에서) */
async function backAgain(label) {
  let shown = false;
  for (let i = 0; i < 40 && !shown; i++) {
    await W(400);
    shown = (await card()) && (await dlgOn());
    if (!shown) await skipOther();
  }
  ok(shown, `${label}: 마을로 돌아오면 제안이 다시 뜸`);
  await settle();
}

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.evaluate(() => {
  const P = window.__P;
  P.hunt.auto = null;
  if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
  for (const a of window.__world.actors) if (a.id) a.hp = 100;
});

// ── ① 사냥: 제안이 뜬 채로 전투 시작
await propose();
await W(500);
ok((await card()) && (await dlgOn()), '제안 대화 + 손님 카드');
await p.screenshot({ path: `${dir}/${name}_01_prop.png` });
await p.evaluate(() => window.__openHunt('forest'));
await W(600);
await p.evaluate(() => document.querySelector('[data-s="1"]')?.click());
await W(600);
await p.evaluate(() => document.querySelector('#hMan')?.click());
await W(2600);
const inCombat = await p.evaluate(() => !!document.querySelector('#cbCv'));
ok(inCombat, '사냥 화면');
ok(!(await card()), '사냥 화면에 손님 카드 없음');
ok(!(await dlgOn()), '사냥 화면에 제안 대화 없음');
ok((await pending()) >= 1, `끊긴 제안은 대기열에 (${await pending()})`);
await p.screenshot({ path: `${dir}/${name}_02_combat.png` });
await W(1500);
ok(!(await card()) && !(await dlgOn()), '전투 중엔 제안이 다시 뜨지 않음');
await p.locator('#cbQuit').click({ timeout: 3000 }).catch(() => {});
await W(300);
await p.locator('#cbGiveUp').click({ timeout: 3000 }).catch(() => {});
// v0.25.5: 실험실이면 J4 확인 시트(아래) · C1 「한 번 더」 — 둘 다 넘긴다
await p.waitForTimeout(550); // J4 시트 [확인]은 열린 뒤 0.35초 동안 안 눌림 (연타 방지)
await p.locator('#cshOk').click({ timeout: 800 }).catch(() => p.locator('#cbGiveUp').click({ timeout: 800 }).catch(() => {}));
await W(2500);
await p.evaluate(() => { const bs = [...document.querySelectorAll('#cbRes button')]; (bs.find((x) => /마을|닫기|돌아/.test(x.textContent)) ?? bs[bs.length - 1])?.click(); });
await W(800);
await p.evaluate(() => { if (document.querySelector('#win.on')) document.querySelector('#winX').click(); });
await backAgain('사냥');

// ── ② 이웃 방문
await propose();
await W(500);
await p.evaluate(() => document.querySelector('#bVillage').click());
await W(700);
await p.evaluate(() => document.querySelector('.stp[data-f]')?.click());
await W(1500);
ok(await p.evaluate(() => !!window.__S.visiting), '이웃 마을 방문');
ok(!(await card()) && !(await dlgOn()), '이웃 마을에 카드·대화 없음');
await p.screenshot({ path: `${dir}/${name}_03_visit.png` });
await p.evaluate(() => document.querySelector('#vHome')?.click());
await W(1500);
await backAgain('이웃 방문');

// ── ③ 사진 모드
await propose();
await W(500);
await p.evaluate(() => window.__enterPhoto());
await W(800);
ok(!(await card()) && !(await dlgOn()), '사진 모드에 카드·대화 없음');
await p.evaluate(() => window.__exitPhoto());
await W(500);
await backAgain('사진 모드');

// ── ④ 💌 배지: 창이 열려 있는 동안 대기 → 배지 → 누르면 제안
await propose();
await W(400);
await p.evaluate(() => window.__enterPhoto());
await W(500);
await p.evaluate(() => window.__exitPhoto());
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(300);
await p.evaluate(() => document.querySelector('.cat button[data-k="tree"]')?.click());
await W(1200);
const badge = await p.evaluate(() => { const e = document.getElementById('propBadge'); return e && !e.hidden ? e.textContent : null; });
ok((await pending()) >= 1 && !(await card()), `배치 중엔 제안이 대기 (${await pending()})`);
// v0.25.9+: flags.json에서 storyInbox를 켜면 실험실이 아니어도 모아 보기 쪽 기대값
const INBOX = LAB || (await p.evaluate(async () => { try { return (await (await fetch('flags.json', { cache: 'no-store' })).json()).storyInbox === true; } catch { return false; } }));
// 기본: 💌 배지에 단골 제안 1 · LAB(§A2 모아 보기): 끊긴 제안은 「바로 다시」라 배지(곁이야기 수)에 넣지 않는다
if (!INBOX) ok(/단골 제안 1/.test(badge ?? ''), `💌 배지: ${badge} (배치 중이라 대기)`);
await p.screenshot({ path: `${dir}/${name}_04_badge.png` });
await p.evaluate(() => document.querySelector('#placeNo').click());
await W(200);
if (INBOX) await backAgain('배치 취소(모아 보기)');
else {
  // 사진 모드 한마디 같은 다른 대화가 떠 있으면 먼저 넘긴다 (대화 중엔 배지가 안 눌림)
  for (let i = 0; i < 10 && (await dlgOn()) && !(await card()); i++) await skipOther(), await W(300);
  if (!(await card())) await p.evaluate(() => document.getElementById('propBadge')?.click());
  await W(600);
  ok((await card()) && (await dlgOn()), '배지 누르면 바로 제안 대화');
}
// 고르면 끝 (대기열에서 사라짐)
await p.evaluate(() => [...document.querySelectorAll('#dChoice button')].find((b) => /보내 주기|배웅해 드리기/.test(b.textContent))?.click());
await W(400);
await settle();
ok((await pending()) === 0 && !(await card()), '고르면 대기열·카드 정리');
ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
