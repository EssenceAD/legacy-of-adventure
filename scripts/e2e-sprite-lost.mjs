// SPRLOST 회귀: 웅스(롯데캐슬 171채 · 갤럭시) 「앱을 내렸다 오거나 채팅창을 열면 건물·나무·장식이 다 사라지고 바닥·울타리·이름표만 — 새로고침 전까지」
//  원인: 깨진 그림 다시 불러오기 횟수(reloadMax 5)가 세션 누적 → 같은 그림을 다섯 번 잃으면 다시는 안 불러온다
//  폰 화면(412×915 · dpr 2.625 · 터치)으로 웅스 저장을 불러와서
//   A. 같은 그림을 6번(+) 잃어도 매번 다시 그려진다
//   B. 다시 불러오기가 계속 실패해 포기한 뒤 → 앱 숨김→보임(visibilitychange)이면 횟수가 0부터 → 다시 그려진다
//   C. 채팅창 열기 + 화면 크기 바뀜(키보드) 동안 화면의 그림을 한꺼번에 잃어도 다시 그려진다
//   D. 안전망: 하나하나 다시 불러오기가 안 돼도 3초 넘게 30% 넘게 못 그리면 원본을 모두 다시 받아 되살린다
//   E. 그것도 안 되면 윗줄 「그림 다시 불러오기」 버튼 → 누르면 되살아나고 버튼은 숨는다
//   F. 폰 · 큰 마을 캐시 상한 적용 + 한밤에 같은 화면을 그리는 동안 밤 색조 캐시를 매 프레임 다시 만들지 않는다(thrash 없음)
//  실행: URL=http://localhost:4321/ node scripts/e2e-sprite-lost.mjs [저장 json]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = process.env.URL ?? 'http://localhost:4321/';
const SCR = 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/woongs3/save_01.json';
const file = process.argv[2] ?? (fs.existsSync(SCR) ? SCR : 'tests/fixtures/real_woongs.json');
const raw = fs.readFileSync(file, 'utf8');
const ONLY = process.env.ONLY ?? 'ABCDEF';
let fail = 0;
const ok = (c, m) => {
  console.log((c ? '✓ ' : '✗ ') + m);
  if (!c) fail++;
};

const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  // 숨김/보임 흉내용
  let vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { get: () => vis, configurable: true });
  Object.defineProperty(document, 'hidden', { get: () => vis === 'hidden', configurable: true });
  window.__setVis = (v) => {
    vis = v;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('visibilitychange'));
  };
  try {
    if (sessionStorage.getItem('x')) return;
    sessionStorage.setItem('x', 1);
  } catch {
    return;
  }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, raw);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => {
      if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true;
      if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true;
      return false;
    });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 500);
  }
};
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
const info = await p.evaluate(() => ({ n: window.__world.objs.length, size: document.documentElement.dataset.size, guard: !!window.__spriteGuard }));
console.log(`저장 ${file} · 건물 ${info.n}채 · data-size=${info.size}`);
ok(info.n > 100, '큰 마을(100채 넘게)');
ok(info.size === 'phone', '폰 크기');

/** 건물 하나에 카메라를 맞춘다 (화면 가운데) */
const centerOn = (key) =>
  p.evaluate((key) => {
    const o = window.__world.objs.find((b) => b.sprite === key);
    const v = window.__view;
    v.goal = { x: ((o.tx + o.fw / 2 - (o.ty + o.fh / 2)) * 32) / 2, y: ((o.tx + o.fw / 2 + o.ty + o.fh / 2 - 32) * 16) / 2 };
    v.cam.x = v.goal.x;
    v.cam.y = v.goal.y;
  }, key);
/** 화면에 보이는 건물 그림 이름들 (반전 포함) */
await p.evaluate(() => {
  window.__visSprites = () => {
    const v = window.__view;
    const S = new Set();
    for (const o of window.__world.objs) {
      // 지붕 색을 바꾼 건물(hue)은 지붕 색 캐시에서 그리므로 원본을 잃어도 그대로 보인다 → 빼고 센다
      if (!o.sprite || o.kind === 'fire' || o.hue != null) continue;
      const r = window.__objRect?.(o);
      if (!r) continue;
      const [x, y, w, h] = r;
      if (x + w > 0 && y + h > 0 && x < v.LW && y < v.LH) S.add(o.sprite);
    }
    return [...S];
  };
});
const visibleSprites = () => p.evaluate(() => window.__visSprites());
/** 그 그림들(없으면 「지금」 화면에 보이는 건물 그림 모두)을 다 그릴 수 있고 마지막 프레임에 못 그린 게 0인가 */
const healed = (keys, ms = 9000) =>
  p
    .waitForFunction(
      (keys) => {
        const ks = keys ?? window.__visSprites();
        return ks.length > 0 && ks.every((k) => window.__spriteOk(k)) && (!window.__spriteGuard || window.__spriteGuard().last.bad === 0);
      },
      keys,
      { timeout: ms, polling: 200 },
    )
    .then(() => true)
    .catch(() => false);
const stat = () =>
  p.evaluate(() => {
    if (!window.__spriteGuard) return null;
    const g = window.__spriteGuard();
    return { last: g.last, counts: g.counts, refetches: g.refetches, stage: g.stage, events: g.events };
  });

// 웅스 마을 가운데 건물 하나
const key = await p.evaluate(() => {
  const o = window.__world.objs.find((b) => b.sprite && !b.sprite.endsWith('~f') && b.hue == null && b.kind !== 'inn' && b.kind !== 'fire' && window.__spriteOk(b.sprite));
  return o.sprite;
});
await centerOn(key);
await W(800);

if (ONLY.includes('A')) {
  // A. 같은 그림 6번 잃기 (캔버스 잃음 · 디코드 실패 번갈아) — 예전 코드는 6번째부터 다시 안 불러왔다
  const res = [];
  for (let i = 0; i < 7; i++) {
    await p.evaluate(([k, m]) => window.__breakSprite(k, m), [key, i % 2 ? 'img' : 'canvas']);
    const h = await p
      .waitForFunction((k) => window.__spriteOk(k), key, { timeout: 7000, polling: 100 })
      .then(() => true)
      .catch(() => false);
    res.push(h);
  }
  ok(res.every(Boolean), `A. 같은 그림(${key})을 7번 잃어도 매번 다시 그려짐: ${res.map((x) => (x ? 'o' : 'x')).join('')}`);
  const s = await stat();
  if (s) ok(s.counts[key] === 0, `A. 다시 불러오기 성공하면 횟수 0: ${s.counts[key]}`);
}

if (!info.guard) {
  console.log('(__spriteGuard 없음 — 옛 빌드: A만)');
} else {
  if (ONLY.includes('B')) {
    // B. 다시 불러오기가 계속 실패 → 포기 → 앱 숨김→보임 → 0부터 다시 → 되살아남
    await p.evaluate(() => window.__spriteGuard().fetchFail('reload'));
    await p.evaluate(() => window.__spriteGuard().watch(false));
    for (let i = 0; i < 7; i++) {
      await p.evaluate((k) => window.__breakSprite(k, 'canvas'), key);
      await W(250);
    }
    let s = await stat();
    ok(s.counts[key] >= 5 && !(await p.evaluate((k) => window.__spriteOk(k), key)), `B. 계속 실패하면 포기(횟수 ${s.counts[key]})`);
    await p.evaluate(() => window.__spriteGuard().fetchFail(false));
    await W(5000);
    ok(!(await p.evaluate((k) => window.__spriteOk(k), key)), 'B. 포기한 뒤엔 저절로는 안 돌아옴 (보임 이벤트 전)');
    await p.evaluate(() => window.__setVis('hidden'));
    await W(300);
    await p.evaluate(() => window.__setVis('visible'));
    s = await stat();
    ok(s.counts[key] === undefined || s.counts[key] === 0, `B. 보임 → 횟수 0: ${s.counts[key]}`);
    ok(await healed([key]), 'B. 보임 뒤 다시 그려짐');
    // 같은 걸 resize 로도
    await p.evaluate(() => window.__spriteGuard().fetchFail('reload'));
    for (let i = 0; i < 7; i++) {
      await p.evaluate((k) => window.__breakSprite(k, 'img'), key);
      await W(250);
    }
    await p.evaluate(() => window.__spriteGuard().fetchFail(false));
    await p.setViewportSize({ width: 412, height: 600 });
    await W(400);
    await p.setViewportSize({ width: 412, height: 915 });
    ok(await healed([key]), 'B. 화면 크기 바뀜(resize) 뒤 다시 그려짐');
    await p.evaluate(() => window.__spriteGuard().watch(true));
  }

  if (ONLY.includes('C')) {
    // C. 채팅창 열기 + 키보드(화면 높이 줄어듦) 동안 화면 그림을 모두 잃음 (숨김→보임 겹쳐서)
    await W(4500);
    const vis = await visibleSprites();
    await p.evaluate(() => document.getElementById('chatlog')?.click());
    await W(400);
    await p.setViewportSize({ width: 412, height: 520 });
    await p.evaluate(() => window.__setVis('hidden'));
    await p.evaluate((ks) => ks.forEach((k, i) => window.__breakSprite(k, i % 2 ? 'img' : 'canvas')), vis);
    await p.evaluate(() => window.__setVis('visible'));
    await W(300);
    await p.setViewportSize({ width: 412, height: 915 });
    await settle();
    const hc = await healed(null, 12000);
    if (!hc) console.log('  C 상태:', JSON.stringify(await stat()).slice(0, 600), JSON.stringify(await p.evaluate((ks) => ks.filter((k) => !window.__spriteOk(k)), await visibleSprites())));
    ok(vis.length >= 5 && hc, `C. 채팅창·키보드·숨김→보임 동안 화면 그림 ${vis.length}장을 잃어도 (지금 화면 건물이 모두) 다시 그려짐`);
  }

  if (ONLY.includes('D')) {
    // D. 하나하나 다시 불러오기가 안 됨 → 3초 넘게 30% 넘게 못 그림 → 원본 모두 다시 받기(안전망)
    await centerOn(key);
    await W(4500);
    const vis = await visibleSprites();
    await p.evaluate(() => window.__spriteGuard().fetchFail('reload'));
    const t0 = Date.now();
    await p.evaluate((ks) => ks.forEach((k) => window.__breakSprite(k, 'canvas')), vis);
    const s0 = await p.waitForFunction(() => window.__spriteGuard().last.bad > 0, null, { timeout: 3000 }).then(() => stat());
    ok(s0.last.bad / s0.last.n > 0.3, `D. 못 그린 비율 ${s0.last.bad}/${s0.last.n}`);
    const got = await healed(vis, 10000);
    const dt = Date.now() - t0;
    const s = await stat();
    ok(got && s.refetches >= 1 && dt >= 3000, `D. 안전망이 원본을 다시 받아 되살림 (${dt}ms · 다시 받기 ${s.refetches}번)`);
    await p.evaluate(() => window.__spriteGuard().fetchFail(false));
  }

  if (ONLY.includes('E')) {
    // E. 원본 다시 받기도 실패 → 버튼 → (네트워크 돌아옴) 누르면 되살아나고 버튼은 숨는다
    await W(4500);
    const vis = await visibleSprites();
    await p.evaluate(() => window.__spriteGuard().fetchFail('all'));
    await p.evaluate((ks) => ks.forEach((k) => window.__breakSprite(k, 'canvas')), vis);
    const shown = await p
      .waitForFunction(() => !document.getElementById('bRefetch').hidden, null, { timeout: 15000, polling: 200 })
      .then(() => true)
      .catch(() => false);
    ok(shown, 'E. 다시 받기도 실패하면 윗줄에 「그림 다시 불러오기」 버튼');
    await p.screenshot({ path: 'screenshots/sprlost-button.png' }).catch(() => {});
    await p.evaluate(() => window.__spriteGuard().fetchFail(false));
    await p.evaluate(() => document.getElementById('bRefetch').click());
    ok(await healed(vis, 10000), 'E. 버튼을 누르면 다시 그려짐');
    const hid = await p
      .waitForFunction(() => document.getElementById('bRefetch').hidden, null, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    ok(hid, 'E. 되살아나면 버튼이 숨는다');
    const s = await stat();
    console.log('  sprite_lost 기록(개발 빌드는 보내지 않고 모아만 봄):', JSON.stringify(s.events.slice(-8)));
    ok(s.events.length > 0 && s.events.length <= 24 && s.events.every((e) => e.ua && e.dpr && e.size && typeof e.n === 'number' && e.vis), `E. sprite_lost 기록 ${s.events.length}개 (상한 안 · 기기 요약 · visibilityState)`);
  }

  if (ONLY.includes('F')) {
    // F. 캐시 상한 · thrash 없음: 밤으로 바꾸고(낮→밤 단계 0~10) 지도 네 군데에서 — 같은 화면을 그리는 동안 밤 색조 캐시 버림이 프레임당 3장 미만
    const m0 = await p.evaluate(() => window.__renderMem().lru);
    ok(m0.tint.cap <= 360 && m0.recolor.cap <= 32 && m0.hit.cap <= 24, `F. 폰·큰 마을 상한: tint ${m0.tint.cap} · recolor ${m0.recolor.cap} · hit ${m0.hit.cap}`);
    const r = await p.evaluate(async () => {
      const v = window.__view;
      const S = window.__S;
      const objs = window.__world.objs.filter((o) => o.sprite);
      const frames = (n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      const mem = () => window.__renderMem().lru;
      // 낮 → 밤 전환 동안 (실제 게임 루프) 버림 수 · 최대 장 수
      const e0 = mem().tint.evicted;
      if (!S.night) document.getElementById('bDN').click();
      let peak = 0;
      for (let i = 0; i < 150 && S.nightT < 0.97; i++) { await frames(4); peak = Math.max(peak, mem().tint.n); }
      const trans = mem().tint.evicted - e0;
      const out = [];
      for (let s = 0; s < 4; s++) {
        const o = objs[Math.floor((objs.length * s) / 4)];
        v.goal = null;
        v.cam.x = ((o.tx + o.fw / 2 - (o.ty + o.fh / 2)) * 32) / 2;
        v.cam.y = ((o.tx + o.fw / 2 + o.ty + o.fh / 2 - 32) * 16) / 2;
        await frames(90);
        const a = mem().tint.evicted;
        const f0 = window.__stats.frames;
        await frames(150);
        const drawn = Math.max(1, window.__stats.frames - f0);
        out.push({ spot: s, perFrame: Math.round(((mem().tint.evicted - a) / drawn) * 10) / 10, drawn, n: mem().tint.n, recolorEv: mem().recolor.evicted, hitEv: mem().hit.evicted });
      }
      return { trans, peak, nightT: S.nightT, out };
    });
    console.log('  ', JSON.stringify(r));
    ok(r.nightT > 0.9, 'F. 밤으로 바뀜');
    // 손님 걸음 프레임이 바뀌는 몫(상한 900에서도 프레임당 ~1장)은 있다 — thrash(상한 100: 프레임당 ~6장)가 아니면 통과
    ok(r.out.every((x) => x.perFrame < 3), 'F. 같은 화면을 그리는 동안 밤 색조 캐시 버림이 프레임당 3장 미만 (thrash 없음)');
  }
}

await W(500);
ok(errs.length === 0, '페이지 오류 0: ' + errs.join(' | '));
await b.close();
console.log(fail ? `✗ 실패 ${fail}` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
