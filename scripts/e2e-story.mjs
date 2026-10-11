// STORY_V1 e2e: 3막 전환 컷 → 모모 편지 → 갈림길(은퇴) → 장부 카드 → (시간 가속) 목표 완료 → 유안 등장 → 엔딩 컷 → 기억 조각 → 엔딩 카드
//  → 새 여관 열기(모모 확인 · 시작 선물) → 2회차 오프닝 대사 · 남는 것(앨범·포인트)/지우는 것(막·루트) · 앨범 「이야기」·「기억」
//  실행: dist-bot 미리보기 4190 · node scripts/e2e-story.mjs [phone|pc] → screenshots/story/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
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
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (d) => d.accept());
const W = (ms) => p.waitForTimeout(ms);
const dir = 'screenshots/story';
fs.mkdirSync(dir, { recursive: true });
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const shot = (k) => p.screenshot({ path: `${dir}/${name}_${k}.png` });
const winT = () => p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT').textContent : ''));
const talking = () => p.evaluate(() => !document.querySelector('#dlg').hidden);
/** 대화를 끝까지 넘기며 글을 모은다 (shotAt: 이 글이 보이면 한 장) */
async function readTalk(shotAt = [], max = 400) {
  const raw = [];
  const shotDone = new Set();
  for (let i = 0; i < max && (await talking()); i++) {
    // 다 찍힐 때까지 기다렸다가 읽고 → 한 번 눌러 다음 줄
    await p.waitForFunction(() => { const d = document.querySelector('#dText'); const t = d?.textContent ?? ''; const ok = t && t === window.__lt; window.__lt = t; return ok || document.querySelector('#dlg').hidden; }, null, { polling: 120, timeout: 8000 }).catch(() => {});
    const t = await p.evaluate(() => document.querySelector('#dText')?.textContent ?? '');
    if (t && raw[raw.length - 1] !== t) raw.push(t);
    for (const [re, k] of shotAt) if (re.test(t) && !shotDone.has(k)) (shotDone.add(k), await shot(k));
    await p.locator('#dlg').click().catch(() => {});
    await W(80);
  }
  return raw;
}
const heard = [];
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    if (await talking()) heard.push(...(await readTalk()));
    else if (await winT()) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(250);
  }
};
await p.goto((process.env.URL ?? 'http://localhost:4190/') + '', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
await W(1500);
await clear();
const st0 = await p.evaluate(() => ({ act: window.__P.story.act, gen: window.__P.legacy.gen, day0: window.__P.story.day0 }));
ok(st0.act >= 1, `불러오기 → 막 추정 ${st0.act}막 · ${st0.gen}회차`);

// ── 3막: 조건을 채우면 컷이 저절로
await p.evaluate(() => {
  const P = window.__P;
  P.story.act = 2;
  P.dex.heroes.kael = { appeared: true, recruited: true, stars: 1 };
  window.__S.day = P.story.day0 + 45;
  P.runs.length = 0;
  P.hunt.auto = null;
});
await p.evaluate(() => window.__story.ledgerAll());
let started = false;
for (let i = 0; i < 20 && !started; i++) {
  await W(500);
  started = await talking();
}
ok(started, '3막 컷이 저절로 시작');
const act3 = await readTalk([[/별이 비처럼/, 'act3_cut']]);
ok(act3.some((t) => /은빛 머리의 늙은 기사/.test(t)), '오스윈을 못 만났으면 소개 줄');
ok(act3.some((t) => /별이 비처럼/.test(t)) && act3.some((t) => /어느 쪽이든 틀린 길은 없네/.test(t)), `3막 컷 대사 ${act3.length}줄`);
await W(3200);
ok(/편지/.test(await winT()), '컷 뒤 모모의 편지: ' + (await winT()));
await shot('letter');
await p.locator('#sPick').click();
await W(500);
const routes = await p.evaluate(() => [...document.querySelectorAll('[data-route]')].map((b) => ({ id: b.dataset.route, lock: b.classList.contains('lock'), top: /✨/.test(b.textContent) })));
ok(routes.length === 5 && routes.filter((r) => r.top).length === 1 && routes.filter((r) => !r.lock).map((r) => r.id).join() === 'retire', `갈림길 5개 · ✨ 1개 · 열린 건 은퇴: ${routes.map((r) => r.id + (r.lock ? '🔒' : '') + (r.top ? '✨' : '')).join(' ')}`);
await shot('routes');
await p.locator('[data-route="hero"]').click();
await W(300);
ok(!(await talking()) && (await p.evaluate(() => window.__P.story.route)) === null, '잠긴 루트는 못 고름');
await p.locator('[data-route="retire"]').click();
await W(400);
const pick = await readTalk();
ok(pick.some((t) => /평범한 하루/.test(t)), '은퇴 고르기 대사');
await W(1500);
const card = await p.evaluate(() => document.querySelector('#mission')?.textContent ?? '');
ok(/갈림길/.test(card), '장부 카드 = 갈림길: ' + card.slice(0, 60));
await shot('route_card');

// ── 시간 가속: 목표를 채우고 하루를 넘긴다 → 다음 날 아침 유안
await p.evaluate(() => {
  const P = window.__P;
  window.__S.day = P.story.day0 + 70;
  P.story.goodDays = 30;
  P.counters.harvests = Math.max(P.counters.harvests, 120);
});
await W(1500);
await clear();
const nextDay = async () => {
  await p.evaluate(() => (window.__S.clock = 24 * 60 - 2));
  for (let i = 0; i < 12; i++) {
    await W(500);
    if (await talking()) return;
  }
};
await nextDay();
await clear();
await nextDay();
let heir = [];
for (let i = 0; i < 10 && !heir.length; i++) {
  await W(500);
  if (await talking()) heir = await readTalk();
}

await W(1500);
const yuan = await p.evaluate(() => window.__world.actors.some((a) => a.role === 'yuan'));
ok(yuan && (await p.evaluate(() => window.__P.story.heir)) === 1, '유안이 마을에 서 있음');
await shot('yuan');

// ── 엔딩: 카드를 누르면 (= 유안에게 말 걸기)
await clear();
ok([...heir, ...heard].some((t) => /낡은 배낭/.test(t)), '유안 도착 대사 (목표 완료 줄 다음 차례)');
const mc = await p.evaluate(() => { const m = document.querySelector('#mission'); return { hidden: m.hidden, text: m.textContent, talk: !document.querySelector('#dlg').hidden, win: document.querySelector('#winT').textContent }; });
ok(!mc.hidden && /유안/.test(mc.text), '장부 카드 「유안에게 말 걸기」: ' + JSON.stringify(mc).slice(0, 160));
await p.evaluate(() => document.querySelector('#mission').click());
await W(400);
const end = await readTalk([[/한 계절이 되었다/, 'end_seasons'], [/오래된 장부를 꺼냈다/, 'end_ledger'], [/…허허\./, 'end_heh'], [/문 앞에는 늘 불이/, 'end_photo']], 200);
ok(end.some((t) => /— 조용한 은퇴 —/.test(t)), `엔딩 컷 ${end.length}줄`);
ok(end.includes('…허허.') && end.some((t) => /^이 장부를 받게/.test(t)), '「…허허.」 + 「이 장부를 받게…」 두 줄');
ok(end.some((t) => /기억 조각을 얻었다/.test(t)), '기억 조각');
await W(600);
ok(/엔딩/.test(await winT()), '엔딩 카드: ' + (await winT()));
const ec = await p.evaluate(() => document.querySelector('#winB').textContent);
ok(/엔딩 1\/5/.test(ec) && /조용한 은퇴/.test(ec) && /플레이 시간/.test(ec) && /유산 포인트/.test(ec), '엔딩 카드 내용');
await shot('ending_card');
const st1 = await p.evaluate(() => ({ album: window.__P.legacy.album.includes('story_retire'), pts: window.__P.legacy.pts, thumb: !!localStorage.getItem('legacy-of-adventure-storyThumb.story_retire') }));
ok(st1.album && st1.pts >= 150, `앨범에 기록 · 유산 포인트 ${st1.pts} · 사진 ${st1.thumb ? '있음' : '없음'}`);
await p.locator('#sAlbum').click();
await W(300);
await p.locator('#sNew').click();
await W(400);
const conf = await readTalk();
ok(conf.some((t) => /새 여관 주인 이야기를 시작하시는 거예요/.test(t)), '모모의 확인 대사');
await W(400);
ok(/새 여관 열기/.test(await winT()), '확인 창');
await p.locator('#sNewOk').click();
await W(600);
ok(/다음 세대/.test(await winT()), '유산 화면: ' + (await winT()));
await p.locator('[data-gift="gold"]').click();
await W(200);
await p.locator('#cName').fill('유산이');
await shot('legacy_gifts');
const gold0 = await p.evaluate(() => window.__S.gold);
await p.locator('#cOk').click();
await W(600);
const op = await readTalk();
ok(op.some((t) => /처음 보는 얼굴 같지가 않아/.test(t)), '2회차 오프닝 대사 (버나드)');
const st2 = await p.evaluate(() => ({ gen: window.__P.legacy.gen, act: window.__P.story.act, route: window.__P.story.route, album: window.__P.legacy.album.includes('story_retire'), bak: !!localStorage.getItem('legacy-of-adventure-save.bak.cycle1'), gold: window.__S.gold }));
ok(st2.gen === 2 && st2.act === 1 && st2.route === null && st2.album && st2.bak, `새 회차: ${st2.gen}회차 · ${st2.act}막 · 앨범 남음 · 백업 ${st2.bak}`);
ok(st2.gold - gold0 >= 3000, `비상금 +${st2.gold - gold0}`);
// 앨범
await clear();
await p.evaluate(() => document.querySelector('#bOwner').click());
await W(500);
await p.locator('#oAlbum').click();
await W(500);
const alb = await p.evaluate(() => ({ seen: !!document.querySelector('[data-se="story_retire"]'), mem: document.querySelectorAll('[data-mem]').length }));
ok(alb.seen && alb.mem >= 1, `앨범 「이야기」 칸 · 기억 ${alb.mem}개`);
await p.evaluate(() => document.querySelector('[data-se]')?.scrollIntoView());
await shot('album');
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
