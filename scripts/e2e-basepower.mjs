// BASE_POWER_1021 e2e — 실제 저장(웅스): 손님 목록 카드 「맨몸」 · [내보내기 모드] 맨몸 낮은 순 → 끝내면 원래 정렬 · 상세 두 열 · [장비 모두 벗기] · 폭 360 글자 안 넘침
//  실행: URL=http://localhost:4190/ node scripts/e2e-basepower.mjs   (BOT_BUILD 빌드)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const SAVE = process.env.SAVE ?? 'tests/fixtures/real_woongs.json';
const SHOT = process.env.SHOT ?? '';
const b = await chromium.launch({ channel: 'chrome' });
const errs = [];
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const VER = await (async () => { const cx = await b.newContext(); const v = (await (await cx.request.get(URL + 'version.json')).json()).version; await cx.close(); return JSON.stringify(v); })();
const sv = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });
await ctx.addInitScript(([s, ver]) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', ver);
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, [JSON.stringify({ ...sv, clock: 6 * 60, night: false }), VER]);
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
await p.locator('#tCont').click();
await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
const calm = () => p.evaluate(async () => {
  const T = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0, quiet = 0; i < 60 && quiet < 3; i++) {
    let busy = false;
    if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
    else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
    quiet = busy ? 0 : quiet + 1;
    await T(busy ? 120 : 250);
  }
});
await calm();
await W(600);
await calm();

const num = (t) => +String(t).replace(/[^\d]/g, '');
await p.evaluate(() => document.querySelector('#bGuest').click());
await W(400);
const sort0 = await p.evaluate(() => document.querySelector('.sortb button[data-s]')?.textContent ?? [...document.querySelectorAll('.sortb button[data-s].on')].map((e) => e.textContent).join(''));
const bare0 = await p.evaluate(() => document.querySelectorAll('.glist .hcd-bare, .glist em .bare').length);
ok(bare0 > 0, `단골 목록에 「맨몸」 ${bare0}개`);
// 정렬 버튼을 돌리면 「맨몸 전투력」이 나온다
const sorts = [];
for (let i = 0; i < 4; i++) {
  sorts.push(await p.evaluate(() => document.querySelector('.sortb button[data-s].on')?.textContent ?? ''));
  await p.evaluate(() => { const bs = [...document.querySelectorAll('.sortb button[data-s]')]; (bs.find((x) => !x.classList.contains('on')) ?? bs[0]).click(); });
  await W(200);
}
ok(sorts.some((s) => s.includes('맨몸')) || (await p.evaluate(() => [...document.querySelectorAll('.sortb button[data-s]')].some((x) => x.textContent.includes('맨몸')))), `정렬에 맨몸 전투력 (${sorts.join(' → ')})`);
const before = await p.evaluate(() => document.querySelector('.sortb button[data-s].on')?.textContent ?? '');
// 내보내기 모드
await p.evaluate(() => document.querySelector('#gMode').click());
await W(300);
const outVals = await p.evaluate(() => [...document.querySelectorAll('.glist .hcd .hcd-pw, .glist .grow em')].filter((e) => !e.closest('.hcd')?.querySelector('.hcd-fav') && !e.closest('.grow')?.querySelector('.favstar')).map((e) => e.firstChild.textContent));
const vals = outVals.map(num);
ok(vals.length > 1 && vals.every((v, i) => !i || vals[i - 1] <= v), `내보내기 모드: 맨몸 낮은 순 (${vals.slice(0, 6).join(', ')}…)`);
ok(await p.evaluate(() => document.querySelector('.gsortln')?.textContent.includes('맨몸 전투력')), '지금 기준 한 줄 = 맨몸 전투력 낮은 순');
const over = await p.evaluate(() => [...document.querySelectorAll('.glist .hcd-txt, .sortb')].filter((e) => e.scrollWidth > e.clientWidth + 1).length);
ok(over === 0, `폭 360: 카드 글자·정렬 줄 안 넘침 (${over})`);
if (SHOT) await p.screenshot({ path: SHOT + '-out.png' });
await p.evaluate(() => document.querySelector('#gMode').click());
await W(300);
const after = await p.evaluate(() => document.querySelector('.sortb button[data-s].on')?.textContent ?? '');
ok(before === after, `모드 끝 → 원래 정렬 (${before} = ${after})`);
// 상세: 장비 낀 단골 하나
const id = await p.evaluate(() => {
  const a = window.__world.actors.find((x) => x.status === 'regular' && x.runId == null && Object.values(x.equip ?? {}).some((v) => v != null));
  return a?.id ?? null;
});
ok(id != null, '장비 낀 단골 찾음');
if (id != null) {
  await p.evaluate((id) => document.querySelector(`.glist [data-id="${id}"]`)?.click(), id);
  await W(400);
  const st = await p.evaluate(() => ({ hd: document.querySelector('.stats .sthd')?.textContent ?? '', bare: document.querySelectorAll('.stats .bare').length, strip: !!document.querySelector('#aStrip') }));
  ok(st.hd.includes('맨몸') && st.bare >= 5, `상세 두 열 (${st.hd} · ${st.bare})`);
  ok(st.strip, '[장비 모두 벗기] 버튼');
  if (SHOT) await p.screenshot({ path: SHOT + '-info.png' });
  const pw0 = await p.evaluate(() => document.querySelector('.stats .pw b').textContent);
  await p.evaluate(() => document.querySelector('#aStrip').click());
  await W(400);
  const worn = await p.evaluate((id) => Object.values(window.__world.actors.find((x) => x.id === id).equip).filter((v) => v != null).length, id);
  const toastT = await p.evaluate(() => document.querySelector('#toast, .toast')?.textContent ?? '');
  ok(worn === 0 || /모자라요/.test(toastT), `벗기기 → 남은 장비 ${worn} · ${toastT}`);
  const pw1 = await p.evaluate(() => document.querySelector('.stats .pw b').textContent);
  ok(num(pw1) <= num(pw0), `전투력 ${pw0} → ${pw1}`);
}
ok(errs.length === 0, `페이지 오류 ${errs.length}${errs.length ? ': ' + errs.join(' | ') : ''}`);
await b.close();
console.error(fail ? `\n✗ ${fail}개 실패` : '\n✓ 모두 통과');
process.exit(fail ? 1 : 0);
