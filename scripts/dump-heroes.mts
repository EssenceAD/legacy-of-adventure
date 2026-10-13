// HERODOT ★ 비교 시트 → reports/herodot/
//  실제 게임 코드(src/engine/sprites.ts)로 그린다 — Vite 개발 서버를 띄워 페이지에서 모듈을 불러오고 heroDotV2 를 끔/켬
//  node scripts/dump-heroes.mts            → classes.png · guests.png · timing.json
//  URL=http://localhost:4331/ node scripts/dump-heroes.mts village   → village_412.png · village_1280.png · hunt_*.png
//    (BOT_BUILD 묶음: BOT_BUILD=1 npx vite build --outDir dist-bot && npx vite preview --outDir dist-bot --port 4331 --strictPort)
//    켬 = 실험실(visualLab) + heroDotV2 · 끔 = 같은 실험실 + 개발용 legacy-of-adventure-heroDotOff (도트만 다르게)
import { chromium, type Page } from 'playwright-core';
import fs from 'node:fs';

const OUT = 'reports/herodot';
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
  const port = Number(process.env.PORT ?? 4332);
  const server = await createServer({ server: { port, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const base = `http://localhost:${port}/`;
  const b = await chromium.launch({ channel: 'chrome' });
  try {
    const p = await b.newPage();
    // 게임은 띄우지 않고 빈 문서에서 모듈만 불러온다
    await p.route(base, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1b1622"></body>' }));
    await p.goto(base);
    p.on('pageerror', (e) => console.error('pageerror', e));
    await p.evaluate(async () => {
      const w = window as any;
      w.SP = await import('/src/engine/sprites.ts');
      w.FL = await import('/src/world/flags.ts');
      w.CL = await import('/src/data/classes.ts');
      w.IT = await import('/src/data/items.ts');
    });
    savePng(`${OUT}/classes.png`, await p.evaluate(classesSheet));
    savePng(`${OUT}/guests.png`, await p.evaluate(guestsSheet));
    const timing = await p.evaluate(measure);
    fs.writeFileSync(`${OUT}/timing.json`, JSON.stringify(timing, null, 2));
    console.error('첫 생성 시간(ms, 끔·켬 번갈아 30회 중앙값):', JSON.stringify(timing));
  } finally {
    await b.close();
    await server.close();
  }
}

/** 페이지 안: 직업 3종 × (전/후) 동작 줄 · 6배 */
function classesSheet(): string {
  const w = window as any;
  const { buildFrom } = w.SP;
  const { setFlag } = w.FL;
  const { CLASSES } = w.CL;
  const S = 6;
  const cols: [string, (f: any, c: any) => HTMLCanvasElement | undefined][] = [
    ['서기', (f) => f.idle[0]],
    ['걷기1', (f) => f.walk[0]],
    ['걷기2', (f) => f.walk[1]],
    ['걷기3', (f) => f.walk[2]],
    ['걷기4', (f) => f.walk[3]],
    ['뒤', (f) => f.idleB[0]],
    ['뒤 걷기', (f) => f.walkB[0]],
    ['앉기', (f) => f.sit[0]],
    ['공격1', (_f, c) => c.atk[0]],
    ['공격2', (_f, c) => c.atk[1]],
    ['공격3', (_f, c) => c.atk[2]],
    ['공격4', (_f, c) => c.atk[3]],
    ['시전', (_f, c) => c.cast[2]],
    ['피격', (_f, c) => c.hurt[0]],
    ['깜빡', (f) => f.blink],
    ['구르기', (_f, c) => c.roll[1]],
    ['쓰러짐', (_f, c) => c.die[2]],
  ];
  const kinds = [['knight', '기사'], ['cleric', '사제'], ['rogue', '도적']];
  const cw = 24 * S + 8;
  const ch = 33 * S;
  const lw = 110;
  const head = 34;
  const cv = document.createElement('canvas');
  cv.width = lw + cols.length * cw + 20 + 33 * S - 24 * S;
  cv.height = head + kinds.length * (ch * 2 + 40) + 10;
  const x = cv.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#1b1622';
  x.fillRect(0, 0, cv.width, cv.height);
  x.font = '600 18px sans-serif';
  x.fillStyle = '#f3e7c9';
  cols.forEach(([n], i) => x.fillText(n, lw + i * cw + 6, 24));
  kinds.forEach(([k, name], r) => {
    for (const [j, on] of [[0, false], [1, true]] as const) {
      setFlag('heroDotV2', on);
      const f = buildFrom(CLASSES[k]);
      const c = f.cb();
      const y0 = head + r * (ch * 2 + 40) + j * (ch + 10);
      x.fillStyle = j ? '#2a2236' : '#221c2c';
      x.fillRect(lw - 6, y0, cv.width - lw, ch);
      x.fillStyle = j ? '#ffd36b' : '#cfc3e0';
      x.fillText(`${name} ${j ? '후' : '전'}`, 8, y0 + ch / 2);
      cols.forEach(([, get], i) => {
        const fr = get(f, c);
        if (!fr) return;
        // 바닥 줄 (발 위치 확인용)
        x.fillStyle = '#3a3048';
        x.fillRect(lw + i * cw, y0 + 31 * S, 24 * S, 1);
        x.drawImage(fr, lw + i * cw, y0 + (fr.height < 33 ? (33 - fr.height) * S : 0), fr.width * S, fr.height * S);
      });
    }
  });
  setFlag('heroDotV2', false);
  return cv.toDataURL('image/png');
}

/** 페이지 안: 무작위 손님 24명 (종족·머리색·희귀도·무기색) 전/후 · 4배 · 서기 + 걷기 + 뒤 */
function guestsSheet(): string {
  const w = window as any;
  const { buildFrom } = w.SP;
  const { setFlag } = w.FL;
  const { CLASSES, CLASS_RACES, HAIR_COLORS, FACE_POOL, CLASS_WEAPON, RARITY_INFO } = w.CL;
  const { GRADE_INFO } = w.IT;
  let s = 20261014;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const kinds = ['knight', 'cleric', 'rogue'];
  const guests: { def: any; label: string; rar: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const kind = kinds[i % 3];
    const base = CLASSES[kind];
    const race = pick(CLASS_RACES[kind]) as string;
    const rar = rnd() < 0.55 ? 'common' : rnd() < 0.7 ? 'special' : 'legend';
    const face = rar === 'common' ? {} : { eyes: pick(FACE_POOL.eyes), mouth: pick(FACE_POOL.mouth), brow: pick(FACE_POOL.brow) };
    const def: any = { ...base, face: { ...base.face, ...face } };
    def.elf = race === 'elf';
    def.dwarf = race === 'dwarf' || race === 'halfling';
    const hair = pick(HAIR_COLORS) as string;
    def.beard = race === 'dwarf' ? hair : undefined;
    def.hair = hair;
    def.weapon = rnd() < 0.8 ? CLASS_WEAPON[kind] : pick(['sword', 'axe', 'staff', 'dagger', 'book', 'bow']);
    const g = pick(['n', 'n', 'r', 'e', 'l', 'a']) as string;
    def.weaponColor = g !== 'n' ? GRADE_INFO[g].color : undefined;
    if (i === 22) Object.assign(def, { skin: '#d99a6c', towel: '#ffffff' });
    if (i === 23) Object.assign(def, { face: { ...def.face, glasses: true }, glassesColor: '#c9a46a' });
    guests.push({ def, rar, label: `${base.name}·${race}·${def.weapon}${g !== 'n' ? '·' + GRADE_INFO[g].name : ''}${i === 22 ? '·수건' : i === 23 ? '·안경' : ''}` });
  }
  const S = 4;
  const fw = 24 * S;
  const cellW = fw * 6 + 30;
  const cellH = 33 * S + 34;
  const nc = 3;
  const cv = document.createElement('canvas');
  cv.width = nc * cellW + 20;
  cv.height = Math.ceil(guests.length / nc) * cellH + 40;
  const x = cv.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#1b1622';
  x.fillRect(0, 0, cv.width, cv.height);
  x.font = '600 14px sans-serif';
  x.fillStyle = '#f3e7c9';
  x.fillText('각 칸: 전(서기·걷기·뒤) | 후(서기·걷기·뒤) — 4배', 10, 22);
  guests.forEach((gst, i) => {
    const X = 10 + (i % nc) * cellW;
    const Y = 34 + Math.floor(i / nc) * cellH;
    x.fillStyle = RARITY_INFO[gst.rar].color;
    x.fillText(`${RARITY_INFO[gst.rar].name} ${gst.label}`, X, Y + 14);
    for (const [j, on] of [[0, false], [1, true]] as const) {
      setFlag('heroDotV2', on);
      const f = buildFrom(gst.def);
      [f.idle[0], f.walk[0], f.idleB[0]].forEach((fr: HTMLCanvasElement, k: number) => {
        const px = X + j * (fw * 3 + 14) + k * fw;
        x.fillStyle = j ? '#2a2236' : '#221c2c';
        x.fillRect(px, Y + 20, fw, 33 * S);
        x.drawImage(fr, px, Y + 20, fw, 33 * S);
      });
    }
  });
  setFlag('heroDotV2', false);
  return cv.toDataURL('image/png');
}

/** 페이지 안: 첫 생성 시간 (마을 프레임 + 전투 프레임 모두 · 캐시 없이 새 겉모습) · 끔/켬 번갈아 30회 중앙값 */
function measure() {
  const w = window as any;
  const { buildFrom } = w.SP;
  const { setFlag } = w.FL;
  const { CLASSES } = w.CL;
  const out: Record<string, { before: number; after: number; ratio: number }> = {};
  for (const k of ['knight', 'cleric', 'rogue']) {
    const xs: Record<string, number[]> = { before: [], after: [] };
    for (let i = 0; i < 36; i++)
      for (const on of [false, true]) {
        setFlag('heroDotV2', on);
        const d = { ...CLASSES[k], hair: '#' + (0x100000 + i * 7771).toString(16).slice(0, 6) };
        const t0 = performance.now();
        buildFrom(d).cb();
        if (i >= 6) xs[on ? 'after' : 'before'].push(performance.now() - t0);
      }
    const med = (a: number[]) => (a.sort((x, y) => x - y), Math.round(a[a.length >> 1] * 100) / 100);
    const before = med(xs.before);
    const after = med(xs.after);
    out[k] = { before, after, ratio: Math.round((after / before) * 100) / 100 };
  }
  setFlag('heroDotV2', false);
  return out;
}

// ───────── 마을 · 사냥 필드 (BOT_BUILD 묶음) ─────────
async function village() {
  const URL = process.env.URL ?? 'http://localhost:4331/';
  const save = JSON.parse(fs.readFileSync('tests/fixtures/real_ttabam.json', 'utf8'));
  const day = JSON.stringify({ ...save, clock: 6 * 60, night: false });
  const b = await chromium.launch({ channel: 'chrome' });
  const VER = await (async () => {
    const c = await b.newContext();
    const v = (await (await c.request.get(URL + 'version.json')).json()).version;
    await c.close();
    return JSON.stringify(v);
  })();
  const errs: string[] = [];
  const shots: Record<string, Record<string, Buffer>> = {};
  for (const width of [412, 1280]) {
    for (const on of [false, true]) {
      const dev =
        width === 412
          ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
          : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
      const ctx = await b.newContext(dev);
      await ctx.addInitScript(
        ([s, on, ver]) => {
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
          // 마을을 크게 (사람이 보이게)
          for (const k of ['zoom', 'zoom-tablet', 'zoom-desktop', 'zoom-wide', 'zoom-pc']) localStorage.setItem('legacy-of-adventure-' + k, '2');
          if (!on) localStorage.setItem('legacy-of-adventure-heroDotOff', 'true');
        },
        [day, on, VER],
      );
      const p = await ctx.newPage();
      p.on('pageerror', (e) => errs.push(`${width} ${on ? '켬' : '끔'}: ${String(e).slice(0, 160)}`));
      const key = `${width}`;
      (shots[key] ??= {})[on ? 'on' : 'off'] = await townShot(p);
      try {
        (shots['hunt' + key] ??= {})[on ? 'on' : 'off'] = await huntShot(p);
      } catch (e) {
        errs.push(`사냥 필드 못 찍음: ${String(e).slice(0, 120)}`);
      }
      await ctx.close();
    }
  }
  for (const width of [412, 1280]) {
    await pair(b, `village_${width}`, `따밤 마을 · 낮 · 폭 ${width}`, shots[`${width}`]);
    await pair(b, `hunt_${width}`, `따밤 · 사냥 필드 (숲 1-10) · 폭 ${width}`, shots[`hunt${width}`]);
  }
  await b.close();
  console.error(errs.length ? '✗ 오류:\n' + errs.join('\n') : '✓ 오류 0');
}

async function townShot(p: Page): Promise<Buffer> {
  const W = (ms: number) => p.waitForTimeout(ms);
  await p.goto(process.env.URL ?? 'http://localhost:4331/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!(window as any).__S, null, { timeout: 30000 });
  await p.waitForFunction(() => !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => (window as any).__S.started && !(document.querySelector('#hud') as HTMLElement).hidden, null, { timeout: 20000 });
  for (let i = 0; i < 3; i++) {
    await clear(p);
    // 이야기 장면(Z NEXT · X SKIP) 건너뛰기
    for (let k = 0; k < 4; k++) await p.keyboard.press('x').catch(() => {});
    await W(900);
  }
  await clear(p);
  // 손님이 많은 여관 앞을 가운데로 · 한 번 더 확대
  await p.evaluate(() => {
    const w = window as any;
    const o = w.__world.objs.find((x: any) => x.kind === 'inn');
    if (o) w.__game.focusTile(o.tx + o.fw / 2, o.ty + o.fh / 2 + 2);
  });
  await W(1800);
  return await p.screenshot();
}

async function huntShot(p: Page): Promise<Buffer> {
  const W = (ms: number) => p.waitForTimeout(ms);
  await p.evaluate(() => {
    const w = window as any;
    const P = w.__P;
    P.runs.length = 0;
    P.hunt.auto = null;
    if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
    for (const a of w.__world.actors) if (a.id) a.hp = 100;
    w.__openHunt('forest');
  });
  await W(600);
  await p.locator('[data-s="10"]').click({ timeout: 5000 });
  await W(700);
  await p.locator('#hMan').click({ timeout: 5000 });
  await W(3000);
  return await p.screenshot();
}

async function clear(p: Page) {
  await p.evaluate(async () => {
    const T = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!(document.querySelector('#dlg') as HTMLElement).hidden) {
        (document.querySelector('#dlg') as HTMLElement).click();
        busy = true;
      } else if (document.querySelector('#win')!.classList.contains('on')) {
        (document.querySelector('#winX') as HTMLElement).click();
        busy = true;
      }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 120 : 250);
    }
  });
}

async function pair(b: Awaited<ReturnType<typeof chromium.launch>>, name: string, title: string, s?: Record<string, Buffer>) {
  if (!s?.off || !s?.on) return;
  const wide = name.endsWith('1280');
  const iw = wide ? 1280 : 412;
  const pg = await b.newPage({ viewport: { width: iw * 2 + 60, height: 800 }, deviceScaleFactor: 1 });
  const im = (buf: Buffer) => `data:image/png;base64,${buf.toString('base64')}`;
  await pg.setContent(`<body style="margin:0;background:#1b1622;font:600 22px sans-serif;color:#f3e7c9">
    <div style="padding:12px 20px">${title} — 둘 다 「새 화면 미리 보기」 켬 · 다른 건 영웅 도트뿐</div>
    <div style="display:flex;gap:20px;padding:0 20px 20px">
      <figure style="margin:0"><figcaption style="padding:6px 0">전 (heroDotV2 끔)</figcaption><img src="${im(s.off)}" style="width:${iw}px;display:block;image-rendering:pixelated"></figure>
      <figure style="margin:0"><figcaption style="padding:6px 0;color:#ffd36b">후 (heroDotV2 켬)</figcaption><img src="${im(s.on)}" style="width:${iw}px;display:block;image-rendering:pixelated"></figure>
    </div></body>`);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await pg.close();
  console.error(`✓ ${OUT}/${name}.png`);
}
