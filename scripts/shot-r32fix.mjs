// R32 형철 판정 고침 4장 (실험실 켬) · 412 — ① 이웃 방문 이름표(⚙와 안 겹침) ② 펫 카드 「?!」 ③ 보스 연전 3.5초 ④ 전용 무기 「강화 이어받기」 시트
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-r32 && npx vite preview --outDir dist-bot-r32 --port 4432 --strictPort
//        URL=http://localhost:4432/ node scripts/shot-r32fix.mjs [저장] → reports/tonight/fix/*.png  (SCENES=visit,pet,rush,inherit 골라 찍기)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const APP = process.env.URL ?? 'http://localhost:4432/';
const OUT = process.env.OUT ?? 'reports/tonight/fix';
const SCENES = (process.env.SCENES ?? 'visit,pet,rush,inherit').split(',');
fs.mkdirSync(OUT, { recursive: true });
const save = JSON.parse(fs.readFileSync(process.argv[2] ?? 'tests/fixtures/real_hyeongcheol.json', 'utf8'));
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const br = await chromium.launch({ channel: 'chrome' });
const VER = JSON.stringify((await (await (await br.newContext()).request.get(APP + 'version.json')).json()).version);
const errs = [];
const W = (p, ms) => p.waitForTimeout(ms);
const WIDTH = +(process.env.W ?? 412);

async function clear(p) {
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    const busy = await p.evaluate(() => {
      const nb = document.querySelector('#namebox');
      if (nb && !nb.hidden) return document.querySelector('#nameSug button')?.click(), true;
      const dlg = document.querySelector('#dlg');
      if (dlg && !dlg.hidden) {
        const c = document.querySelector('#dChoice button');
        if (c && c.checkVisibility()) c.click();
        else dlg.click();
        return true;
      }
      if (document.querySelector('#win')?.classList.contains('on')) return document.querySelector('#winX').click(), true;
      return false;
    });
    calm = busy ? 0 : calm + 1;
    await W(p, busy ? 200 : 300);
  }
}
const shot = async (p, name, clip) => {
  await p.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  console.error('✓ ' + `${OUT}/${name}.png`);
};

async function boot() {
  const ctx = await br.newContext({ viewport: { width: WIDTH, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });
  await ctx.route(/supabase/, (r) => r.abort());
  await ctx.addInitScript(
    ([s, ver]) => {
      window.__conScale = 1 / 30;
      try {
        if (sessionStorage.getItem('x')) return;
        sessionStorage.setItem('x', '1');
      } catch {
        return;
      }
      localStorage.clear();
      localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
      localStorage.setItem('legacy-of-adventure-lastVersion', ver);
      localStorage.setItem('legacy-of-adventure-settleOff', 'true');
      localStorage.setItem('legacy-of-adventure-telemetry', 'false');
      localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
      localStorage.setItem('legacy-of-adventure-visualLab', 'true');
    },
    [JSON.stringify(save), VER],
  );
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tStart'), null, { timeout: 30000 });
  await W(p, 600);
  await p.locator('#tCont').click();
  await clear(p);
  await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
  await W(p, 1500);
  await clear(p);
  return { ctx, p };
}

async function scene(name, fn) {
  if (!SCENES.includes(name)) return;
  const { ctx, p } = await boot();
  try {
    await fn(p);
  } catch (e) {
    errs.push(`${name} 못 찍음: ${String(e).slice(0, 300)}`);
    await shot(p, `x_fail_${name}`).catch(() => {});
  }
  await ctx.close();
}

// ① 이웃 방문: 위 카드 이름표 (⚙ 와 겹치지 않게)
await scene('visit', async (p) => {
  await p.evaluate(() => document.getElementById('bVillage')?.click());
  await W(p, 1200);
  await p.locator('.stp[data-f="0"]').first().click();
  await W(p, 2500);
  await clear(p);
  const r = await p.evaluate(() => {
    const g = document.getElementById('bGear')?.getBoundingClientRect();
    const n = document.getElementById('vName')?.getBoundingClientRect();
    return { gear: g && [g.left, g.top, g.right, g.bottom].map(Math.round), name: n && [n.left, n.top, n.right, n.bottom].map(Math.round), visiting: window.__S.visiting?.name };
  });
  console.error('   방문:', JSON.stringify(r));
  await shot(p, `1_visit_name_${WIDTH}`);
  await shot(p, `1b_visit_name_${WIDTH}_top`, { x: 0, y: 0, width: WIDTH, height: 160 });
});

// ② 펫 카드: 「?!」 이름표가 카드 위 테두리에서 4px 아래
await scene('pet', async (p) => {
  await p.evaluate(() => window.__pets.grant('otter', 'fish'));
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!document.getElementById('pcGo'))); i++) {
    await p.evaluate(() => {
      if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click();
      else if (document.querySelector('#win').classList.contains('on') && !document.getElementById('pcGo')) document.querySelector('#winX').click();
    });
    await W(p, 50);
  }
  await W(p, 250);
  const r = await p.evaluate(() => {
    const q = document.querySelector('.ffq')?.getBoundingClientRect();
    const w = document.querySelector('#win')?.getBoundingClientRect();
    return { q: q && [q.top, q.bottom].map(Math.round), win: w && [w.top, w.bottom].map(Math.round) };
  });
  console.error('   펫:', JSON.stringify(r));
  await shot(p, `2_pet_card_${WIDTH}`);
});

// ③ 보스 연전 25층: 시작 3.5초 뒤 (보스 이름 한 번만)
await scene('rush', async (p) => {
  await p.evaluate(() => {
    for (const k of ['forest', 'swamp', 'mine', 'ice', 'coast', 'dune', 'ember', 'sky', 'abyss', 'deep']) window.__P.hunt.best[k] = 10;
    window.__P.gs.abyss = { ...(window.__P.gs.abyss ?? {}), best: 30, weekBest: 30, lost: 0, cur: 0, brags: [] };
    window.__abyss.setMode('rush');
    window.__abyss.open();
  });
  await W(p, 600);
  await clear(p);
  await p.evaluate(() => {
    const ids = window.__abyss.state().picked;
    const ms = ids.map((id) => window.__world.actors.find((a) => a.id === id)).filter(Boolean);
    document.getElementById('winX')?.click();
    window.__abyss.climb(25, ms, 'rush');
  });
  await p.waitForFunction(() => !!window.__combat.field(), null, { timeout: 20000 });
  await W(p, 3500);
  const r = await p.evaluate(() => {
    const t = (id) => {
      const e = document.getElementById(id);
      return e && e.checkVisibility() ? e.textContent : null;
    };
    return { boss: window.__combat.field().elite?.boss?.name, goal: t('cbGoal'), bar: t('cbBossN'), banner: t('cbBanner') };
  });
  console.error('   보스 연전:', JSON.stringify(r));
  await shot(p, `3_rush_3s5_${WIDTH}`);
});

// ④ 전용 무기 첫 깨어남 「강화 이어받기」 시트
await scene('inherit', async (p) => {
  const r = await p.evaluate(() => {
    const acts = window.__world.home?.actors ?? window.__world.actors;
    const a = acts.find((x) => x.status === 'hero' && x.legendId && x.equip.weapon != null) ?? acts.find((x) => x.status === 'hero' && x.legendId);
    if (!a) return null;
    a.stars = 5;
    const st = window.__ex.state();
    st.awoke = st.awoke.filter((k) => k !== a.legendId);
    st.inh = (st.inh ?? []).filter((k) => k !== a.legendId);
    let old = window.__P.bag.find((x) => x.id === a.equip.weapon);
    if (old) {
      old.enh = 16;
      old.name = '초월한 ' + old.name.replace(/^(초월한|극의) /, '');
    }
    const it = window.__ex.grant(a.legendId);
    window.__ex.item(it.id);
    return { hero: a.name, key: a.legendId, old: old && old.name + ' +' + old.enh, ex: it.name };
  });
  console.error('   이어받기:', JSON.stringify(r));
  await W(p, 500);
  await p.locator('[data-exwear]').click();
  await W(p, 700);
  await shot(p, `4_inherit_sheet_${WIDTH}`);
  await p.locator('#cshOk').click();
  await W(p, 2200);
  const after = await p.evaluate((key) => {
    const it = window.__P.bag.find((x) => x.ex === key);
    const acts = window.__world.home?.actors ?? window.__world.actors;
    const a = acts.find((x) => x.legendId === key);
    const prev = window.__P.bag.filter((x) => x.slot === 'weapon' && !x.ex).sort((x, y) => y.id - x.id);
    return { ex: it && `${it.name} +${it.enh}`, worn: a.equip.weapon === it?.id, inh: window.__ex.state().inh };
  }, r?.key);
  console.error('   이어받은 뒤:', JSON.stringify(after));
  await shot(p, `4b_inherit_done_${WIDTH}`);
});

console.error(errs.length ? '오류:\n' + errs.join('\n') : '오류 없음');
await br.close();
