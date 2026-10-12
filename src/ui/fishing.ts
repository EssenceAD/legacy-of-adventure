// GROWTH §4 낚시 창: 미끼 · [던지기] → 5초 찌 미니게임(「!」가 뜬 순간 누르기 · 판정 창 0.5초~) · 결과 · 가방(팔기 · 박제 · 놓아주기)
//  연못(잉어·연꽃 연못 건물 창 [낚시]) · 해안(사냥터 지역 탭 옆 🎣, 등대 해안이 열린 뒤). 누르기는 pointerdown(폰에서 빠르게).
import { CONFIG } from '../data/config';
import { FISH, FISH_LINES, type FishDef } from '../data/story/fish';
import { josa } from '../data/josa';
import { huntRegionOpen } from '../world/hunt';
import { baitLeft, baitMax, biteLine, cast, cookFish, fishById, fishForce, fishPool, GRADE_FISH, judge, land, missLine, releaseFish, sellFish, stuffFish, timeNow, makeBait, type Cast, type FishWhere } from '../world/fishing';
import { mealGold } from '../world/growth';
import { P } from '../world/state';
import { $, $$, esc, fmt } from './common';
import { sfx } from '../audio/sfx';
import { objExtra, openWin, showObj, toast } from './windows';
import { track as trackEv } from '../net/telemetry';
import { bestOf } from '../world/town';

export const fishImg = (id: string, cls = 'fishic') => `<img class="${cls}" src="${import.meta.env.BASE_URL}assets/fish/${id}.png" alt="">`;
const WHERE_NAME: Record<FishWhere, string> = { pond: '마을 연못', sea: '등대 해안' };

/** 진행 중인 한 판 */
let cur: { c: Cast; t0: number; done: boolean; timers: number[] } | null = null;
let lastWhere: FishWhere = 'pond';
function stop() {
  if (cur) for (const t of cur.timers) clearTimeout(t);
  cur = null;
}
const timeName = () => {
  const t = timeNow();
  return t.dawn ? '새벽' : t.night ? '밤' : '낮';
};

export function openFishing(where: FishWhere = lastWhere, result = '') {
  stop();
  lastWhere = where;
  if (where === 'sea' && !huntRegionOpen(5)) return toast('「가라앉은 등대 해안」이 열리면 해안 낚시를 할 수 있어요');
  const bait = baitLeft();
  const pool = fishPool(where);
  const bag = FISH.filter((f) => (P.growth.fish.bag[f.id] ?? 0) > 0);
  const crops = Object.values(P.crops).reduce((s, n) => s + Math.max(0, n), 0);
  openWin(
    `🎣 낚시 · ${WHERE_NAME[where]}`,
    `<p class="sub">미끼 <b class="g" id="fBaitN">${bait}</b>개 <small>(하루 ${baitMax()} · 여관 ${CONFIG.growth.fish.baitPerInnLv}레벨마다 +1)</small> <button class="bagb" id="fBait" ${crops ? '' : 'disabled'}>🥕 작물 1개로 미끼 만들기</button></p>
    <div class="fstage" id="fStage"><div class="fwater"></div><div class="fbob" id="fBob"><i></i></div><div class="fbang" id="fBang">!</div><div class="fmsg" id="fMsg">${result || '[던지기]를 누르고 찌를 지켜보세요 · 「!」가 뜨는 순간 화면을 톡!'}</div></div>
    <div class="btnrow"><button class="bigbtn" id="fCast" ${bait ? '' : 'disabled'}>🎣 던지기</button></div>
    <p class="note">지금은 ${timeName()} · 이 시간에 사는 물고기 ${pool.length}종 · 희귀할수록 「!」가 짧아요</p>
    <div class="qhd"><b class="g">물고기 가방</b><span class="note">팔기 · 주점에서 요리(원정 버프) · 선물 · 박제(장식)</span></div>
    <div class="ilist fbag">${
      bag
        .map((f) => {
          const n = P.growth.fish.bag[f.id];
          return `<div class="irow">${fishImg(f.id)}<span><b style="color:${GRADE_FISH[f.grade].color}">${esc(f.name)}</b> ×${n}<small>${GRADE_FISH[f.grade].name} · 최대 ${P.growth.fish.rec[f.id]?.max ?? 0}cm${f.use.includes('cook') ? ' · 요리' : ''}${f.use.includes('gift') ? ' · 선물' : ''}</small></span><button data-fsell="${f.id}">팔기 ${fmt(f.price)}G</button>${f.use.includes('trophy') ? `<button class="ghost" data-fstuff="${f.id}">박제</button>` : ''}${f.id === 'starwhale' ? `<button class="ghost" data-frel="${f.id}">놓아주기</button>` : ''}</div>`;
        })
        .join('') || '<p class="note">아직 낚은 물고기가 없어요</p>'
    }</div>`,
    'fishw',
  );
  $('#fCast').onclick = () => startCast(where);
  $('#fBait').onclick = () => {
    const err = makeBait();
    toast(err ?? '미끼 +1');
    openFishing(where);
  };
  // 판정은 판 전체(물 · 찌 · 글자)를 누르는 것 — 손가락이 어디에 닿아도
  $('#fStage').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tapStage();
  });
  $$('[data-fsell]').forEach(
    (b) =>
      (b.onclick = () => {
        const g = sellFish(b.dataset.fsell!);
        if (g) toast(`💰 +${fmt(g)}`);
        openFishing(where);
      }),
  );
  $$('[data-fstuff]').forEach(
    (b) =>
      (b.onclick = () => {
        const f = fishById(b.dataset.fstuff!)!;
        if (!confirm(`${f.name}${josa(f.name, '를')} 박제할까요? (건설 목록에서 무료로 놓는 1×1 장식)`)) return;
        const err = stuffFish(f.id);
        toast(err ?? `「${f.name} 박제」 — 건설 → 장식에서 무료로 놓을 수 있어요`);
        openFishing(where);
      }),
  );
  $$('[data-frel]').forEach(
    (b) =>
      (b.onclick = () => {
        const line = releaseFish(b.dataset.frel!);
        if (line) toast(line);
        openFishing(where);
      }),
  );
}

function setMsg(html: string) {
  const m = document.getElementById('fMsg');
  if (m) m.innerHTML = html;
}
function startCast(where: FishWhere) {
  if (cur && !cur.done) return;
  const c = cast(where);
  if (!c) return toast('미끼가 없어요 · 내일 또는 작물로 만들어요');
  trackEv('fish_cast', { where });
  const st = document.getElementById('fStage')!;
  st.classList.remove('bite', 'got', 'miss');
  st.classList.add('cast');
  (document.getElementById('fCast') as HTMLButtonElement).disabled = true;
  const n = document.getElementById('fBaitN');
  if (n) n.textContent = String(baitLeft());
  setMsg('찌가 흔들린다…');
  const run = { c, t0: performance.now(), done: false, timers: [] as number[] };
  cur = run;
  run.timers.push(
    window.setTimeout(() => {
      if (cur !== run || run.done) return;
      st.classList.add('bite');
      setMsg(`<b>${esc(biteLine())}</b>`);
      sfx('tap');
    }, c.bite * 1000),
  );
  // 판정 창이 지나면 놓침 (조금 여유 — 실제 판정은 누른 시각으로)
  run.timers.push(window.setTimeout(() => cur === run && !run.done && finish(false, 'late'), (c.bite + c.win) * 1000 + 60));
}
function tapStage() {
  const run = cur;
  if (!run || run.done) return;
  const t = (performance.now() - run.t0) / 1000;
  if (import.meta.env.DEV) (window as unknown as { __fishTap?: unknown }).__fishTap = { t, bite: run.c.bite, win: run.c.win };
  finish(judge(run.c, t), t < run.c.bite ? 'early' : 'late');
}
function finish(ok: boolean, why: 'early' | 'late') {
  const run = cur;
  if (!run || run.done) return;
  run.done = true;
  for (const t of run.timers) clearTimeout(t);
  const st = document.getElementById('fStage');
  st?.classList.remove('cast', 'bite');
  if (!ok) {
    st?.classList.add('miss');
    sfx('fail');
    trackEv('fish_end', { ok: false, why });
    setMsg(`<b>${why === 'early' ? '너무 일렀어요… ' : ''}${esc(missLine())}</b>`);
    afterRound();
    return;
  }
  const c = land(run.c);
  st?.classList.add('got');
  sfx(c.fish.grade === 'l' ? 'legend' : c.fish.grade === 'e' ? 'rare' : 'coin');
  trackEv('fish_end', { ok: true, id: c.fish.id, size: c.size });
  setMsg(catchHtml(c.fish, c.size, c.first, c.record));
  afterRound();
}
function catchHtml(f: FishDef, size: number, first: boolean, record: boolean) {
  return `<div class="fcatch">${fishImg(f.id, 'fishbig')}<div><b style="color:${GRADE_FISH[f.grade].color}">${esc(f.name)}</b> <small>${GRADE_FISH[f.grade].name} · ${size}cm</small>${first ? ' <i class="new">NEW!</i>' : record ? ' <i class="new">최대어!</i>' : ''}<p>${esc(f.grade === 'l' ? FISH_LINES.legend : f.text)}</p></div></div>`;
}
function afterRound() {
  const b = document.getElementById('fCast') as HTMLButtonElement | null;
  if (b) {
    b.disabled = baitLeft() <= 0;
    b.textContent = '🎣 한 번 더';
  }
  // 가방 줄 새로 (결과 글은 그대로)
  const msg = document.getElementById('fMsg')?.innerHTML ?? '';
  setTimeout(() => {
    if (document.getElementById('fStage') && (!cur || cur.done)) {
      const keep = msg;
      openFishing(lastWhere, keep);
    }
  }, 1600);
}

// ───────── 건물 창: 연못 [낚시] · 주점 물고기 요리 ─────────

const POND = new Set(['koi_pond', 'lily_pond']);
let prev: ((o: never) => string) | null = null;
export function initFishingUI() {
  prev = objExtra.html as never;
  objExtra.html = (o) => {
    const base = prev!(o as never);
    if (POND.has(o.kind)) return `${base}<button class="bigbtn fishgo" data-fishing="pond">🎣 낚시 (미끼 ${baitLeft()})</button>`;
    if (o.kind === 'tavern' && o.build === undefined) return `${base}${cookHtml()}`;
    return base;
  };
  addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const fb = t.closest?.('[data-fishing]') as HTMLElement | null;
    if (fb) return openFishing(fb.dataset.fishing as FishWhere);
    const ck = t.closest?.('[data-cook]') as HTMLElement | null;
    if (ck) {
      const err = cookFish(ck.dataset.cook!);
      if (err) return toast(err);
      const f = fishById(ck.dataset.cook!)!;
      trackEv('fish_cook', { id: f.id });
      toast(`🍲 ${f.name} 요리! 원정 금화 +${Math.round(mealGold() * 100)}% (${CONFIG.growth.fish.meal.minutes / 60}시간)`);
      const tv = bestOf('tavern' as never);
      if (tv) showObj(tv);
    }
  });
}
function cookHtml(): string {
  const m = P.growth.meal && P.growth.meal.until > Date.now() ? P.growth.meal : null;
  const list = FISH.filter((f) => f.use.includes('cook') && (P.growth.fish.bag[f.id] ?? 0) > 0);
  return `<div class="alch fishcook"><b class="g">🍲 물고기 요리</b> <small>원정 금화 + (흔함 5% ~ 영웅 15%) · ${CONFIG.growth.fish.meal.minutes / 60}시간 · 새로 하면 바뀜</small>${m ? `<p class="sub good">지금: ${esc(m.name)} · 원정 금화 +${Math.round(m.v * 100)}% · ${Math.ceil((m.until - Date.now()) / 60000)}분 남음</p>` : ''}${
    list.map((f) => `<div class="irow">${fishImg(f.id)}<span><b>${esc(f.name)}</b> ×${P.growth.fish.bag[f.id]}<small>원정 금화 +${Math.round((CONFIG.growth.fish.meal.v[f.grade] ?? 0) * 100)}%</small></span><button data-cook="${f.id}">요리</button></div>`).join('') || '<p class="note">요리할 물고기가 없어요 · 연못이나 해안에서 낚아 와요</p>'
  }</div>`;
}

// 개발용
if (import.meta.env.DEV) Object.assign(window, { __fish: { open: openFishing, force: (id: string) => (fishForce.id = id), cur: () => (cur ? { bite: cur.c.bite, win: cur.c.win, id: cur.c.fish.id, t: (performance.now() - cur.t0) / 1000, done: cur.done } : null) } });
