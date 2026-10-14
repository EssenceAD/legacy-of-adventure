// RAIDWEAPON §3' 하늘 균열 시트: 마을(하늘 금 + 알약) · 균열 창 · 전투(시작·중간·끝) · 결과 · 랭킹 탭 · 우편함 보상 — 412 · 1280 (실험실 켬)
//  서버는 페이지 안에서 가짜로 (Supabase 주소로 가는 요청을 전부 가로챔 · 진짜 서버엔 아무것도 안 감) · 로그인도 가짜 세션
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-rift && npx vite preview --outDir dist-bot-rift --port 4317 --strictPort
//        URL=http://localhost:4317/ node scripts/shot-rift.mjs [저장 파일] → reports/raidweapon/rift/*.png
//  MISSING=1: 서버 SQL 실행 전(함수 없음) 모습만 (마을 · 랭킹 탭)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const APP = process.env.URL ?? 'http://localhost:4317/';
const OUT = process.env.OUT ?? 'reports/raidweapon/rift';
const MISSING = !!process.env.MISSING;
const WIDTHS = (process.env.WIDTHS ?? '412,1280').split(',').map(Number);
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

const INNS = [['u-sol', '솔바람 여관', '솔바람', 'legend_aria'], ['u-lotte', '롯데캐슬', '롯데', 'hero_knight'], ['u-head', '머리박고힐', '박고', null], ['u-wind', '윈드 여관', '윈드', null], ['u-lotto', '로또1등', '로또', null], ['u-sodam', '소담', '소담', null]];
let boss;
const resetBoss = () => {
  const now = Date.now();
  const end = new Date(now + 6.5 * 3600e3);
  boss = { id: 7, name: '하늘을 삼킨 것', look: 'sky', hp_max: 6000000, hp_left: 3660000, starts_at: new Date(now - 2 * 3600e3).toISOString(), ends_at: end.toISOString(), day: '2026-10-15', test: false, killed: false, killer_inn: null, players: 14, my_tries: 1, my_total: 212000, my_rank: 6, tries_max: 3 };
};
const state = () => ({ ...boss, now: new Date().toISOString() });
const rows = (base) => INNS.map(([user_id, inn_name, nickname, rep_hero], i) => ({ rank: i + 1, user_id, inn_name, nickname, rep_hero, dmg: Math.round(base / (1 + i * 0.35)) }));
const rewards = [
  { id: 101, kind: 'daily', day: '2026-10-14', week: null, payload: { frags: 4, dust: 40, title: '균열의 영웅', rank: 2, killed: true, dmg: 912000, name: '서리 뱀' } },
  { id: 102, kind: 'weekly', day: '2026-10-11', week: '2026-10-05', payload: { frags: 3, rank: 7, dmg: 4100000 } },
];

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
    const body = JSON.parse(req.postData() || '{}');
    if (fn.startsWith('world_') && MISSING) return json({ code: 'PGRST202', message: `Could not find the function public.${fn} in the schema cache`, details: null, hint: null }, 404);
    if (fn === 'world_roll') return json(7);
    if (fn === 'world_current') return json(body.p_test ? null : state());
    if (fn === 'world_hit') {
      const d = Math.min(body.p_dmg, body.p_power * 60, 600000);
      boss.hp_left = Math.max(0, boss.hp_left - d);
      boss.my_tries++;
      boss.my_total += d;
      boss.my_rank = 4;
      boss.players++;
      return json({ r: 'ok', dmg: d, killed_now: false, ...state() });
    }
    if (fn === 'world_rank') return json({ boss_id: 7, day: '2026-10-15', week_start: '2026-10-12', name: '하늘을 삼킨 것', day_rows: rows(910000).concat([{ rank: 7, user_id: ME, inn_name: '시험 여관', nickname: '시험주인', rep_hero: null, dmg: boss.my_total }]), me_day: { rank: 7, dmg: boss.my_total }, week_rows: rows(4800000), me_week: { rank: 12, dmg: boss.my_total + 1500000 } });
    if (fn === 'world_claim') {
      const r = rewards.splice(0);
      return json(r);
    }
    return json(null);
  }
  if (p === '/rest/v1/profiles') {
    if (req.method() === 'GET' && u.searchParams.get('id') === `eq.${ME}`) return obj ? json(PROFILE) : json([PROFILE]);
    return json([]);
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
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  shots.push(name);
  console.error('✓ ' + name);
};
async function tile(p, name) {
  await p.evaluate(() => window.__openMenu());
  await p.waitForTimeout(400);
  await p.evaluate((n) => [...document.querySelectorAll('.mtile')].find((b) => b.textContent.includes(n))?.click(), name);
  await p.waitForTimeout(900);
}

for (const width of WIDTHS) {
  const tag = `${width}${MISSING ? '_missing' : ''}`;
  resetBoss();
  rewards.length = 0;
  rewards.push(
    { id: 101, kind: 'daily', day: '2026-10-14', week: null, payload: { frags: 4, dust: 40, title: '균열의 영웅', rank: 2, killed: true, dmg: 912000, name: '서리 뱀' } },
    { id: 102, kind: 'weekly', day: '2026-10-11', week: '2026-10-05', payload: { frags: 3, rank: 7, dmg: 4100000 } },
  );
  const dev = width < 700 ? { viewport: { width, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND } : { viewport: { width, height: 800 }, deviceScaleFactor: 1 };
  const ctx = await br.newContext(dev);
  await ctx.route(SUPA + '/**', fake);
  await ctx.addInitScript(
    ([s, ver, sess]) => {
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
      localStorage.setItem('legacy-of-adventure-visualLab', 'true');
    },
    [save, VER, SESSION],
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
    if (MISSING) {
      await p.waitForTimeout(3000);
      const vis = await p.evaluate(() => !document.getElementById('riftPill')?.hidden);
      if (vis) errs.push(`${tag}: 함수 없음인데 알약이 보임`);
      await shot(p, `village_${tag}`);
      await tile(p, '랭킹');
      await p.evaluate(() => [...document.querySelectorAll('#rkT .tab')].find((b) => b.textContent.includes('하늘 균열'))?.click());
      await p.waitForTimeout(1200);
      await shot(p, `rank_${tag}`);
    } else {
      await p.waitForFunction(() => !document.getElementById('riftPill')?.hidden, null, { timeout: 15000 });
      await p.waitForTimeout(800);
      await clear(p);
      await shot(p, `village_${tag}`);
      // 이야기·편지가 끼어들면 넘기기 (X = 건너뛰기)
      for (let i = 0; i < 12 && (await p.evaluate(() => document.getElementById('riftPill')?.hidden !== false)); i++) {
        await p.keyboard.press('x');
        await clear(p);
      }
      await p.waitForFunction(() => !document.getElementById('riftPill')?.hidden, null, { timeout: 15000 });
      await p.locator('#riftPill').click();
      await p.waitForTimeout(1200);
      await shot(p, `window_${tag}`);
      await p.locator('#rfGo').click();
      await p.waitForSelector('#raid .rfhud', { timeout: 20000 });
      await p.evaluate(() => document.getElementById('cbAuto')?.click());
      await p.waitForTimeout(2500);
      await shot(p, `battle_start_${tag}`);
      await p.evaluate(() => window.__rift.advance(26));
      await p.waitForTimeout(300);
      await shot(p, `battle_mid_${tag}`);
      await p.evaluate(() => window.__rift.advance(29));
      await p.waitForTimeout(200);
      await shot(p, `battle_end_${tag}`);
      await p.evaluate(() => window.__rift.advance(8));
      await p.waitForSelector('#rfResLine', { timeout: 15000 });
      await p.waitForTimeout(600);
      await shot(p, `result_${tag}`);
      await p.locator('#rfRk').click();
      await p.waitForTimeout(1800);
      await shot(p, `rank_${tag}`);
      await clear(p);
      await tile(p, '우편함');
      await p.waitForTimeout(600);
      await shot(p, `mail_${tag}`);
    }
  } catch (e) {
    errs.push(`${tag} 못 찍음: ${String(e).slice(0, 300)}`);
    try {
      await p.screenshot({ path: `${OUT}/_fail_${tag}.png` });
    } catch {
      /* 없음 */
    }
  }
  await ctx.close();
}
await br.close();
console.error(errs.length ? '✗ 오류:\n' + errs.join('\n') : `✓ ${shots.length}장 · 페이지 오류 0`);
process.exit(errs.length ? 1 : 0);
