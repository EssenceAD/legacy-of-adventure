// GROWTH e2e (폰·PC): 사람 누르기 → 메뉴 → 선물 → ♥ 공개(하루 1번) · ★ + 가장 좋은 걸로 입히기 · 장비 칸 → 강화 창(천장 글) ·
//  낚시(연못 창 [낚시] → 「!」 판정 창 안에 터치) · 득템 연출 · 도감(고유 장비·낚시) · 대장간(다음 목표·재련) 스크린샷
//  실행: URL=http://localhost:5197/ node scripts/e2e-growth.mjs [phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_ttabam.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/growth';
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
const shot = (n) => p.screenshot({ path: `${dir}/${name}_${n}.png` });
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 500);
  }
};
const tapAt = async (x, y) => (name === 'phone' ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
await p.goto(process.env.URL ?? 'http://localhost:5197/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
// 저장 불변: 시작 때 장비 강화 수치
const enh0 = await p.evaluate(() => window.__P.bag.map((it) => [it.id, it.enh]));

// ── §2 사람 누르기 → 메뉴 → 선물 ──
const hero = await p.evaluate(() => {
  window.__P.hunt.auto = null;
  const a = window.__world.actors.find((x) => x.heroId && x.status === 'hero' && x.runId == null && !x.hidden) ?? window.__world.actors.find((x) => x.heroId && x.runId == null);
  if (!a) return null;
  // 제자리에 세운다 (걷는 중이면 누르기 어렵다)
  a.hidden = false;
  a.at = null;
  a.path = null;
  a.st = 'idle';
  a.t = 999;
  const t = window.__P.ties[a.heroId];
  if (t) { t.giftDay = ''; t.talkDay = ''; t.knowLike = false; }
  window.__P.owner.energyUsed = 0;
  return { id: a.id, bond: a.heroId };
});
ok(!!hero, '영웅 손님이 있다');
await p.evaluate(() => { for (const g of ['tea', 'ale', 'book', 'cake', 'jerky', 'flower', 'gem', 'whet', 'candle', 'map', 'toy', 'trinket']) window.__P.gifts[g] = Math.max(2, window.__P.gifts[g] ?? 0); });
await W(300);
const xy = await p.evaluate((id) => window.__actorXY(id), hero.id);
await tapAt(xy[0], xy[1]);
await W(400);
ok(await p.locator('#pmenu').isVisible(), '사람을 누르면 작은 메뉴');
ok((await p.locator('#pmenu').textContent()).includes('선물하기') && (await p.locator('#pmenu').textContent()).includes('말 걸기'), '메뉴: [말 걸기] [선물하기]');
await shot('1_menu');
await p.locator('#pmGift').click();
await W(400);
ok(await p.locator('.gpicks').isVisible(), '선물 목록 (아이콘 · 개수)');
const likeKey = await p.evaluate((bid) => window.__growthLikes?.(bid), hero.bond);
await shot('2_giftlist');
const before = await p.evaluate(() => window.__P.counters.giftsGiven);
await p.locator(`[data-gg="${likeKey}"]`).click();
await W(500);
await settle();
ok(await p.evaluate((bid) => window.__P.ties[bid]?.knowLike === true, hero.bond), '좋아하는 선물 → ♥ 공개 (knowLike)');
ok((await p.evaluate(() => window.__P.counters.giftsGiven)) === before + 1, '선물 1번');
// 다시: ♥ 표시 · 오늘은 이미
await p.evaluate((id) => window.__giftPick(window.__world.actors.find((a) => a.id === id)), hero.id);
await W(300);
ok(await p.locator(`[data-gg="${likeKey}"] .gmark.like`).isVisible(), '선물 목록에 ♥ 표시');
ok((await p.locator('#winB').textContent()).includes('오늘은 이미 선물했어요'), '하루 한 번 안내');
await shot('3_heart');
await p.evaluate((k) => document.querySelector(`[data-gg="${k}"]`)?.click(), likeKey);
await W(300);
ok((await p.evaluate(() => window.__P.counters.giftsGiven)) === before + 1, '같은 날 두 번째 선물은 안 됨');
await settle();
// 모모(마을 사람) 메뉴
const mxy = await p.evaluate(() => { const m = window.__world.actors.find((a) => a.role === 'npc'); if (m) { m.path = null; m.st = 'idle'; m.t = 999; m.hidden = false; } return window.__actorXY('momo'); });
if (mxy) {
  await tapAt(mxy[0], mxy[1]);
  await W(400);
  ok(await p.locator('#pmenu').isVisible() && (await p.locator('#pmenu').textContent()).includes('편지'), '모모: [말 걸기] [선물하기] [편지 쓰기]');
  await shot('4_momo');
  await p.mouse.click(5, 5);
  await settle();
}

// ── §3-1 ★ + 가장 좋은 걸로 입히기 ──
const reg = await p.evaluate(() => {
  const a = window.__world.actors.find((x) => x.status === 'regular' && x.runId == null && x.equip?.weapon != null);
  if (!a) return null;
  const cur = window.__P.bag.find((i) => i.id === a.equip.weapon);
  const it = JSON.parse(JSON.stringify(cur));
  it.id = window.__P.nextItemId++;
  it.owner = null;
  it.locked = false;
  it.name = '시험용 좋은 검';
  for (const k of Object.keys(it.stats)) it.stats[k] = it.stats[k] * 4 + 50;
  window.__P.bag.push(it);
  window.__P.growth.favs = [];
  return { id: a.id, item: it.id };
});
ok(!!reg, '단골 + 더 좋은 장비 준비');
await p.evaluate((id) => window.__showActor(window.__world.actors.find((a) => a.id === id)), reg.id);
await W(300);
await p.locator('#aFav').click();
await W(300);
ok(await p.evaluate((id) => window.__P.growth.favs.includes(id), reg.id), '★ 아끼는 영웅');
ok((await p.locator('#aFav').textContent()).includes('★'), '★ 버튼 켜짐');
await p.locator('#aBest').click();
await W(300);
const sum = await p.locator('.bestsum').textContent();
ok(/무기 \+[\d,]+/.test(sum), `미리보기 「${sum}」`);
await shot('5_best_preview');
await p.locator('#bOk').click();
await W(300);
ok(await p.evaluate((o) => window.__world.actors.find((a) => a.id === o.id).equip.weapon === o.item, reg), '확인 → 무기 교체');
// 손님 목록 맨 위 ★
await p.evaluate(() => window.__openGuests?.());
await W(300);
if (await p.locator('.glist').count()) ok((await p.locator('.glist button').first().textContent()).includes('★'), '손님 목록 맨 위 ★');

// ── §3-2 장비 칸 → 강화 창 · 천장 글 ──
await p.evaluate((o) => {
  const it = window.__P.bag.find((i) => i.id === o.item);
  it.enh = 7;
  it.ePity = 0.09;
  window.__P.dust[it.grade] = Math.max(window.__P.dust[it.grade], 50000);
  window.__P.growth.charm = 2;
  window.__P.growth.whet = 1;
  window.__showActor(window.__world.actors.find((a) => a.id === o.id));
}, reg);
await W(300);
await p.locator('.slot[data-s="weapon"]').click();
await W(300);
const pity = await p.locator('#ePity').textContent();
ok(/다음 성공률 \d+% \(\+9%\)/.test(pity), `강화 창 천장 글 「${pity.trim()}」`);
ok(await p.locator('#eCharm').isEnabled() && await p.locator('#eWhet').isEnabled(), '[부적 쓰기] [숫돌 쓰기] 체크칸');
await shot('6_enhance');
await p.locator('#eCharm').check();
await p.locator('#eGo').click();
await W(400);
const after = await p.evaluate((o) => { const it = window.__P.bag.find((i) => i.id === o.item); return { enh: it.enh, pity: it.ePity ?? 0, charm: window.__P.growth.charm }; }, reg);
ok(after.enh >= 7 && (after.enh > 7 || after.pity > 0.09 || after.charm < 2), `강화 한 번 (부적 체크 · 하락 없음) → +${after.enh} 천장 ${after.pity}`);
await settle();

// ── §3-6 · §3-4 대장간: 다음 목표 · 재련 ──
await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'smith' && x.lvl >= 5) ?? window.__world.objs.find((x) => x.kind === 'smith'); window.__showObj(o); });
await W(300);
ok((await p.locator('.goalln').textContent()).includes('다음 목표'), '대장간 맨 위 「다음 목표」');
await shot('7_smith_goal');
await p.locator('#sGoal').click();
await W(300);
ok(await p.locator('#ePity').count() > 0, '[바로 강화] → 강화 창');
await settle();
await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'smith' && x.lvl >= 5) ?? window.__world.objs.find((x) => x.kind === 'smith'); window.__showObj(o); });
await W(300);
await p.locator('#smT [data-t="4"]').click();
await W(300);
const rf = p.locator('[data-rf]').first();
if (await rf.count()) {
  await p.evaluate(() => { window.__S.gold += 100000; for (const g of ['r', 'e', 'l', 'a']) window.__P.dust[g] += 5000; });
  await rf.click();
  await W(300);
  await shot('8_reforge');
  const o0 = await p.locator('.rfopts').textContent();
  await p.locator('#rfGo').click();
  await W(400);
  ok((await p.locator('.rfopts').textContent()) !== o0 || (await p.locator('.rfopt.new').count()) > 0, '재련: 옵션 하나가 바뀜');
}
await settle();

// ── §4 낚시: 연못 창 [낚시] → 「!」 판정 창 안에 누르기 ──
await p.evaluate(() => window.__showObj({ kind: 'koi_pond', tx: 0, ty: 0, fw: 2, fh: 2, sprite: 'koi_pond', lvl: 1, hue: null, inside: [] }));
await W(300);
ok(await p.locator('[data-fishing="pond"]').isVisible(), '잉어 연못 창에 [낚시]');
await p.locator('[data-fishing="pond"]').click();
await W(300);
await shot('9_fishing');
for (const [id, want] of [['koi', true], ['minnow', false]]) {
  await p.evaluate((id) => window.__fish.force(id), id);
  const box = await p.locator('#fStage').boundingBox();
  await p.locator('#fCast').click();
  if (want) {
    await p.waitForSelector('#fStage.bite', { timeout: 6000, polling: 'raf' });
    await tapAt(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    // 너무 일찍 누르면 놓친다
    await W(200);
    await tapAt(box.x + box.width / 2, box.y + box.height / 2);
  }
  await W(250);
  const tap = await p.evaluate(() => window.__fishTap);
  const rec = await p.evaluate((id) => window.__P.growth.fish.rec[id]?.n ?? 0, id);
  if (want) {
    ok(rec === 1, `「!」 뜬 뒤 ${name === 'phone' ? '터치' : '클릭'} → 비단잉어 낚음 (누른 시각 ${tap?.t?.toFixed(2)}s · 입질 ${tap?.bite?.toFixed(2)}s · 창 ${tap?.win}s)`);
    await shot('10_catch');
  } else ok(rec === 0 && /일렀|놓쳤|미끼|웃으면서/.test(await p.locator('#fMsg').textContent()), '입질 전에 누르면 놓침');
  await W(1800);
}
// 주점 요리 · 도감 · 업적
await p.evaluate(() => { window.__P.growth.fish.bag.minnow = 2; const tv = window.__world.objs.find((o) => o.kind === 'tavern'); window.__showObj(tv); });
await W(300);
ok(await p.locator('[data-cook="minnow"]').isVisible(), '주점 창에 물고기 요리');
await p.locator('[data-cook="minnow"]').click();
await W(300);
ok(await p.evaluate(() => (window.__P.growth.meal?.v ?? 0) > 0), '요리 → 원정 버프');
await settle();
// §3-6 사냥 결과(소탕) 「대장간에서 쓸 수 있는 것」 줄 → 대장간
await p.evaluate(() => { for (const g of ['n', 'r', 'e', 'l']) window.__P.dust[g] += 100000; window.__openHunt('forest'); });
await W(300);
await p.locator('.hst[data-s="10"]').click();
await W(400);
await p.locator('#hSweep').click();
await W(500);
const sl = p.locator('#cSmith');
const slText = (await sl.count()) ? (await sl.textContent()).trim() : '';
ok(/대장간에서 쓸 수 있는 것: 강화 \d+ · 제작 \d+/.test(slText), `사냥 결과 줄 「${slText}」`);
await shot('16_hunt_smithline');
await sl.click();
await W(400);
ok((await p.locator('#winT').textContent()).includes('대장간'), '줄을 누르면 대장간');
await settle();
// 박제 → 건설 목록에 무료 장식
p.on('dialog', (d) => d.accept());
await p.evaluate(() => { window.__P.growth.fish.bag.kingkoi = 1; window.__fish.open('pond'); });
await W(300);
await p.locator('[data-fstuff="kingkoi"]').click();
await W(300);
ok(await p.evaluate(() => window.__P.meta.giftDeco.fish_kingkoi === 1), '박제 → 장식 1개');
await settle();
await p.locator('#bBuild').click();
await W(400);
ok(await p.locator('[data-k="fish_kingkoi"]').count() > 0, '건설 목록에 「왕관 쓴 황금 잉어 박제」');
await p.locator('[data-k="fish_kingkoi"]').scrollIntoViewIfNeeded();
await shot('15_trophy_build');
await settle();
const tabIdx = async (label) => p.evaluate((label) => { window.__openDex(0); const bs = [...document.querySelectorAll('#dT .tab')]; const i = bs.findIndex((x) => x.textContent.includes(label)); return i; }, label);
for (const [label, file] of [['고유 장비', '11_dex_unique'], ['낚시', '12_dex_fish']]) {
  const i = await tabIdx(label);
  ok(i >= 0, `도감 「${label}」 칸`);
  if (i >= 0) {
    await p.evaluate((i) => window.__openDex(i), i);
    await W(300);
    await shot(file);
  }
}
await settle();
// ── §3-4 득템 연출 ──
await p.evaluate(() => window.__fanfare([{ grade: 'a', name: '텐구 깃털 단검', uid: 'u_ice_w' }]));
await W(250);
ok(await p.locator('.fanfare.ff-a').count() === 1, '유물: 화면 반짝 + 이름 크게');
await shot('13_fanfare_relic');
await W(2000);
await p.evaluate(() => window.__fanfare([{ grade: 'l', name: '별빛 검' }]));
await W(300);
await shot('14_fanfare_legend');
await W(1600);
// 저장 불변: 시험으로 건드린 장비 말고는 강화 수치 그대로
const enh1 = await p.evaluate(() => window.__P.bag.map((it) => [it.id, it.enh]));
const m1 = new Map(enh1);
const changed = enh0.filter(([id, e]) => m1.has(id) && m1.get(id) !== e);
ok(changed.length === 0, `원래 장비 강화 수치 그대로 (바뀐 것 ${changed.length})`);
ok(!errs.length, `페이지 오류 없음 ${errs.join(' | ')}`);
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
