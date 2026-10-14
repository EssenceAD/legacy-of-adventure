// LUXE §4 방명록 시트: 방문 화면 좋아요+도장 · 내 방명록 탭 · 랭킹 「이번 주 인기 마을」 — 360 · 1280 · 전(실험실 끔)/후(실험실 켬)
//  서버는 페이지 안에서 가짜로 (Supabase 주소로 가는 요청을 전부 가로챔 · 진짜 서버엔 아무것도 안 감) · 로그인도 가짜 세션
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-gbook && npx vite preview --outDir dist-bot-gbook --port 4302 --strictPort
//        URL=http://localhost:4302/ node scripts/shot-guestbook.mjs [저장 파일] → reports/luxe/guestbook/*.png
//  MISSING=1: 서버 SQL 실행 전(함수 없음) 모습
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const APP = process.env.URL ?? 'http://localhost:4302/';
const OUT = process.env.OUT ?? 'reports/luxe/guestbook';
const MISSING = !!process.env.MISSING;
fs.mkdirSync(OUT, { recursive: true });
const SUPA = /VITE_SUPABASE_URL=(\S+)/.exec(fs.readFileSync('.env.production', 'utf8'))[1].replace(/\/$/, '');
const file = process.argv[2] ?? 'tests/fixtures/real_hyeongcheol.json';
const save = fs.readFileSync(file, 'utf8');
const ME = '00000000-0000-4000-8000-00000000aaaa';
const PROFILE = { id: ME, login_id: 'tester01', nickname: '시험주인', inn_name: '시험 여관', rep_hero: null, reputation: 0, codex_pct: 0, created_at: '2026-10-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.sig`;
const USER = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'tester01@players.legacy-of-adventure.app', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' };
const SESSION = JSON.stringify({ access_token: JWT, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'fake', user: USER });

/** 가짜 이웃 (예시 마을 그림을 빌려 실제 유저 마을처럼) */
let villages = [];
const INNS = [['u-sol', '솔바람 여관', '솔바람', 'legend_aria'], ['u-lotte', '롯데캐슬', '롯데', 'hero_knight'], ['u-head', '머리박고힐', '박고', null], ['u-wind', '윈드 여관', '윈드', null], ['u-lotto', '로또1등', '로또', null]];
const book = {
  week: 7, total: 41,
  rows: [
    [0, 4, '2026-10-14'], [1, 0, '2026-10-14'], [2, 7, '2026-10-13'], [3, 1, '2026-10-13'], [4, 5, '2026-10-12'], [0, null, '2026-10-09'], [1, 6, '2026-10-08'],
  ].map(([i, ph, day]) => ({ from_user: INNS[i][0], inn_name: INNS[i][1], nickname: INNS[i][2], rep_hero: INNS[i][3], phrase: ph, day, at: day + 'T10:00:00Z' })),
};
const popular = {
  rows: [[1, 1, 23], [2, 0, 17], [3, 2, 12], [4, 3, 9], [5, 4, 8]].map(([rank, i, likes]) => ({ rank, user_id: INNS[i][0], nickname: INNS[i][2], inn_name: INNS[i][1], rep_hero: INNS[i][3], likes })).concat([{ rank: 6, user_id: ME, nickname: '시험주인', inn_name: '시험 여관', rep_hero: null, likes: 7 }]),
  me: { rank: 6, likes: 7 },
};
const lastTop = { user_id: 'u-lotte', inn_name: '롯데캐슬', nickname: '롯데', rep_hero: 'hero_knight', likes: 31 };
let likes = 17;

async function fake(route) {
  const req = route.request();
  const u = new URL(req.url());
  const p = u.pathname;
  const obj = /vnd\.pgrst\.object/.test(req.headers()['accept'] ?? '');
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (p.startsWith('/auth/v1/user')) return json(USER);
  if (p.startsWith('/auth/v1/')) return json({});
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length);
    const gb = ['my_guestbook', 'weekly_popular', 'last_week_popular'].includes(fn) || (fn === 'like_village' && /p_phrase/.test(req.postData() ?? ''));
    if (MISSING && gb) return json({ code: 'PGRST202', message: `Could not find the function public.${fn} in the schema cache`, details: null, hint: null }, 404);
    if (fn === 'my_guestbook') return json(book);
    if (fn === 'weekly_popular') return json(popular);
    if (fn === 'last_week_popular') return json(lastTop);
    if (fn === 'like_village') return json(/p_phrase/.test(req.postData() ?? '') ? { r: 'ok', likes: ++likes } : ++likes);
    return json(null);
  }
  if (p === '/rest/v1/profiles') {
    if (req.method() === 'GET' && u.searchParams.get('id') === `eq.${ME}`) return obj ? json(PROFILE) : json([PROFILE]);
    return json([]);
  }
  if (p === '/rest/v1/villages' && req.method() === 'GET') {
    const id = u.searchParams.get('user_id');
    if (id?.startsWith('eq.')) {
      const v = villages.find((x) => x.user_id === id.slice(3)) ?? null;
      return obj ? (v ? json(v) : json({ code: 'PGRST116', message: 'no rows' }, 406)) : json(v ? [v] : []);
    }
    return json(villages);
  }
  if (req.method() !== 'GET') return json([]);
  return obj ? json({ code: 'PGRST116', message: 'no rows' }, 406) : json([]);
}

const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const br = await chromium.launch({ channel: 'chrome' });
const VER = JSON.stringify((await (await (await br.newContext()).request.get(APP + 'version.json')).json()).version);
const errs = [];
const shots = [];

async function clear(p) {
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    const busy = await p.evaluate(() => {
      const dlg = document.querySelector('#dlg');
      if (dlg && !dlg.hidden) return dlg.click(), true;
      if (document.querySelector('#win')?.classList.contains('on')) return document.querySelector('#winX').click(), true;
      return false;
    });
    calm = busy ? 0 : calm + 1;
    await p.waitForTimeout(busy ? 200 : 400);
  }
}
const shot = async (p, name) => {
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  shots.push(name);
  console.error('✓ ' + name);
};
const winT = (p) => p.evaluate(() => document.getElementById('winT')?.textContent ?? '');
/** 메뉴 격자에서 이름으로 칸 열기 */
async function tile(p, name) {
  await p.evaluate(() => window.__openMenu());
  await p.waitForTimeout(400);
  await p.evaluate((n) => [...document.querySelectorAll('.mtile')].find((b) => b.textContent.includes(n))?.click(), name);
  await p.waitForTimeout(900);
}

for (const width of [360, 1280]) {
  for (const lab of [false, true]) {
    const tag = `${width}_${lab ? 'after' : 'before'}`;
    const dev = width === 360 ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
    const ctx = await br.newContext(dev);
    await ctx.route(SUPA + '/**', fake);
    await ctx.addInitScript(
      ([s, ver, sess, lab]) => {
        try {
          if (sessionStorage.getItem('x')) return;
          sessionStorage.setItem('x', '1');
        } catch {
          return;
        }
        localStorage.clear();
        localStorage.setItem('legacy-of-adventure-save', s);
        localStorage.setItem('legacy-of-adventure-auth', sess);
        localStorage.setItem('legacy-of-adventure-cloudOwner', JSON.stringify('00000000-0000-4000-8000-00000000aaaa'));
        localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
        localStorage.setItem('legacy-of-adventure-lastVersion', ver);
        localStorage.setItem('legacy-of-adventure-settleOff', 'true');
        localStorage.setItem('legacy-of-adventure-telemetry', 'false');
        localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
        if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
      },
      [save, VER, SESSION, lab],
    );
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${tag}: ${String(e).slice(0, 200)}`));
    try {
      await p.goto(APP, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
      await p.locator('#tCont').click();
      await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
      await p.waitForTimeout(1500);
      await clear(p);
      villages = await p.evaluate((INNS) => window.__neighbors.slice(0, INNS.length).map((v, i) => ({ user_id: INNS[i][0], likes: [17, 23, 12, 9, 8][i], updated_at: new Date().toISOString(), snapshot: { v: 3, land: v.land, innName: INNS[i][1], owner: INNS[i][2], repHero: INNS[i][3], grade: 2, layout: v.layout } })), INNS);
      // 1) 이웃 창 (뒤: 방명록 탭 · 맨 위 지난주 인기 마을)
      await tile(p, '이웃');
      await p.waitForTimeout(1200);
      await shot(p, `neighbors_${tag}`);
      if (lab) {
        await p.evaluate(() => document.querySelector('#nbT .tab[data-t="1"]')?.click());
        await p.waitForTimeout(1200);
        await shot(p, `guestbook_${tag}`);
      }
      // 2) 랭킹 (뒤: 이번 주 인기 마을 탭)
      await clear(p);
      await tile(p, '랭킹');
      await p.waitForTimeout(1000);
      if (lab) {
        await p.evaluate(() => [...document.querySelectorAll('#rkT .tab')].pop()?.click());
        await p.waitForTimeout(1200);
      }
      await shot(p, `rank_${tag}`);
      // 3) 방문 화면 · 좋아요 + 도장
      await clear(p);
      await tile(p, '이웃');
      await p.waitForTimeout(1200);
      await p.evaluate(() => document.querySelector('.stp[data-r="0"]')?.click());
      await p.waitForFunction(() => !!window.__S.visiting, null, { timeout: 10000 });
      await p.waitForTimeout(2000);
      await shot(p, `visit_${tag}`);
      await p.locator('#vLike').click();
      await p.waitForTimeout(800);
      if (lab && (await winT(p)) === '방명록 도장') {
        await shot(p, `stamp_empty_${tag}`);
        await p.locator('.gbst[data-p="4"]').click();
        await p.waitForTimeout(300);
        await shot(p, `stamp_pick_${tag}`);
        await p.locator('#gbGo').click();
        await p.waitForTimeout(700);
      }
      await shot(p, `liked_${tag}`);
    } catch (e) {
      errs.push(`${tag} 못 찍음: ${String(e).slice(0, 300)}`);
    }
    await ctx.close();
  }
}
await br.close();
console.error(errs.length ? '✗ 오류:\n' + errs.join('\n') : `✓ ${shots.length}장 · 페이지 오류 0`);
process.exit(errs.length ? 1 : 0);
