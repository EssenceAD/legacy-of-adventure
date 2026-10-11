// PHOTO_SPEC: 사진 모드 — 메뉴로 들어가면 UI 숨김 · 틀 3종 × 시간 4종 저장 그림 크기(정수 배율 · 폰 배경 ~2532px) · 나가면 시간·UI 원래대로
//  · 저장 길: 공유 / 다운로드 / 새 창 · 사진 수·업적
//  실행: dist-bot 미리보기 4190 · node scripts/e2e-photo.mjs [se|i14|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'i14';
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, i14: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ ...DEV[name], acceptDownloads: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
for (let i = 0; i < 12; i++) {
  await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
  await W(200);
}
const nl0 = await p.evaluate(() => window.__S.nightT);
// 메뉴 → 사진 찍기
await p.locator('#bMenu2').click();
await W(600);
await p.locator('.mtile', { hasText: '사진 찍기' }).first().click();
await W(800);
const ui = await p.evaluate(() => ({ photo: document.body.classList.contains('photo'), bar: !!document.querySelector('#photoBar'), hudVisible: ['.top', '#mission', '.dk', '#chatlog', '#over'].filter((s) => { const e = document.querySelector(s); return e && e.checkVisibility(); }) }));
ok(ui.photo && ui.bar && ui.hudVisible.length === 0, `사진 모드: 도구 줄만 · 보이는 HUD ${JSON.stringify(ui.hudVisible)}`);
await p.screenshot({ path: `screenshots/photo_${name}_mode.png` });
// 틀 3 × 시간 4: 그림 크기
for (const f of ['phone', 'square', 'wide']) {
  await p.locator(`[data-seg="frame"] [data-v="${f}"]`).click();
  for (const t of ['now', 'morning', 'sunset', 'night']) {
    await p.locator(`[data-seg="time"] [data-v="${t}"]`).click();
    await W(150);
    const r = await p.evaluate((f) => { const c = window.__photo.capture(f, true); const fr = window.__photo.frameRect(f); const k = window.__photo.photoScale(f, fr.h); return { w: c.width, h: c.height, fw: fr.w, fh: fr.h, k, data: f === 'phone' ? c.toDataURL('image/png').length : 0 }; }, f);
    const intScale = r.w === r.fw * r.k && r.h === r.fh * r.k;
    const ratio = (r.w / r.h).toFixed(3);
    const want = { phone: (9 / 19.5).toFixed(3), square: '1.000', wide: (16 / 9).toFixed(3) }[f];
    ok(intScale && Math.abs(r.w / r.h - Number(want)) < 0.02 && (f !== 'phone' || Math.abs(r.h - 2532) < r.fh), `${f}·${t}: ${r.w}×${r.h} (틀 ${r.fw}×${r.fh} × ${r.k}배, 비율 ${ratio})`);
  }
}
// 보고서용 샘플 (폰 배경 · 노을 · 밤)
for (const t of ['sunset', 'night']) {
  await p.locator(`[data-seg="time"] [data-v="${t}"]`).click();
  await W(200);
  const url = await p.evaluate(() => window.__photo.capture('phone', true).toDataURL('image/png'));
  fs.writeFileSync(`screenshots/photo_${name}_${t}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
// 실제 셔터 → 다운로드 (공유 없는 크롬)
await p.locator('[data-seg="frame"] [data-v="phone"]').click();
await p.locator('[data-seg="time"] [data-v="sunset"]').click();
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.locator('#phShot').click()]);
// 폰 흉내(공유 있음)는 공유 길로 · PC 는 다운로드
const shared = await p.evaluate(() => typeof navigator.share === 'function' && !!navigator.canShare);
ok(!!dl || shared, `셔터 → ${dl ? '다운로드 ' + dl.suggestedFilename() : shared ? '공유 길' : '저장 안 됨'}`);
if (dl) await dl.saveAs(`screenshots/photo_${name}_sunset.png`);
await W(600);
// 다운로드 길 (공유 없음)
const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.evaluate(() => { navigator.canShare = () => false; return window.__photo.saveBlob(new Blob(['x'], { type: 'image/png' }), 'c.png'); })]);
ok(!!dl2 && dl2.suggestedFilename() === 'c.png', `다운로드 길: ${dl2?.suggestedFilename()}`);
// 공유 길 · 새 창 길
const share = await p.evaluate(async () => { navigator.canShare = () => true; let got = null; navigator.share = async (d) => { got = d.files?.[0]?.name; }; const r = await window.__photo.saveBlob(new Blob(['x'], { type: 'image/png' }), 'a.png'); return { r, got }; });
ok(share.r === 'share' && share.got === 'a.png', `공유 길: ${JSON.stringify(share)}`);
const win = await p.evaluate(async () => { navigator.canShare = () => false; const ce = document.createElement.bind(document); document.createElement = (t) => { if (t === 'a') throw new Error('막힘'); return ce(t); }; let opened = false; window.open = () => { opened = true; return { document: { write() {} } }; }; const r = await window.__photo.saveBlob(new Blob(['x'], { type: 'image/png' }), 'b.png'); document.createElement = ce; return { r, opened }; });
ok(win.r === 'window' && win.opened, `새 창 길 (다운로드 막힘): ${JSON.stringify(win)}`);
// 나가기 → 원래대로
await p.locator('#phExit').click();
await W(400);
const back = await p.evaluate(() => ({ photo: document.body.classList.contains('photo'), bar: !!document.querySelector('#photoBar'), nt: window.__S.nightT, top: document.querySelector('.top').checkVisibility() ? 'visible' : 'none', photos: window.__P.counters.photos }));
ok(!back.photo && !back.bar && back.top !== 'none' && Math.abs(back.nt - nl0) < 0.2, `나가면 원래대로: ${JSON.stringify(back)}`);
ok(back.photos >= 1, `사진 수 ${back.photos}`);
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
