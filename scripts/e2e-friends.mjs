// SOCIAL §2~§4 「각별한 이웃」 두 계정 e2e — 서버는 가짜(이 스크립트 안 · friends.sql과 같은 규칙) · 진짜 Supabase에는 아무것도 안 보냄
//  A(롯데캐슬 저장) · B(웅스 저장 · 공사 중 건물 하나)
//  ① A가 B 마을 방문 → 「＋ 각별한 이웃 신청」 ② B 편지함에 신청 편지 → 수락 ③ 맺은 지 60분 안 → 거들기 막힘
//  ④ 60분 지남 → A가 B의 공사 거들기 (증표 +1) · 같은 건물 또 → 막힘 · 선물 · 친구당 3번 한도 · 하루 10번 한도
//  ⑤ B 접속(poll) → 공사 남은 시간 줄어듦 · 편지함 기록 · 다시 poll(다른 기기 흉내)해도 두 번 안 줄어듦 · 「고마워요」 → A 증표 +1
//  ⑥ A가 ⭐ 탭에서 끊기 → 양쪽 목록에서 사라짐
//  실행: URL=http://localhost:4190/ node scripts/e2e-friends.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const OUT = 'screenshots/friends';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

// ───────── 가짜 서버 (friends.sql 규칙) ─────────
const UA = '11111111-1111-4111-8111-111111111111';
const UB = '22222222-2222-4222-8222-222222222222';
const PROF = { [UA]: { nickname: '에이', inn_name: '롯데캐슬 여관', rep_hero: null }, [UB]: { nickname: '비이', inn_name: '웅스 여관', rep_hero: null } };
const CFG = { friendMax: 20, helpPerDay: 10, helpPerFriend: 3, tokenDayMax: 10, lockMin: 60, conCutPct: 10 };
const day = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const srv = { friends: [], events: [], tokens: {}, seq: 1, snapB: null, preDay: 0 };
const pair = (x, y) => srv.friends.find((f) => (f.a === x && f.b === y) || (f.a === y && f.b === x));
const count = (u) => srv.friends.filter((f) => f.status === 'ok' && (f.a === u || f.b === u)).length;
const RPC = {
  friend_request: (me, { p_to }) => {
    if (p_to === me) return 'self';
    const f = pair(me, p_to);
    if (f?.status === 'ok') return 'already';
    if (f && f.a === p_to && f.status === 'pending') { f.status = 'ok'; f.accepted_at = Date.now(); return 'accepted'; }
    if (count(me) >= CFG.friendMax) return 'full';
    if (!f) srv.friends.push({ a: me, b: p_to, status: 'pending', created_at: Date.now() });
    return 'sent';
  },
  friend_answer: (me, { p_from, p_ok }) => {
    const f = srv.friends.find((x) => x.a === p_from && x.b === me && x.status === 'pending');
    if (!f) return 'none';
    if (!p_ok) { srv.friends.splice(srv.friends.indexOf(f), 1); return 'declined'; }
    f.status = 'ok';
    f.accepted_at = Date.now();
    return 'ok';
  },
  friend_remove: (me, { p_other }) => { srv.friends = srv.friends.filter((f) => !((f.a === me && f.b === p_other) || (f.a === p_other && f.b === me))); return 'ok'; },
  friend_list: (me) => srv.friends.filter((f) => f.a === me || f.b === me).map((f) => {
    const other = f.a === me ? f.b : f.a;
    return { other, status: f.status === 'ok' ? 'ok' : f.b === me ? 'in' : 'out', ...PROF[other], last_seen: new Date().toISOString(), since: new Date(f.accepted_at ?? f.created_at).toISOString(), helped_today: srv.events.filter((h) => h.from_user === me && h.to_user === other && h.day === day()).length, can_help: f.status === 'ok' && f.accepted_at < Date.now() - CFG.lockMin * 60e3 };
  }),
  send_help: (me, { p_to, p_kind, p_target }) => {
    const f = pair(me, p_to);
    if (!f || f.status !== 'ok') return { ok: false, why: 'notfriend' };
    if (f.accepted_at > Date.now() - CFG.lockMin * 60e3) return { ok: false, why: 'newfriend' };
    const today = srv.events.filter((h) => h.from_user === me && h.day === day());
    if (today.length + (me === UA ? srv.preDay : 0) >= CFG.helpPerDay) return { ok: false, why: 'daylimit' };
    if (today.filter((h) => h.to_user === p_to).length >= CFG.helpPerFriend) return { ok: false, why: 'friendlimit' };
    const target = p_kind === 'gift' ? 'gift' : p_target;
    if (today.some((h) => h.to_user === p_to && h.kind === p_kind && h.target === target)) return { ok: false, why: 'same' };
    srv.events.push({ id: srv.seq++, from_user: me, to_user: p_to, kind: p_kind, target, amount: p_kind === 'con' ? CFG.conCutPct : 1, day: day(), created_at: new Date().toISOString(), applied_at: null, thanked_at: null, thank_seen: false });
    const k = me + day();
    srv.tokens[k] = srv.tokens[k] ?? 0;
    let t = 0;
    if (srv.tokens[k] < CFG.tokenDayMax) { srv.tokens[k]++; t = 1; }
    return { ok: true, tokens: t };
  },
  claim_help: (me) => srv.events.filter((h) => h.to_user === me && !h.applied_at).map((h) => { h.applied_at = Date.now(); return { ...h, nickname: PROF[h.from_user].nickname }; }),
  thank_help: (me, { p_id }) => { const h = srv.events.find((x) => x.id === p_id && x.to_user === me && !x.thanked_at); if (!h) return 'none'; h.thanked_at = Date.now(); return 'ok'; },
  claim_thanks: (me) => srv.events.filter((h) => h.from_user === me && h.thanked_at && !h.thank_seen).map((h) => { h.thank_seen = true; return { id: h.id, to_user: h.to_user, nickname: PROF[h.to_user].nickname }; }),
};

async function open(uid, save) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // 진짜 Supabase로는 아무것도 안 나가게: 전부 가로챔
  await ctx.route(/supabase\.co/, async (r) => {
    const u = r.request().url();
    const m = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(u);
    if (m && RPC[m[1]]) {
      const args = JSON.parse(r.request().postData() || '{}');
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RPC[m[1]](uid, args)) });
    }
    if (/\/rest\/v1\/villages/.test(u) && r.request().method() === 'GET' && u.includes(UB)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: UB, snapshot: srv.snapB, likes: 0, updated_at: new Date().toISOString() }) });
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await ctx.route(/flags\.json/, async (r) => {
    const res = await r.fetch();
    const j = await res.json();
    j.friends = true;
    return r.fulfill({ response: res, body: JSON.stringify(j) });
  });
  const sv = fs.readFileSync(save, 'utf8');
  await ctx.addInitScript((s) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-lastVersion', JSON.stringify('1.0.0'));
  }, sv);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
  await p.waitForTimeout(600);
  await p.locator('#tCont').click();
  await p.waitForTimeout(3500);
  await p.evaluate(async ([uid, prof]) => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 150 : 250);
    }
    window.__acctDel.me.profile = { id: uid, login_id: 'g_' + uid.slice(0, 8), nickname: prof.nickname, inn_name: prof.inn_name, rep_hero: null, reputation: 0, codex_pct: 0, created_at: '' };
  }, [uid, PROF[uid]]);
  return { ctx, p, errs, W: (ms) => p.waitForTimeout(ms) };
}
const toastOf = (p) => p.evaluate(() => document.getElementById('toast')?.textContent ?? '');

const A = await open(UA, 'tests/fixtures/real_lotte.json');
const B = await open(UB, 'tests/fixtures/real_woongs.json');
// B: 공사 중인 건물 하나 (2시간) → 마을 모습(스냅샷)
const bCon = await B.p.evaluate(() => {
  const o = window.__world.objs.find((x) => !window.__def(x.kind).deco && x.kind !== 'inn' && x.kind !== 'dungeon' && x.fw >= 2 && !x.con);
  o.con = { kind: 'up', end: Date.now() + 2 * 3600e3, total: 7200, to: o.lvl + 1, cut: 0, cost: 0 };
  const o2 = window.__world.objs.find((x) => x !== o && !window.__def(x.kind).deco && x.kind !== 'inn' && x.kind !== 'dungeon' && x.fw >= 2 && !x.con);
  o2.con = { kind: 'up', end: Date.now() + 3600e3, total: 3600, to: o2.lvl + 1, cut: 0, cost: 0 };
  return { key: `${o.kind}@${o.tx},${o.ty}`, key2: `${o2.kind}@${o2.tx},${o2.ty}`, end: o.con.end };
});
srv.snapB = await B.p.evaluate(() => window.__villageSnapshot());
ok(srv.snapB?.con && srv.snapB.con[bCon.key], `B 마을 모습에 공사 표 (${Object.keys(srv.snapB?.con ?? {}).join(', ')})`);

console.log('[① 신청]');
await A.p.evaluate((ub) => window.__visitUser(ub), UB);
await A.W(2500);
await A.p.evaluate(() => window.__friends.bar());
await A.W(500);
let bar = await A.p.evaluate(() => document.getElementById('vFriend')?.innerText ?? '');
ok(/각별한 이웃 신청/.test(bar), `A가 B 마을에서: 「${bar.trim()}」`);
await A.p.evaluate(() => document.getElementById('vfReq')?.click());
await A.W(600);
ok(/신청을 보냈어요/.test(await toastOf(A.p)), '신청 보냄');
await A.p.screenshot({ path: `${OUT}/a_visit_request.png` });

console.log('[② 수락]');
await B.p.evaluate(() => window.__friends.poll());
await B.W(600);
const mail = await B.p.evaluate(() => window.__P.meta.mail.find((m) => m.freq));
ok(!!mail, `B 편지함에 신청 편지 「${mail?.title}」`);
await B.p.evaluate(() => document.querySelector('[data-m="mail"], #bMail')?.click() ?? window.__openMenu?.());
await B.p.evaluate(() => { const b = [...document.querySelectorAll('#win .mtile, #win button')].find((x) => /우편|편지함/.test(x.textContent)); b?.click(); });
await B.W(600);
await B.p.screenshot({ path: `${OUT}/b_mail_request.png` });
const accBtn = await B.p.evaluate(() => { const x = document.querySelector('[data-mfa]'); if (!x) return false; x.click(); return true; });
await B.W(700);
ok(accBtn && /각별한 이웃이 되었어요/.test(await toastOf(B.p)), 'B 편지함에서 수락');
ok(srv.friends[0]?.status === 'ok', '서버: 맺음');

console.log('[③ 맺은 지 60분 안]');
await A.p.evaluate(() => window.__game.goHome());
await A.W(1500);
await A.p.evaluate((ub) => window.__visitUser(ub), UB);
await A.W(2500);
await A.p.evaluate(() => window.__friends.bar());
await A.W(500);
bar = await A.p.evaluate(() => document.getElementById('vFriend')?.innerText ?? '');
ok(/아직 못 거들어요/.test(bar), `60분 안: 「${bar.trim()}」`);
// 60분 지남 (가짜 서버 시계)
srv.friends[0].accepted_at -= 2 * 3600e3;

console.log('[④ 거들기 · 한도]');
await A.p.evaluate(() => window.__friends.bar());
await A.W(500);
const tokens0 = await A.p.evaluate(() => window.__P.social.tokens);
const tap = (key) => A.p.evaluate((key) => { const o = window.__world.objs.find((x) => `${x.kind}@${x.tx},${x.ty}` === key); return o ? window.__friends.tap(o) : 'nobld'; }, key);
ok((await tap(bCon.key)) === true, 'A가 B의 공사 중 건물을 누르면 「공사 거들기」 창');
await A.p.screenshot({ path: `${OUT}/a_help_window.png` });
await A.p.evaluate(() => document.getElementById('fhGo')?.click());
await A.W(800);
ok(/공사를 거들었어요/.test(await toastOf(A.p)) && (await A.p.evaluate(() => window.__P.social.tokens)) === tokens0 + 1, `거들기 → 🤝 증표 +1 (${tokens0} → ${tokens0 + 1})`);
ok((await tap(bCon.key)) === true, '같은 건물 다시');
await A.p.evaluate(() => document.getElementById('fhGo')?.click());
await A.W(600);
ok(/이미 거들었어요/.test(await toastOf(A.p)), `같은 건물 하루 1번: 「${await toastOf(A.p)}」`);
await A.p.evaluate(() => window.__S.visiting && document.querySelector('#winX')?.click());
await A.p.evaluate(() => document.getElementById('vfGift')?.click());
await A.W(700);
ok(/선물을 두고 왔어요/.test(await toastOf(A.p)), '선물');
ok((await tap(bCon.key2)) === true, '다른 공사 건물');
await A.p.evaluate(() => document.getElementById('fhGo')?.click());
await A.W(700);
ok(/공사를 거들었어요/.test(await toastOf(A.p)), '세 번째 도움');
await A.p.evaluate(() => document.querySelector('#winX')?.click());
await A.p.evaluate(() => document.getElementById('vfGift')?.click());
await A.W(700);
ok(/이 이웃은 오늘 3번 다 도왔어요|오늘은 이미/.test(await toastOf(A.p)), `친구당 하루 3번: 「${await toastOf(A.p)}」`);
// 하루 10번 한도 (다른 친구들에게 이미 9번 도운 셈)
srv.preDay = 10;
const r10 = RPC.send_help(UA, { p_to: UB, p_kind: 'gift', p_target: 'gift' });
ok(r10.why === 'daylimit', '하루 10번 한도 (서버 규칙)');
srv.preDay = 0;

console.log('[⑤ B 접속 → 반영 · 두 번 안 줄어듦 · 고마워요]');
const before = await B.p.evaluate((key) => { const o = window.__world.objs.find((x) => `${x.kind}@${x.tx},${x.ty}` === key); return o.con.end; }, bCon.key);
await B.p.evaluate(() => window.__friends.poll());
await B.W(600);
const after = await B.p.evaluate((key) => { const o = window.__world.objs.find((x) => `${x.kind}@${x.tx},${x.ty}` === key); return { end: o.con.end, fc: o.con.friendCut }; }, bCon.key);
const cutMin = (before - after.end) / 60000;
ok(cutMin > 5 && cutMin <= 30.01, `공사 남은 시간 −${cutMin.toFixed(1)}분 (−10% · 최대 30분)`);
const helpMails = await B.p.evaluate(() => window.__P.meta.mail.filter((m) => m.thank).map((m) => m.body));
ok(helpMails.length === 3, `편지함 기록 3통: ${helpMails.join(' / ')}`);
await B.p.evaluate(() => window.__friends.poll());
await B.W(500);
const again = await B.p.evaluate((key) => window.__world.objs.find((x) => `${x.kind}@${x.tx},${x.ty}` === key).con.end, bCon.key);
ok(again === after.end && (await B.p.evaluate(() => window.__P.meta.mail.filter((m) => m.thank).length)) === 3, '다시 접속(poll)해도 두 번 안 줄어듦');
await B.p.evaluate(() => window.__openMenu?.());
await B.p.evaluate(() => { const b = [...document.querySelectorAll('#win .mtile, #win button')].find((x) => /우편|편지함/.test(x.textContent)); b?.click(); });
await B.W(500);
await B.p.screenshot({ path: `${OUT}/b_mail_thanks.png` });
const th = await B.p.evaluate(() => { const x = document.querySelector('[data-thank]'); if (!x) return false; x.click(); return true; });
await B.W(600);
ok(th && /고마운 마음을 전했어요/.test(await toastOf(B.p)), 'B 「고마워요」');
const tk1 = await A.p.evaluate(() => window.__P.social.tokens);
await A.p.evaluate(() => window.__game.goHome());
await A.W(1500);
await A.p.evaluate(() => window.__friends.poll());
await A.W(600);
ok((await A.p.evaluate(() => window.__P.social.tokens)) === tk1 + 1, `A가 받은 고마워요 → 증표 +1 (${tk1} → ${tk1 + 1})`);

console.log('[⑥ 끊기]');
await A.p.evaluate(() => window.__openVillage());
await A.W(800);
await A.p.evaluate(() => document.querySelector('#nbS [data-ns="friend"]')?.click());
await A.W(1000);
await A.p.screenshot({ path: `${OUT}/a_friend_tab.png` });
const listed = await A.p.evaluate(() => document.querySelector('#win')?.innerText ?? '');
ok(/웅스 여관/.test(listed) && /우정 증표/.test(listed), '⭐ 탭에 B · 우정 증표');
await A.p.evaluate(() => document.querySelector('[data-frx]')?.click());
await A.W(500);
await A.p.evaluate(() => (document.querySelector('.csheet .danger, #csOk, .confirmsheet button.danger') ?? [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '끊기'))?.click());
await A.W(800);
ok(srv.friends.length === 0, '서버: 끊김');
const bl = await B.p.evaluate(async () => (await window.__friends.load(true))?.length ?? -1);
ok(bl === 0, 'B 목록에서도 사라짐');
ok(!A.errs.length && !B.errs.length, '페이지 에러 없음 ' + [...A.errs, ...B.errs].join(' | '));
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
