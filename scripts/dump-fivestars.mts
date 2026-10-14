// FIVESTARS ④ 비교 시트 → reports/fivestars/step4/
//  도트는 실제 게임 코드(src/engine/stars2.ts · named2.ts · sprites2.ts)가 그린다 — 이 스크립트는 그걸 불러다 펼칠 뿐
//  node scripts/dump-fivestars.mts                 → stars.png (초상 · 지금 · 새 서기·걷기·뒤 · 대기 동작 4 · 공격 4 · 시전 · 앉기)
//                                                    lineup.png (다섯 한 줄 · 실제 크기 ×1 / ×4 · 전설 14 · 전설 신화 옆에)
//  URL=http://localhost:4293/ node scripts/dump-fivestars.mts village   → village_{day,night}_{360,1280}.png · combat_{360,1280}.png · constellation_{360,1280}.png
//    (BOT_BUILD=1 npx vite build --outDir dist-bot-dot5 && npx vite preview --outDir dist-bot-dot5 --port 4293 --strictPort)
import { chromium, type Page } from 'playwright-core';
import fs from 'node:fs';

const OUT = process.env.OUT ?? 'reports/fivestars/step4';
fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] ?? 'sheets';
const savePng = (file: string, dataUrl: string) => {
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.error('✓ ' + file);
};

if (mode === 'sheets') await sheets();
else await village();

async function sheets() {
  const { createServer } = await import('vite');
  const port = Number(process.env.PORT ?? 4334);
  const server = await createServer({ server: { port, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const base = `http://localhost:${port}/`;
  const b = await chromium.launch({ channel: 'chrome' });
  try {
    const p = await b.newPage();
    await p.route(base, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1b1622"></body>' }));
    await p.goto(base);
    p.on('pageerror', (e) => console.error('pageerror', e));
    // 초상(asset_raw)은 dev 서버 밖이라 data URL로 넘긴다
    const pics: Record<string, string> = {};
    for (const id of ['woongs', 'gonu', 'ikamolly', 'walwal', 'warmnight']) pics[id] = 'data:image/png;base64,' + fs.readFileSync(`asset_raw/fivestars/s_${id}.png`).toString('base64');
    await p.evaluate(async (pics) => {
      const w = window as any;
      w.PICS = pics;
      w.SP = await import('/src/engine/sprites.ts');
      w.FL = await import('/src/world/flags.ts');
      w.CL = await import('/src/data/classes.ts');
      w.FS = await import('/src/data/fivestars.ts');
      w.LG = await import('/src/data/legends.ts');
    }, pics);
    await p.addScriptTag({ content: 'window.starDef = ' + starDef.toString() });
    savePng(`${OUT}/stars.png`, await p.evaluate(starsSheet));
    savePng(`${OUT}/lineup.png`, await p.evaluate(lineupSheet));
    const t = await p.evaluate(measure);
    fs.writeFileSync(`${OUT}/timing.json`, JSON.stringify(t, null, 2));
    console.error('첫 생성(ms):', JSON.stringify(t));
  } finally {
    await b.close();
    await server.close();
  }
}

/** 페이지 안: appearance()와 같은 정의 (fiveStars 켬 = named 'star_<id>' · 끔 = 그냥 그 직업 손님) */
function starDef(id: string, on: boolean) {
  const w = window as any;
  const s = w.FS.STARS[id];
  const b = w.CL.CLASSES[s.kind];
  const d: any = { ...b, face: { ...b.face, ...s.face }, elf: s.race === 'elf', dwarf: s.race === 'dwarf' || s.race === 'halfling', beard: s.race === 'dwarf' ? s.hair : undefined, hair: s.hair };
  if (s.kind === 'dwarf' && s.race !== 'dwarf') d.helm = b.helm;
  d.weapon = ({ knight: 'sword', mage: 'staff', dwarf: 'axe', rogue: 'dagger', cleric: 'book', hunter: 'bow' } as any)[s.kind];
  if (on) Object.assign(d, { weapon: s.weapon, named: 'star_' + id, mythic: true });
  return d;
}

async function starsSheet(): Promise<string> {
  const w = window as any;
  const starDef = w.starDef as (id: string, on: boolean) => any;
  const { buildFrom } = w.SP;
  const { setFlag } = w.FL;
  const ids: string[] = w.FS.STAR_IDS;
  const load = (src: string) => new Promise<HTMLImageElement | null>((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const S = 5;
  const CH = 35 * S;
  const RH = CH + 34;
  const cols = ['초상', '지금(끔)', '서기', '걷기1', '걷기2', '뒤', '대기1', '대기2', '대기3', '대기4', '공격1', '공격2', '공격3', '공격4', '시전', '앉기'];
  const CW = 26 * S + 8;
  const LW = 150;
  const cv = document.createElement('canvas');
  cv.width = LW + CH + 10 + (cols.length - 1) * CW;
  cv.height = 44 + ids.length * RH;
  const x = cv.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#1b1622';
  x.fillRect(0, 0, cv.width, cv.height);
  x.font = '600 15px sans-serif';
  x.fillStyle = '#f3e7c9';
  cols.forEach((n, i) => x.fillText(n, LW + (i === 0 ? 0 : CH + 10 + (i - 1) * CW) + 4, 28));
  for (let r = 0; r < ids.length; r++) {
    const id = ids[r];
    const y0 = 44 + r * RH;
    x.fillStyle = r % 2 ? '#211b2b' : '#1e1828';
    x.fillRect(0, y0, cv.width, RH - 4);
    x.fillStyle = '#dfe6f5';
    x.fillText(w.FS.STARS[id].name, 10, y0 + RH / 2 - 8);
    x.fillStyle = w.FS.STARS[id].trail;
    x.fillText('궤적 ' + w.FS.STARS[id].trail, 10, y0 + RH / 2 + 14);
    const im = await load(w.PICS[id]);
    if (im) x.drawImage(im, LW, y0 + 4, CH, CH);
    const put = (fr: HTMLCanvasElement | undefined, col: number) => {
      if (!fr) return;
      const X0 = LW + CH + 10 + (col - 1) * CW;
      x.fillStyle = '#2a2236';
      x.fillRect(X0, y0 + 4, 26 * S, CH);
      x.fillStyle = '#3a3048';
      x.fillRect(X0, y0 + 4 + CH - 3 * S, 26 * S, 1);
      x.drawImage(fr, X0 + ((26 - fr.width) * S) / 2, y0 + 4 + CH - fr.height * S, fr.width * S, fr.height * S);
    };
    setFlag('heroDotV2', true);
    put(buildFrom(starDef(id, false)).idle[0], 1);
    const f = buildFrom(starDef(id, true));
    const c = f.cb();
    put(f.idle[0], 2);
    put(f.walk[0], 3);
    put(f.walk[2], 4);
    put(f.idleB[0], 5);
    (f.sig ?? []).forEach((s: HTMLCanvasElement, i: number) => put(s, 6 + i));
    c.atk.forEach((a: HTMLCanvasElement, i: number) => put(a, 10 + i));
    put(c.cast[2], 14);
    put(f.sit[0], 15);
  }
  return cv.toDataURL('image/png');
}

/** 페이지 안: 다섯 한 줄 (×1 실제 크기 · ×4) + 전설 14 · 전설 신화 (×4) — 같은 바닥 줄 */
function lineupSheet(): string {
  const w = window as any;
  const starDef = w.starDef as (id: string, on: boolean) => any;
  const { buildFrom } = w.SP;
  const { setFlag } = w.FL;
  const { CLASSES } = w.CL;
  const ids: string[] = w.FS.STAR_IDS;
  setFlag('heroDotV2', true);
  const mk = (l: any, mythic: boolean) => {
    const b = CLASSES[l.kind];
    return { ...b, face: { ...b.face }, elf: l.race === 'elf', dwarf: l.race === 'dwarf' || l.race === 'halfling', beard: l.race === 'dwarf' ? l.hair : undefined, hair: l.hair, named: l.key, mythic };
  };
  const stars = ids.map((id) => ({ name: w.FS.STARS[id].name, fr: buildFrom(starDef(id, true)).idle[0] as HTMLCanvasElement }));
  const legends = w.LG.LEGENDS.map((l: any) => ({ name: l.name, fr: buildFrom(mk(l, false)).idle[0] as HTMLCanvasElement }));
  const mythics = w.LG.LEGENDS.map((l: any) => ({ name: l.name + ' 신화', fr: buildFrom(mk(l, true)).idle[0] as HTMLCanvasElement }));
  const plain = (['knight', 'cleric', 'rogue', 'mage', 'dwarf', 'hunter'] as const).map((k) => ({ name: CLASSES[k].name + '(손님)', fr: buildFrom({ ...CLASSES[k] }).idle[0] as HTMLCanvasElement }));
  const S = 4;
  const CW = 26 * S + 14;
  const rows: [string, { name: string; fr: HTMLCanvasElement }[]][] = [
    ['다섯 별 (신화 · ×4)', stars],
    ['일반 손님 (×4)', plain],
    ['전설 (×4)', legends.slice(0, 7)],
    ['', legends.slice(7)],
    ['전설 신화 (×4)', mythics.slice(0, 7)],
    ['', mythics.slice(7)],
  ];
  const RH = 35 * S + 40;
  const cv = document.createElement('canvas');
  cv.width = 200 + 7 * CW + 20;
  cv.height = 30 + 80 + rows.length * RH;
  const x = cv.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#1b1622';
  x.fillRect(0, 0, cv.width, cv.height);
  x.font = '600 15px sans-serif';
  // ×1 실제 크기 한 줄 (다섯 + 전설 3 + 손님 3) — 마을에서 보이는 크기
  x.fillStyle = '#f3e7c9';
  x.fillText('실제 크기 ×1 (다섯 별 · 전설 엘리시아·닉스·루나 · 손님 기사·도적·사제)', 10, 24);
  x.fillStyle = '#4a6a3a';
  x.fillRect(10, 34, cv.width - 20, 60);
  const one = [...stars, legends[0], legends[7], legends[4], plain[0], plain[2], plain[1]];
  one.forEach((o, i) => x.drawImage(o.fr, 20 + i * 34 + (26 - o.fr.width) / 2, 34 + 52 - o.fr.height));
  rows.forEach(([label, list], r) => {
    const y0 = 110 + r * RH;
    x.fillStyle = r % 2 ? '#211b2b' : '#1e1828';
    x.fillRect(0, y0, cv.width, RH - 4);
    x.fillStyle = '#f3e7c9';
    x.fillText(label, 10, y0 + RH / 2);
    list.forEach((o, i) => {
      const X0 = 200 + i * CW;
      x.fillStyle = '#3a3048';
      x.fillRect(X0, y0 + 6 + 35 * S - 3 * S, 26 * S, 1);
      x.drawImage(o.fr, X0 + ((26 - o.fr.width) * S) / 2, y0 + 6 + 35 * S - o.fr.height * S, o.fr.width * S, o.fr.height * S);
      x.font = '12px sans-serif';
      x.fillStyle = '#cfc3e0';
      x.fillText(o.name, X0, y0 + RH - 12);
      x.font = '600 15px sans-serif';
    });
  });
  return cv.toDataURL('image/png');
}

/** 페이지 안: 첫 생성 시간 (전설 엘리시아 대비) */
function measure() {
  const w = window as any;
  const starDef = w.starDef as (id: string, on: boolean) => any;
  const { buildFrom } = w.SP;
  const { setFlag } = w.FL;
  const { CLASSES } = w.CL;
  setFlag('heroDotV2', true);
  const med = (a: number[]) => (a.sort((p, q) => p - q), Math.round(a[a.length >> 1] * 100) / 100);
  const out: Record<string, number> = {};
  for (const id of w.FS.STAR_IDS) {
    const xs: number[] = [];
    for (let i = 0; i < 16; i++) {
      const d = { ...starDef(id, true), weaponColor: '#' + (0x100000 + i * 7771).toString(16).slice(0, 6) };
      const t0 = performance.now();
      buildFrom(d).cb();
      if (i >= 4) xs.push(performance.now() - t0);
    }
    out[id] = med(xs);
  }
  const xs: number[] = [];
  for (let i = 0; i < 16; i++) {
    const b = CLASSES.knight;
    const t0 = performance.now();
    buildFrom({ ...b, face: { ...b.face }, hair: '#f3e08a', named: 'elysia', weaponColor: '#' + (0x100000 + i * 7771).toString(16).slice(0, 6) }).cb();
    if (i >= 4) xs.push(performance.now() - t0);
  }
  out.elysia_legend = med(xs);
  return out;
}

// ───────── 마을 · 전투 · 별자리 (BOT_BUILD 묶음 · 실험실 켬) ─────────
async function village() {
  const URL = process.env.URL ?? 'http://localhost:4293/';
  const file = fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/real_lotte.json';
  const sv = JSON.parse(fs.readFileSync(file, 'utf8'));
  const b = await chromium.launch({ channel: 'chrome' });
  const VER = await (async () => {
    const c = await b.newContext();
    const v = (await (await c.request.get(URL + 'version.json')).json()).version;
    await c.close();
    return JSON.stringify(v);
  })();
  const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
  const errs: string[] = [];
  const only = process.env.ONLY;
  for (const width of [360, 1280]) {
    const dev = width === 360 ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
    for (const scene of ['day', 'night', 'combat', 'constellation']) {
      if (only && only !== scene) continue;
      const night = scene === 'night' || scene === 'constellation';
      const save = JSON.stringify(night ? { ...sv, clock: 17 * 60, night: true } : { ...sv, clock: 6 * 60, night: false });
      const ctx = await b.newContext(dev);
      await ctx.addInitScript(
        ([s, ver]) => {
          try {
            if (sessionStorage.getItem('x')) return;
            sessionStorage.setItem('x', '1');
          } catch {
            return;
          }
          localStorage.clear();
          localStorage.setItem('legacy-of-adventure-save', s as string);
          localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
          localStorage.setItem('legacy-of-adventure-lastVersion', ver as string);
          localStorage.setItem('legacy-of-adventure-settleOff', 'true');
          localStorage.setItem('legacy-of-adventure-telemetry', 'false');
          localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
          localStorage.setItem('legacy-of-adventure-visualLab', 'true');
          for (const k of ['zoom', 'zoom-tablet', 'zoom-desktop', 'zoom-wide', 'zoom-pc']) localStorage.setItem('legacy-of-adventure-' + k, '2');
        },
        [save, VER],
      );
      const p = await ctx.newPage();
      p.on('pageerror', (e) => errs.push(`${scene} ${width}: ${String(e).slice(0, 160)}`));
      try {
        await boot(p, URL);
        if (scene === 'constellation') await constellation(p, width);
        else {
          await stage(p);
          if (scene === 'combat') await combat(p, width);
          else {
            await p.waitForTimeout(700);
            await p.screenshot({ path: `${OUT}/village_${scene}_${width}.png` });
            console.error(`✓ village_${scene}_${width}`);
          }
        }
      } catch (e) {
        errs.push(`${scene} ${width} 못 찍음: ${String(e).slice(0, 200)}`);
      }
      await ctx.close();
    }
  }
  await b.close();
  console.error(errs.length ? '✗ 오류:\n' + errs.join('\n') : '✓ 오류 0');
}

async function boot(p: Page, URL: string) {
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!(window as any).__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => (window as any).__S.started && !(document.querySelector('#hud') as HTMLElement).hidden, null, { timeout: 20000 });
  for (let i = 0; i < 3; i++) {
    await clear(p);
    for (let k = 0; k < 4; k++) await p.keyboard.press('x').catch(() => {});
    await p.waitForTimeout(700);
  }
  await clear(p);
}

/** 다섯 별을 합류시키고(개발용 __five.join) 여관 앞에 한 줄로 세운다 + 비교용 전설 신화 1 · 전설 1 */
async function stage(p: Page) {
  await p.evaluate(() => {
    const w = window as any;
    const ids = ['woongs', 'gonu', 'ikamolly', 'walwal', 'warmnight'];
    ids.forEach((id) => w.__five.join(id));
  });
  for (let k = 0; k < 4; k++) {
    await clear(p);
    for (let j = 0; j < 4; j++) await p.keyboard.press('x').catch(() => {});
    await p.waitForTimeout(600);
  }
  await p.evaluate(() => {
    const w = window as any;
    const ids = ['woongs', 'gonu', 'ikamolly', 'walwal', 'warmnight'];
    const got = ids.map((id) => w.__world.actors.find((a: any) => a.starId === id));
    // 걸어 들어온 첫 별 자리(길 위 · 건물에 안 가림)를 기준으로 한 줄
    const cx = Math.round(got[0].x) - 1;
    const cy = Math.round(got[0].y);
    got.forEach((a: any, i: number) => {
      if (!a) return;
      Object.assign(a, { path: null, st: 'idle', back: false, dir: 1, pop: 0, fading: undefined, x: cx - 0.4 + i * 0.6, y: cy + 4.4 - i * 0.6 });
      a.ph = i * 2.3;
    });
    // 옆에 전설 (엘리시아 = 신화) · 닉스 (전설)
    w.__mythic?.seed?.('elysia');
    const st = w.__P.story;
    st.mythic = { ...(st.mythic ?? {}), elysia: { ...(st.mythic?.elysia ?? {}), met: true } };
    ([['elysia', '엘리시아', 'knight', '#f3e08a'], ['nyx', '닉스', 'rogue', '#2a2030']] as const).forEach(([key, name, kind, hair], i) => {
      const a = w.__arrive('visitor');
      if (!a) return;
      Object.assign(a, { kind, race: 'human', hair, name, face: undefined, rarity: 'legend', path: null, st: 'idle', back: false, dir: -1, pop: 0, fading: undefined, legendId: key, x: cx + 0.2 + i * 1.2, y: cy + 2.4 - i * 1.2 });
    });
    // 찍는 동안 제자리에 세워 둔다 (비교 시트용 · 걷기 AI가 데려가지 않게)
    const pin = [...got, ...w.__world.actors.filter((a: any) => a.legendId === 'elysia' || a.legendId === 'nyx').slice(-2)].filter(Boolean).map((a: any) => [a, a.x, a.y]);
    setInterval(() => { for (const [a, x, y] of pin) Object.assign(a, { x, y, path: null, st: 'idle', back: false }); }, 30);
    w.__game.focusTile(cx + 0.6, cy + 3.4);
  });
  await clear(p);
  await p.evaluate(() => { for (const a of (window as any).__world.actors) if (a.starId || a.legendId) Object.assign(a, { path: null, st: 'idle' }); });
  await p.waitForTimeout(1200);
}

/** 사냥 필드: 다섯 별 파티 (공격하는 모습) */
async function combat(p: Page, width: number) {
  await p.evaluate(() => {
    const w = window as any;
    const P = w.__P;
    P.runs.length = 0;
    P.hunt.auto = null;
    if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
    for (const a of w.__world.actors) if (a.id) a.hp = 100;
    // 비교 시트용: 다섯 별이 가장 세게 (추천 편성이 다섯 별 중 넷을 고른다)
    for (const a of w.__world.actors) if (a.starId) Object.assign(a, { lvl: 99, hp: 100 });
    w.__openHunt('forest');
  });
  await p.waitForTimeout(600);
  // 파티를 다섯 별로 (있으면) — 고르는 창의 별 카드
  await p.evaluate(() => (document.querySelector('[data-s="10"]') as HTMLElement).click());
  await p.waitForTimeout(700);
  await p.evaluate(() => (document.querySelector('#hMan') as HTMLElement).click());
  await p.waitForTimeout(800);
  await p.keyboard.press('Shift').catch(() => {});
  await p.waitForTimeout(1800);
  await p.screenshot({ path: OUT + '/combat_' + width + '_a.png' });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/combat_${width}.png` });
  console.error(`✓ combat_${width}`);
}

/** 마지막 컷 「다섯 별」 → 별자리 줄까지 넘긴다 (줄이 보일 때까지 · 최대 40번) */
async function constellation(p: Page, width: number) {
  await p.evaluate(() => (window as any).__five.finale());
  await p.waitForTimeout(600);
  let seen = false;
  for (let i = 0; i < 40 && !seen; i++) {
    seen = await p.evaluate(() => {
      const t = (document.querySelector('#dlg')?.textContent ?? '') + (document.querySelector('#fiveCut, .fiveCut, .five-cut')?.textContent ?? '');
      return /별자리|오각/.test(t);
    });
    if (seen) break;
    await p.evaluate(() => (document.querySelector('#dlg') as HTMLElement | null)?.click());
    await p.waitForTimeout(260);
  }
  // R21: 별자리 줄에서 카메라가 하늘로 1.5초 — 중간 한 장 · 다 올라간 하늘 한 장
  await p.waitForTimeout(650);
  await p.screenshot({ path: `${OUT}/constellation_pan_mid_${width}.png` });
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `${OUT}/constellation_${width}.png` });
  console.error(`✓ constellation_${width} (${seen ? '별자리 줄 확인' : '별자리 줄 못 찾음'})`);
}

async function clear(p: Page) {
  await p.evaluate(async () => {
    const T = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      const dlg = document.querySelector('#dlg') as HTMLElement | null;
      const win = document.querySelector('#win');
      if (dlg && !dlg.hidden) {
        dlg.click();
        busy = true;
      } else if (win?.classList.contains('on')) {
        (document.querySelector('#winX') as HTMLElement).click();
        busy = true;
      }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 120 : 250);
    }
  });
}
