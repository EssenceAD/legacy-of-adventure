// 창 겹침 검사 (T1 배포마다): 창·모달 > 토스트·알림 > HUD
//  실제 저장(읽기만)을 폰 3종에서 불러와 메뉴의 창 하나하나 + 주요 건물 창 + 손님 상세를 열고,
//  제목줄 · 닫기(#winX) · 탭 줄(.tabs) · 본문 네 귀퉁이에서 맨 위 요소가 창(#win) 안인지 본다.
//  pointer-events:none 인 HUD(다음 이야기 줄 등)도 잡도록 검사하는 동안만 보이는 요소의 pointer-events 를 켠다.
//  마을 화면: 왼쪽 위 줄(.stat · #mission · #evalbar · #goalPill · #storyWait)과 오른쪽 버튼 줄끼리 서로 겹치지 않는지.
//  실행: URL=http://localhost:4205/ node scripts/e2e-overlap.mjs [저장 폴더]   (DEV 전역이 있는 BOT_BUILD 빌드에서)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const t0 = Date.now();
const URL = process.env.URL ?? 'http://localhost:4205/';
const dir = process.argv[2] ?? 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/gs3';
const SAVES = [['따밤', 'save_01.json'], ['웅스', 'save_02.json'], ['이카몰리', 'save_03.json']]
  .map(([who, f]) => [who, path.join(dir, f)])
  .filter(([, f]) => fs.existsSync(f));
if (!SAVES.length) throw new Error('저장 없음: ' + dir);
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DEVS = {
  '360x740': { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: AND },
  '412x915': { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: AND },
  '390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IOS },
};
const SKIP = /사진 찍기|유저 톡방/;
const b = await chromium.launch({ channel: 'chrome' });
const fails = [];
const notes = [];

async function run(who, file, size) {
  const raw = fs.readFileSync(file, 'utf8');
  const ctx = await b.newContext(DEVS[size]);
  await ctx.addInitScript((save) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', save);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, raw);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const tag = `${who} · ${size}`;
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
    await p.locator('#tCont').click();
    await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
    // 열린 대화·창 정리
    await p.evaluate(async () => {
      const W = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
        let busy = false;
        if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
        else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
        calm = busy ? 0 : calm + 1;
        await W(busy ? 120 : 250);
      }
    });
    // ── 마을 화면 HUD 끼리 겹침 (대화·창·투어가 끝나 HUD가 다 보일 때) ──
    await p.waitForFunction(() => !document.body.classList.contains('winopen') && !document.querySelector('.talking') && document.querySelector('#dlg').hidden && getComputedStyle(document.querySelector('.top .stat')).visibility !== 'hidden', null, { timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(600); // HUD 틱(알약·다음 이야기 줄 자리 잡기)
    const hud = await p.evaluate(() => {
      const vis = (e) => { if (!e || e.hidden) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
      const L = ['.top .stat', '#mission', '#evalbar', '#goalPill', '#storyWait'];
      const R = ['#bNotice', '#bDN', '#bMenu', '#bHarm', '#hSpk', '#bZoom', '#propBadge'];
      const got = [...L, ...R].map((s) => [s, vis(document.querySelector(s))]).filter(([, r]) => r);
      const out = [];
      const hit = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 2 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 2;
      for (let i = 0; i < got.length; i++) for (let j = i + 1; j < got.length; j++) {
        const [a, ra] = got[i], [c, rc] = got[j];
        if (a === '#bDN' && c === '#bMenu') continue;
        if (hit(ra, rc)) out.push(`${a} ↔ ${c}`);
      }
      return { out, seen: got.map(([s]) => s) };
    });
    for (const o of hud.out) fails.push(`HUD 겹침 · ${o} · 마을 화면 · ${tag}`);
    // ── 창 목록 ──
    const tiles = await p.evaluate(() => {
      window.__openMenu();
      return [...document.querySelectorAll('[data-m]')].map((e) => ({ m: e.dataset.m, name: e.querySelector('span')?.textContent ?? '', lock: e.classList.contains('lock') }));
    });
    const targets = [{ kind: 'menu', name: '메뉴' }];
    for (const t of tiles) if (!t.lock && !SKIP.test(t.name)) targets.push({ kind: 'tile', ...t });
    for (const k of ['inn', 'tavern', 'smith', 'alchemy', 'chapel', 'board']) targets.push({ kind: 'obj', k, name: `건물:${k}` });
    targets.push({ kind: 'guest', name: '손님 상세' });
    const res = await p.evaluate(async (targets) => {
      const W = (ms) => new Promise((r) => setTimeout(r, ms));
      const win = document.querySelector('#win');
      const out = [];
      const closeAll = async () => {
        for (let i = 0; i < 12; i++) {
          if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click();
          else if (win.classList.contains('on')) document.querySelector('#winX').click();
          else break;
          await W(40);
        }
        document.querySelectorAll('.pmenu').forEach((e) => e.remove());
      };
      const sample = (name) => {
        // 보이는 요소는 검사 동안만 눌림 판정 켬 (pointer-events:none HUD도 잡기)
        const touched = [];
        for (const e of document.querySelectorAll('#view *')) {
          if (win.contains(e)) continue;
          const cs = getComputedStyle(e);
          if (cs.pointerEvents !== 'none' || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
          const r = e.getBoundingClientRect();
          if (!r.width || !r.height || r.width * r.height > innerWidth * innerHeight * 0.6) continue; // 화면 전체 막(오버레이 틀)은 제외
          touched.push([e, e.style.pointerEvents]);
          e.style.pointerEvents = 'auto';
        }
        const pts = [];
        const add = (label, r, fx, fy) => r && r.width && pts.push([label, r.left + r.width * fx, r.top + r.height * fy]);
        const rr = (s) => { const e = win.querySelector(s); return e && e.offsetParent ? e.getBoundingClientRect() : null; };
        const hd = rr('.hd');
        add('제목줄 왼쪽', hd, 0.12, 0.5); add('제목줄 가운데', hd, 0.5, 0.5); add('제목줄 오른쪽', hd, 0.8, 0.5);
        add('닫기', rr('#winX'), 0.5, 0.5);
        const tb = rr('.tabs');
        add('탭 왼쪽', tb, 0.08, 0.5); add('탭 가운데', tb, 0.5, 0.5); add('탭 오른쪽', tb, 0.92, 0.5);
        const bd = rr('#winB');
        if (bd) {
          const ins = (r, x, y) => pts.push([`본문 ${x < 0.5 ? '왼' : '오른'}${y < 0.5 ? '위' : '아래'}`, r.left + (x < 0.5 ? 6 : r.width - 6), r.top + (y < 0.5 ? 6 : r.height - 6)]);
          ins(bd, 0, 0); ins(bd, 1, 0); ins(bd, 0, 1); ins(bd, 1, 1);
          add('본문 가운데', bd, 0.5, 0.5);
        }
        const bad = [];
        for (const [label, x, y] of pts) {
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
          const e = document.elementFromPoint(x, y);
          if (!e || win.contains(e)) continue;
          const d = (e.id ? '#' + e.id : e.tagName.toLowerCase()) + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
          bad.push(`${d} @${label}`);
        }
        for (const [e, v] of touched) e.style.pointerEvents = v;
        return bad;
      };
      for (const t of targets) {
        await closeAll();
        try {
          if (t.kind === 'menu') window.__openMenu();
          else if (t.kind === 'tile') { window.__openMenu(); document.querySelector(`[data-m="${t.m}"]`)?.click(); }
          else if (t.kind === 'obj') { const o = window.__world.objs.find((x) => x.kind === t.k && !x.building); if (!o) { out.push({ name: t.name, skip: '없음' }); continue; } window.__showObj(o); }
          else { const a = window.__world.actors.find((x) => x.id && !x.role && !x.leaving); if (!a) { out.push({ name: t.name, skip: '없음' }); continue; } window.__showActor(a); }
        } catch (e) { out.push({ name: t.name, err: String(e).slice(0, 120) }); continue; }
        await W(t.kind === 'tile' ? 60 : 300); // 메뉴→창은 이미 열린 창 교체(애니메이션 없음) · 처음 여는 창은 0.22s 올라옴
        // 처음 여는 튜토리얼 대화가 끼면 넘기고 창만 본다
        for (let i = 0; i < 20 && !document.querySelector('#dlg').hidden; i++) { document.querySelector('#dlg').click(); await W(40); }
        if (!win.classList.contains('on')) { out.push({ name: t.name, skip: '창 아님' }); continue; }
        await W(30);
        out.push({ name: t.name, title: document.querySelector('#winT').textContent, bad: sample(t.name) });
      }
      await closeAll();
      return out;
    }, targets);
    let n = 0;
    for (const r of res) {
      if (r.err) fails.push(`창 열기 오류 · ${r.name} · ${tag} · ${r.err}`);
      else if (r.skip) notes.push(`건너뜀 · ${r.name}(${r.skip}) · ${tag}`);
      else { n++; for (const x of [...new Set(r.bad)]) fails.push(`창 위 겹침 · ${x} · ${r.name}「${r.title}」 · ${tag}`); }
    }
    console.error(`  ${tag}: 창 ${n}개 검사 · HUD ${hud.seen.join(" ")}`);
    if (errs.length) fails.push(`페이지 오류 · ${tag} · ${errs.join(' | ')}`);
  } catch (e) {
    fails.push(`실행 실패 · ${tag} · ${String(e).slice(0, 200)}`);
  } finally {
    await ctx.close();
  }
}

const jobs = [];
for (const [who, f] of SAVES) for (const size of Object.keys(DEVS)) jobs.push(run(who, f, size));
await Promise.all(jobs);
await b.close();
const sec = ((Date.now() - t0) / 1000).toFixed(1);
for (const n of notes) console.error('· ' + n);
for (const f of fails) console.error('✗ ' + f);
console.error(fails.length ? `✗ 겹침 ${fails.length}건 (${sec}s)` : `✓ 겹침 없음 (${sec}s)`);
process.exit(fails.length ? 1 : 0);
