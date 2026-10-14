// FIVESTARS 화면 (플래그 fiveStars · 실험실 vis) — 모모 편지 · 합류 컷(카메오 → 신화 모습 · 별가루 · 무지갯빛 테두리 · 흔들림 없음 · 탭하면 넘김 · 1초 안)
//  · 마지막 「다섯 별」 컷 · 장부 3막 장 5칸 · 세트 4명 첫 전투 1초 컷 · 밤하늘 별자리 · 본인 배지
//  초상화: 신화 모습 star_<id> (asset_raw/fivestars/s_<id>.png → public/assets/portraits/star_<id>.png · engine/assets.ts ports) 이 없으면 카메오 초상 p_<id>
//          왈왈콩선생 카메오 p_walwal (asset_raw/fivestars/p_walwal.png) 이 없으면 사제 손님 초상
//  대사: data/story/fivestars.ts (STARS[id].request · awaken · self · FIVE_LETTER · FIVE_FINALE · FIVE_SET_LINE) · 없는 조각은 story/fivestars_extra.ts
import { CONFIG } from '../data/config';
import { STAR_IDS, STARS, type StarId } from '../data/fivestars';
import { FIVE_FINALE, FIVE_LETTER, FIVE_SET_LINE, STARS as STAR_LINES } from '../data/story/fivestars';
import { FIVE_CHAPTER, FIVE_SHARD, FIVE_TITLE } from '../data/story/fivestars_extra';
import type { SLine } from '../data/story/v1';
import { PORTRAITS } from '../engine/assets';
import { myPioneer } from '../net/server';
import { arrive } from '../world/actors';
import { decorView } from '../world/decor';
import { say } from '../world/fx';
import { constellationOn, fiveChapterNew, fiveChapterViewed, fiveHeart, fiveHooks, fiveNoticeTake, fiveLedger, fiveOn, fiveOswinTale, fiveSetCutDue, fiveTick, makeStar, selfStarId, setSelfStar } from '../world/fivestars';
import { PRI } from '../world/quiet';
import { S, world, type Actor } from '../world/state';
import { entrance } from '../world/town';
import { esc } from './common';
import { playStory, storyBusy } from './story';
import { closeWin, toastHtml } from './windows';

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
    const L = STAR_LINES[id];
    // 부탁을 채운 순간(done) → 찾아옴 · 신화 모습(awaken) → 본인 계정이면 한 줄(self) → 합류 안내
    const self: SLine[] = selfStarId() === id ? [L.self] : [];
    playStory([...L.request.done, ...L.awaken, ...self, ['narr', `${d.name} 합류 — 신화 「다섯 별」 · 「${d.title}」 · 스킬 「${d.skill.name}」: ${d.skill.desc}`]], () => {
      void a;
      toastHtml(`<span>✦ <b class="g">${esc(d.name)}</b> 신화 영웅으로 합류!</span>`, 4000);
    });
  });
}
/** 세트 4명 첫 전투 (combat/ui.ts startCombat): 「다섯 별」 1초 */
export function fiveSetCut(ms: Actor[]) {
  if (!fiveSetCutDue(ms)) return;
  quickCut(setLineHtml(FIVE_SET_LINE[4]), CONFIG.fiveStars.set4CutMs, () => {});
}
/** 「…」 한마디는 크게 · 뒤의 효과 글은 작게 */
function setLineHtml(s: string) {
  const k = s.indexOf('」');
  return k < 0 ? `<div class="fc-set"><b>${esc(s)}</b></div>` : `<div class="fc-set"><b>${esc(s.slice(0, k + 1))}</b><small>${esc(s.slice(k + 1).trim())}</small></div>`;
}

// ───────── 장부 3막 장 (menu.ts openGuideList 아래) ─────────

export function fiveLedgerHtml(): string {
  const cells = fiveLedger();
  if (!cells) return '';
  const rows = cells
    .map((c, i) => {
      const r = STAR_LINES[c.id].request;
      const prog = c.goals.map((g) => `${g.cur}/${g.need}`).join(' · ');
      // 칸을 누르면 그 개척자의 부탁 대사 (request.lines) 다시 듣기
      return `<div class="mrow ${c.joined ? 'done' : ''}" data-five="${c.id}" role="button"><span>${c.joined ? '✦' : '·'}</span><b>${i + 1}. ${esc(c.name)}<small class="note"> ${esc(r.text)}</small></b><em>${c.joined ? '합류' : prog}</em></div>`;
    })
    .join('');
  return `<div class="qhd five"><b class="g">3막 「${esc(FIVE_CHAPTER.name)}」</b><span class="note">${esc(FIVE_CHAPTER.intro)}</span></div><div class="mlist">${rows}</div>`;
}
/** 새 장을 아직 못 봤으면: 장부를 연 뒤 3막 머리(.qhd.five)로 스크롤 + 점 끔 (menu.ts openGuideList) */
export function focusFiveLedger(root: ParentNode = document) {
  if (!fiveChapterNew()) return;
  const hd = root.querySelector<HTMLElement>('.qhd.five');
  if (!hd) return;
  const b = hd.closest<HTMLElement>('#winB');
  if (b) b.scrollTop += hd.getBoundingClientRect().top - b.getBoundingClientRect().top - 4;
  else hd.scrollIntoView({ block: 'start' });
  fiveChapterViewed();
}
/** 「새 장이 열렸어요」 1번 (편지 뒤 · 옛 저장은 처음 한가할 때) */
function fiveNotice() {
  if (S.started && fiveNoticeTake()) toastHtml(`<span>📖 새 장이 열렸어요 · 장부 3막 「<b class="g">${esc(FIVE_CHAPTER.name)}</b>」</span>`, 6000);
}
/** 장부 칸 누르기 (menu.ts가 장부를 그린 뒤) */
export function bindFiveLedger(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-five]').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.five as StarId;
      if (!STAR_LINES[id] || storyBusy()) return;
      closeWin();
      portraitFallbacks();
      playStory(STAR_LINES[id].request.lines);
    };
  });
}
/** 다섯 별 단골 대화 (ui/guests.ts talkGuest): 밤 한 번 heart · 장이 열린 뒤 오스윈 첫 원정대 이야기 */
export function fiveTalk(a: Actor): boolean {
  const l = fiveHeart(a) ?? fiveOswinTale(a);
  if (!l) return false;
  portraitFallbacks();
  playStory(l);
  return true;
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
  // 개발·봇 빌드: 합류 컷 · 마지막 컷 · 세트 컷 바로 보기 (비교 시트용)
  if (import.meta.env.DEV)
    Object.assign(window, {
      __five: {
        join: (id: StarId) => {
          const [x, y] = entrance();
          const a = makeStar(id, x, y);
          arrive(a);
          playJoin(id, a);
          return a;
        },
        star: (id: StarId) => (S.visiting ? null : (world.home?.actors ?? world.actors).find((a) => a.starId === id) ?? null),
        finale: () => playStory(FIVE_FINALE),
        letter: () => playStory(FIVE_LETTER),
        set4: () => quickCut(setLineHtml(FIVE_SET_LINE[4]), 60000, () => {}),
        ask: (id: StarId) => playStory(STAR_LINES[id].request.lines),
      },
    });
  fiveHooks.entrance = () => entrance();
  fiveHooks.place = (a) => void arrive(a);
  fiveHooks.say = (a, s) => say(a, s, 1, '', PRI.story);
  fiveHooks.setLine = (s) => toastHtml(`<span>✦ ${esc(s)}</span>`, 5000);
  void myPioneer().then(setSelfStar);
  setInterval(() => {
    if (!fiveOn()) return syncSky();
    portraitFallbacks();
    syncSky();
    if (document.hidden || storyBusy() || decorView.on || document.getElementById('fiveCut')) return;
    const ev = fiveTick();
    if (!ev) return fiveNotice();
    portraitFallbacks();
    if (ev.kind === 'letter') playStory(FIVE_LETTER, fiveNotice);
    else if (ev.kind === 'join') playJoin(ev.id, ev.actor);
    else playStory(FIVE_FINALE, () => toastHtml(`<span>✦ 별지기의 열쇠 조각 「<b class="g">${esc(FIVE_SHARD)}</b>」 · 장식 「다섯 별 깃발」(보관함) · 칭호 「<b class="g">${esc(FIVE_TITLE)}</b>」</span>`, 7000));
  }, 1000);
}
