// EASTER e2e: 개척자 금빛 편지 컷신 → 전용 장식 「쿵」 · 칭호 · 한 번만 / 카메오 손님(금색 이름표 · 대사 4줄 → 선물) · 도감 개척자 칸 · 보관함 팔기 없음
//  실행: URL=… node scripts/e2e-easter.mjs [phone|pc] → screenshots/easter/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/easter';
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
const count = (k) => p.evaluate((k) => window.__world.objs.filter((o) => o.kind === k).length, k);

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();

// ── §1 금빛 편지 (우편함에서 열기 = claimMail → 컷신)
await p.evaluate(() => window.__easter.mail('woongs'));
const mailId = await p.evaluate(() => window.__P.meta.mail[0]?.id);
ok(await p.evaluate(() => window.__P.meta.mail[0]?.reward?.pioneer === 'woongs'), '금빛 편지 도착');
await p.evaluate((id) => window.__claim(id), mailId);
await W(800);
const firstLine = await p.evaluate(() => document.querySelector('#dText')?.textContent ?? '');
ok(/롯데캐슬/.test(firstLine) || !document.querySelector, '편지를 열면 컷신: ' + firstLine.slice(0, 30));
await p.screenshot({ path: `${dir}/${name}_01_letter.png` });
// 대사를 넘기며 「쿵」 줄에서 장식이 놓이는지
let dropped = false;
for (let i = 0; i < 20; i++) {
  if (!(await p.evaluate(() => !document.querySelector('#dlg').hidden))) break;
  await p.evaluate(() => document.querySelector('#dlg').click());
  await W(450);
  if (!dropped && (await count('duck_spa')) === 1) {
    dropped = true;
    await W(600);
    await p.screenshot({ path: `${dir}/${name}_02_drop.png` });
  }
}
await W(800);
ok((await count('duck_spa')) === 1, '온천 오리상이 마을에 놓임');
const titles = await p.evaluate(() => window.__P.titles);
ok(titles.includes('베타 개척자') && titles.includes('온천을 두 번 지은 사냥왕'), '칭호 「베타 개척자」 · 「온천을 두 번 지은 사냥왕」');
await p.screenshot({ path: `${dir}/${name}_03_title.png` });
await settle();
// 한 번만
await p.evaluate(() => window.__easter.open('woongs'));
await W(500);
await settle();
ok((await count('duck_spa')) === 1, '두 번 열어도 한 번만 (장식 1개)');
// 건설 목록에 없음 · 보관함에서 팔 수 없음
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(500);
ok(await p.evaluate(() => !document.querySelector('.cat button[data-k="duck_spa"]')), '건설 목록엔 없음');
await settle();
await p.evaluate(() => window.__store.putAway([window.__world.objs.find((o) => o.kind === 'duck_spa')]));
await p.evaluate(() => window.__store.open());
await W(500);
ok(await p.evaluate(() => /팔 수 없어요/.test(document.querySelector('#winB').textContent) && !document.querySelector('#winB .irow:last-child [data-sell]')), '보관함: 개척자 장식은 팔기 없음');
await p.evaluate(() => document.querySelector('#winB .irow:last-child [data-out]').click());
await W(500);
await p.evaluate(() => document.querySelector('#placeOk').click());
await W(500);
ok((await count('duck_spa')) === 1, '다시 꺼내 놓기');
await settle();

// ── §2 카메오
const cam = await p.evaluate(() => { const a = window.__easter.cameo('ikamolly'); return { name: a.name, id: a.id, st: a.status }; });
ok(cam.name === '이카몰리' && cam.st === 'passer' && cam.id === 0, '카메오: 이카몰리 (지나가는 손님 · 저장 안 됨)');
await W(2500);
await p.evaluate(() => { const a = window.__world.actors.find((x) => x.cameo === 'ikamolly'); window.__game.focusTile(a.x, a.y); });
await W(600);
await p.screenshot({ path: `${dir}/${name}_04_cameo.png` });
const lines = [];
for (let i = 0; i < 30 && lines.length < 5; i++) {
  await p.evaluate(() => { const a = window.__world.actors.find((x) => x.cameo === 'ikamolly'); a.st = 'idle'; a.path = null; a.t = 999; a.intent = null; if (a.hidden) { a.hidden = false; a.inside = null; } });
  await W(120);
  const xy = await p.evaluate(() => window.__cameoXY('ikamolly'));
  await p.mouse.click(xy[0], xy[1]);
  await W(500);
  const got = (await p.evaluate(() => (document.querySelector('#dlg').hidden ? '' : document.querySelector('#dName').textContent + ': ' + document.querySelector('#dText').textContent)));
  if (got && got.startsWith('이카몰리')) lines.push(got);
  if (got && lines.length === 1) await p.screenshot({ path: `${dir}/${name}_05_cameo_talk.png` });
  await settle();
}
ok(lines.length === 5 && /이카몰리/.test(lines[0]), `카메오 대사 ${lines.length}번 (4줄 + 선물): ${lines.map((l) => l.slice(6, 22)).join(" / ")}`);
ok(await p.evaluate(() => !!window.__P.meta.easter.expCoupon || window.__P.runs.length > 0), '선물: 다음 의뢰 −10% 쿠폰 (또는 이미 의뢰에 씀)');
ok(await p.evaluate(() => (window.__P.meta.easter.met ?? []).includes('ikamolly')), '만난 개척자 기록');

// ── EASTER 마무리: 카메오 상세 창 (전용 초상화 · 금색 이름 ★ · 「베타 개척자 · 지나가는 손님」 · 말 걸기 · 장비 칸 없음) · 목록 이름 금색
await settle();
await p.evaluate(() => window.__showObj && 0);
const det = await p.evaluate(async () => {
  const a = window.__world.actors.find((x) => x.cameo === 'ikamolly');
  window.__showActor(a);
  const w = document.querySelector('#win');
  return { port: w.querySelector('img.port')?.src ?? '', portP: w.querySelector('img.port')?.src === (window.__portraits?.p_ikamolly ?? ''), sub: w.querySelector('.sub')?.textContent ?? '', gold: !!w.querySelector('.cameo-name'), talk: !!w.querySelector('#aTalk'), slots: w.querySelectorAll('.slot').length };
});
ok(det.gold && /★/.test(det.sub) && /베타 개척자 · 지나가는 손님/.test(det.sub), '상세: 금색 이름 ★ · 부제 ' + det.sub);
ok(det.talk && det.slots === 0, '상세: 말 걸기 있음 · 장비 칸 없음');
ok(/p_ikamolly/.test(det.port), '상세: 전용 초상화 p_ikamolly');
await W(800);
await p.screenshot({ path: `${dir}/${name}_05b_cameo_detail.png` });
await p.locator('#aTalk').click();
await W(500);
ok(await p.evaluate(() => !document.querySelector('#dlg').hidden && /이카몰리/.test(document.querySelector('#dName')?.textContent ?? '')), '말 걸기 → 카메오 대사');
await settle();
// 저녁(떠날 때): 단골 제안 없이 떠남
const left = await p.evaluate(async () => {
  window.__S.clock = (21 - 6) * 60;
  return true;
});
void left;
for (let i = 0; i < 20 && (await p.evaluate(() => window.__world.actors.some((x) => x.cameo === 'ikamolly' && !x.leaving))); i++) await W(500);
await settle();
ok(await p.evaluate(() => !window.__world.actors.some((x) => x.cameo === 'ikamolly' && !x.leaving) && !window.__P.waitlist.some((w) => w.name === '이카몰리')), '저녁: 카메오는 단골 제안·대기 없이 떠남');

// ── §3 도감 영웅 탭 「개척자」
await p.evaluate(() => window.__openDex(3));
await W(500);
const pion = await p.evaluate(() => ({ all: document.querySelectorAll('.pcell').length, on: [...document.querySelectorAll('.pcell.on b')].map((b) => b.textContent) }));
ok(pion.all === 4 && pion.on.includes('이카몰리'), `도감 개척자 칸 ${pion.all} · 밝은 칸 ${pion.on.join(',')}`);
await p.locator('.pion').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${dir}/${name}_06_dex.png` });
await settle();
ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
