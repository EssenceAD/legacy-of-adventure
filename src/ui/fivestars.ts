// FIVESTARS 화면 (플래그 fiveStars · 실험실 vis) — 모모 편지 · 합류 컷(카메오 → 신화 모습 · 별가루 · 무지갯빛 테두리 · 흔들림 없음 · 탭하면 넘김 · 1초 안)
//  · 마지막 「다섯 별」 컷 · 장부 3막 장 5칸 · 세트 4명 첫 전투 1초 컷 · 밤하늘 별자리 · 본인 배지
//  초상화: 신화 모습 star_<id> (형철 그림 asset_raw/fivestars/star_<id>.png → public/portraits/ · engine/assets.ts ports에 키 추가) 이 없으면 카메오 초상 p_<id>
//          왈왈콩선생 카메오 p_walwal (asset_raw/fivestars/p_walwal.png) 이 없으면 사제 손님 초상
import { CONFIG } from '../data/config';
import { STAR_IDS, STARS, type StarId } from '../data/fivestars';
import { FIVE_CHAPTER, FIVE_FINAL, FIVE_JOIN, FIVE_LETTER, FIVE_REQUEST, FIVE_SELF, FIVE_SET_CUT, FIVE_SHARD, FIVE_TITLE } from '../data/story/fivestars';
import type { SLine } from '../data/story/v1';
import { PORTRAITS } from '../engine/assets';
import { myPioneer } from '../net/server';
import { arrive } from '../world/actors';
import { decorView } from '../world/decor';
import { constellationOn, fiveHooks, fiveLedger, fiveOn, fiveSetCutDue, fiveTick, selfStarId, setSelfStar } from '../world/fivestars';
import { S, type Actor } from '../world/state';
import { entrance } from '../world/town';
import { esc } from './common';
import { playStory, storyBusy } from './story';
import { toastHtml } from './windows';

/** 그림이 아직 없을 때 대신 보일 초상 (형철 그림이 오면 저절로 그 그림) */
function portraitFallbacks() {
  if (!PORTRAITS.p_walwal) PORTRAITS.p_walwal = PORTRAITS.g_cleric_human || PORTRAITS.cleric || '';
  for (const id of STAR_IDS) if (!PORTRAITS['star_' + id]) PORTRAITS['star_' + id] = PORTRAITS['p_' + id] || PORTRAITS[STARS[id].kind] || '';
}

// ───────── 짧은 컷 (탭하면 넘김 · 흔들림 없음) ─────────

function quickCut(html: string, ms: number, done: () => void) {
  const view = document.getElementById('view') ?? document.body;
  const el = document.createElement('div');
  el.id = 'fiveCut';
  el.innerHTML = html;
  view.appendChild(el);
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    el.remove();
    done();
  };
  el.addEventListener('pointerdown', end);
  setTimeout(end, ms);
}
/** 합류 컷: 카메오 초상 → 신화 초상 (별가루 · 무지갯빛 테두리) → 대사 */
function playJoin(id: StarId, a: Actor) {
  portraitFallbacks();
  const d = STARS[id];
  const html = `<div class="fc-frame"><img class="fc-a" src="${PORTRAITS['p_' + id] ?? ''}" alt=""><img class="fc-b" src="${PORTRAITS['star_' + id] ?? ''}" alt=""><i class="fc-dust"></i><b>${esc(d.name)}</b></div>`;
  quickCut(html, CONFIG.fiveStars.joinCutMs, () => {
    const self: SLine[] = selfStarId() === id ? [[`star_${id}`, FIVE_SELF[id]]] : [];
    playStory([...FIVE_JOIN[id], ...self, ['narr', `${d.name} 합류 — 신화 「다섯 별」 · 스킬 「${d.skill.name}」: ${d.skill.desc}`]], () => {
      void a;
      toastHtml(`<span>✦ <b class="g">${esc(d.name)}</b> 신화 영웅으로 합류!</span>`, 4000);
    });
  });
}
/** 세트 4명 첫 전투 (combat/ui.ts startCombat): 「다섯 별」 1초 */
export function fiveSetCut(ms: Actor[]) {
  if (!fiveSetCutDue(ms)) return;
  quickCut(`<div class="fc-set"><b>${esc(FIVE_SET_CUT)}</b></div>`, CONFIG.fiveStars.set4CutMs, () => {});
}

// ───────── 장부 3막 장 (menu.ts openGuideList 아래) ─────────

export function fiveLedgerHtml(): string {
  const cells = fiveLedger();
  if (!cells) return '';
  const rows = cells
    .map((c, i) => {
      const r = FIVE_REQUEST[c.id];
      const prog = c.goals.map((g) => `${g.cur}/${g.need}`).join(' · ');
      return `<div class="mrow ${c.joined ? 'done' : ''}"><span>${c.joined ? '✦' : '·'}</span><b>${i + 1}. ${esc(c.name)} 「${esc(r.title)}」<small class="note"> ${esc(r.text)}${c.joined ? '' : ` — ${c.goals.map((g) => esc(g.label)).join(' + ')}`}</small></b><em>${c.joined ? '합류' : prog}</em></div>`;
    })
    .join('');
  return `<div class="qhd"><b class="g">3막 「${esc(FIVE_CHAPTER.name)}」</b><span class="note">${esc(FIVE_CHAPTER.intro)}</span></div><div class="mlist">${rows}</div>`;
}

// ───────── 밤하늘 별자리 ─────────

let sky: HTMLDivElement | null = null;
function syncSky() {
  const on = constellationOn() && !S.visiting && S.nightT > 0.05;
  if (!on) {
    sky?.remove();
    sky = null;
    return;
  }
  if (!sky || !sky.isConnected) {
    sky = document.createElement('div');
    sky.id = 'fiveSky';
    sky.setAttribute('aria-hidden', 'true');
    sky.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    (document.getElementById('view') ?? document.body).appendChild(sky);
  }
  sky.style.opacity = String(Math.min(1, S.nightT) * 0.9);
}

export function initFiveStars() {
  fiveHooks.entrance = () => entrance();
  fiveHooks.place = (a) => void arrive(a);
  void myPioneer().then(setSelfStar);
  setInterval(() => {
    if (!fiveOn()) return syncSky();
    portraitFallbacks();
    syncSky();
    if (document.hidden || storyBusy() || decorView.on || document.getElementById('fiveCut')) return;
    const ev = fiveTick();
    if (!ev) return;
    portraitFallbacks();
    if (ev.kind === 'letter') playStory(FIVE_LETTER, () => toastHtml(`<span>📖 장부에 3막 「<b class="g">${esc(FIVE_CHAPTER.name)}</b>」이 열렸어요</span>`, 5000));
    else if (ev.kind === 'join') playJoin(ev.id, ev.actor);
    else playStory(FIVE_FINAL, () => toastHtml(`<span>✦ 별지기의 열쇠 조각 「<b class="g">${esc(FIVE_SHARD)}</b>」 · 장식 「다섯 별 깃발」(보관함) · 칭호 「<b class="g">${esc(FIVE_TITLE)}</b>」</span>`, 7000));
  }, 1000);
}
