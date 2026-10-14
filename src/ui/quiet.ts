// FIRSTLOOK §2 화면 조용히 — 화면 쪽 (규칙은 world/quiet.ts)
//  2. 「오늘의 목표 달성!」 가운데 안내 상자 대신: 왼쪽 위 목표 알약(새 HUD면 소식 띠)을 1.2초 깜빡 + 옆에 작은 꼬리표 「받기!」
//  5. 마을을 처음 연 뒤 10초 동안 아래 소문·채팅 띠(#chatlog) 숨김 (body.qband)
//  6. 설정 줄 「화면 조용히」 (플래그가 켜졌을 때만 보임 · 기본 켬)
import { CONFIG } from '../data/config';
import { P, S } from '../world/state';
import { GOAL_TEMPLATES } from '../data/goals';
import { track } from '../world/progress';
import { floatW } from '../world/fx';
import { bandHidden, noteVillageOpen, qb, quietHooks, quietOn, quietPrefOn } from '../world/quiet';
import { vis } from '../world/visual';
import { syncGoalPill } from './goalPill';
import { bandFocus } from './hud2';

const Q = () => CONFIG.firstLook.quiet;
const $ = (s: string) => document.querySelector<HTMLElement>(s);
const shown = (e: HTMLElement | null): e is HTMLElement => !!e && !e.hidden && e.offsetParent !== null;

/** 깜빡일 곳: 보이는 것 중 첫째 (sels 순서) → 없으면 새 HUD 소식 띠 */
function target(sels: string[]): HTMLElement | null {
  for (const q of sels) {
    const e = $(q);
    if (shown(e)) return e;
  }
  const band = $('#newsBand');
  return shown(band) ? band : null;
}
/** 받을 목표가 남았나 */
const anyReady = () => P.goals.list.some((g) => g.progress >= g.target && !g.claimed) || !!$('#goalPill')?.classList.contains('ready');

let tag: HTMLButtonElement | null = null;
let tagUntil = 0;
let tagFor: HTMLElement | null = null;
/** 지금 꼬리표: 글자 · 아직 보일 만한가 · 누르면 (없으면 붙은 곳을 누른 것과 같게) */
let tagSpec: { label: string; aria: string; still: () => boolean; tap?: () => void } = { label: '받기!', aria: '오늘의 목표 받기', still: anyReady };

/** 가운데 상자 대신: 붙을 곳을 1.2초 깜빡 + 옆에 작은 꼬리표 */
function nudge(sels: string[], bandKey: string, spec: typeof tagSpec, now: number) {
  if ($('#newsBand') && !sels.some((q) => shown($(q)))) bandFocus(bandKey);
  const t = target(sels);
  tagSpec = spec;
  tagUntil = now + Q().goalTagMs;
  tagFor = t;
  if (tag) {
    tag.textContent = spec.label;
    tag.setAttribute('aria-label', spec.aria);
  }
  if (t) {
    t.classList.remove('qblink');
    void t.offsetWidth;
    t.classList.add('qblink');
    setTimeout(() => t.classList.remove('qblink'), Q().goalBlinkMs);
  }
  placeTag(now);
}

/** 목표 달성 → 알약 깜빡 + 「받기!」 */
export function goalNudge(now = performance.now()) {
  syncGoalPill();
  nudge(['#goalPill'], 'goal', { label: '받기!', aria: '오늘의 목표 받기', still: anyReady }, now);
}

/** 리뷰 ④: 「새 장이 열렸어요」 → 장부 카드(없으면 목표 알약·소식 띠) 깜빡 + 「새 장!」 · 누르면 장부(3막 머리로) */
export function chapterNudge(still: () => boolean, open: () => void, now = performance.now()) {
  nudge(['#mission', '#goalPill'], 'mission', { label: '새 장!', aria: '장부 새 장 보기', still, tap: open }, now);
}

function placeTag(now: number) {
  const t = tagFor && shown(tagFor) ? tagFor : null;
  const on = quietOn() && !!t && now < tagUntil && tagSpec.still() && S.started && !S.visiting;
  if (!on) {
    if (tag) tag.hidden = true;
    return;
  }
  const hud = document.getElementById('hud');
  if (!hud) return;
  if (!tag) {
    tag = document.createElement('button');
    tag.id = 'qGoalTag';
    tag.className = 'px';
    tag.textContent = tagSpec.label;
    tag.setAttribute('aria-label', tagSpec.aria);
    tag.onclick = (e) => {
      e.stopPropagation();
      tagUntil = 0;
      tag!.hidden = true;
      if (tagSpec.tap) tagSpec.tap();
      else tagFor?.click();
    };
    hud.appendChild(tag);
  }
  tag.hidden = false;
  const H = hud.getBoundingClientRect();
  // 소식 띠(넓은 줄)는 글자 끝 바로 옆에
  const r = (t!.id === 'newsBand' ? t!.querySelector('span') ?? t! : t!).getBoundingClientRect();
  // 알약 오른쪽 · 화면 밖이면 알약 아래
  const w = tag.offsetWidth || 40;
  let x = r.right + 4 - H.left;
  let y = r.top + (r.height - (tag.offsetHeight || 18)) / 2 - H.top;
  // 버닝 띠(남은 시간 + 두 번째 줄)가 떠 있으면 글자 옆 대신 띠 아래로 (남은 시간을 덮지 않게)
  const burnBand = t!.id === 'newsBand' && t!.classList.contains('burn');
  if (burnBand || x + w > H.width - 4) {
    const b = burnBand ? t!.getBoundingClientRect() : r;
    x = b.left - H.left;
    y = b.bottom + 2 - H.top;
  }
  tag.style.left = `${Math.round(x)}px`;
  tag.style.top = `${Math.round(y)}px`;
}

/** 설정 줄 (플래그가 꺼져 있으면 빈 줄) */
export const quietRowHtml = () =>
  vis('flQuiet') ? `<label class="tog"><input type="checkbox" id="mQuiet" ${quietPrefOn() ? 'checked' : ''}> 화면 조용히 <small>(마을 말풍선 하나씩 · 이름표·떠다니는 글씨 줄이기 · 끄면 예전처럼)</small></label>` : '';

export function initQuietUi() {
  quietHooks.goalNudge = () => goalNudge();
  quietHooks.chapterNudge = (still, open) => chapterNudge(still, open);
  // 개발·시트용: 말풍선 줄 보기 · 목표 하나 바로 달성
  if (import.meta.env.DEV)
    Object.assign(window, {
      __quiet: {
        qb,
        float: floatW,
        goalDone: () => {
          const g = P.goals.list.find((x) => x.progress < x.target);
          const t = g && GOAL_TEMPLATES.find((x) => x.id === g.id);
          if (!g || !t) return false;
          g.progress = g.target - 1;
          track(t.event);
          return true;
        },
      },
    });
  setInterval(() => {
    if (document.hidden) return;
    const now = performance.now();
    if (S.started && !S.visiting) noteVillageOpen(now);
    document.body.classList.toggle('qband', bandHidden(now));
    placeTag(now);
  }, 250);
}
