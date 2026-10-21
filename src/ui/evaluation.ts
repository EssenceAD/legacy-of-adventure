// 베타 2장: 평가단 화면 — 임무 카드 아래 평가 바 · 평가 창 · 새 시즌 알림 · 평가단 순회 → 결과 카드
import { av } from '../engine/ver';
import { sfx } from '../audio/sfx';
import { CONFIG } from '../data/config';
import { def, type Kind } from '../data/catalog';
import { submitEval } from '../net/server';
import {
  ensureSeason, evalHarmonies, evalHooks, evalHow, evalOpen, evalParts, evalScore, evalSummary, judge, nextTier, sampleMood, THEME_ICON, themeName, tierName, tierOf, tourDue, type EvalResult,
} from '../world/evaluation';
import { startTour, stepTour, tour } from '../world/evalTour';
import { queueEvent } from '../world/events';
import { addMail } from '../world/meta';
import { P, S, type TalkLine } from '../world/state';
import { talk, isTalking } from './dialogue';
import { esc, fmt } from './common';
import { iconSrc } from './kit';
import { isWinOpen, openWin } from './windows';
import { openDexHarmony } from './book';
import { placing } from '../world/town';

const E = CONFIG.evaluation;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const icon = (t: number, small = true) => iconSrc(THEME_ICON[t], small);

export function openEval() {
  if (!evalOpen()) return;
  const ev = P.evaluation;
  const parts = evalParts();
  const score = evalScore();
  const nx = nextTier(score);
  // EVAL_HINT_1021 (아자 건의): 재료마다 「어떻게 올려요?」 한 줄 · 어울림은 목록으로 펼쳐서 (누르면 도감 그 칸)
  const hs = evalHarmonies();
  const hlist = (need: number) =>
    `<div class="evhl"><small class="evhow">아래 ${hs.length}개 중 ${need}개를 완성하면 만점</small>${hs
      .map((h) => `<button class="evh ${h.done ? 'on' : ''}" data-evh="${h.id}">${h.done ? '✅' : '⬜'} <b>${esc(h.name)}</b> — ${esc(h.text)}</button>`)
      .join('')}</div>`;
  const rows = parts
    .map(
      (p) =>
        `<div class="evrow"><span>${p.label}</span><i><b style="width:${Math.round((p.pts / p.max) * 100)}%"></b></i><em>${fmt(p.pts)}/${p.max}</em><small>${fmt(p.value)} / ${fmt(p.need)}</small></div><small class="evhow">${esc(evalHow(p.key))}</small>${p.key === 'harmonies' && hs.length ? hlist(p.need) : ''}`,
    )
    .join('');
  const hist = ev.history
    .slice(-4)
    .reverse()
    .map((h) => `<p><img src="${icon(h.theme)}" alt=""> ${themeName(h.theme)} · ${fmt(h.score)}점 · <b class="g">${tierName(h.tier)}</b></p>`)
    .join('');
  openWin(
    '여관 평가단',
    `<div class="evhd"><img src="${icon(ev.theme, false)}" alt=""><span><b>이번 시즌 · ${themeName(ev.theme)} 부문</b><small>『여행자 안내서』 평가단이 일요일 저녁(게임 속 ${E.tourHour}시 이후)에 와요</small></span></div>
    <p class="sub">지금 ${fmt(score)}점 · <b class="g">${tierName(tierOf(score))}</b>${nx ? ` · 다음 ${tierName(tierOf(nx))}까지 ${fmt(nx - score)}점` : ''}${ev.bonus ? ` · 암행 보너스 +${ev.bonus}` : ''}</p>
    <div class="evrows">${rows}</div>
    <p class="note">브론즈 ${E.tiers[0]} · 실버 ${E.tiers[1]} · 골드 ${E.tiers[2]} · 전설 ${E.tiers[3]} — 첫 브론즈·실버·골드는 평가 현판(장식)을 받아요</p>
    ${hist ? `<p class="sub">지난 평가</p><div class="evhist">${hist}</div>` : ''}`,
  );
  document.querySelectorAll<HTMLElement>('[data-evh]').forEach((b) => (b.onclick = () => openDexHarmony(+b.dataset.evh!)));
}

function showResult(r: EvalResult) {
  sfx((['fail', 'eval_bronze', 'eval_silver', 'eval_gold', 'eval_legend'] as const)[r.tier]);
  void submitEval({ week: r.season, theme: r.theme, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.pts])) });
  const rows = r.parts.map((p) => `<div class="evrow"><span>${p.label}</span><i><b style="width:${Math.round((p.pts / p.max) * 100)}%"></b></i><em>${fmt(p.pts)}/${p.max}</em></div>`).join('');
  const rw = r.reward ? `<p class="good">금화 +${fmt(r.reward.gold)} · 잿빛 가루 +${r.reward.dust} · 증표 조각 +${r.reward.shards}</p>` : '<p class="note">이번엔 등급에 들지 못했어요</p>';
  const pl = r.plaques.length ? `<p class="g">평가 현판을 받았어요! 건설 → 장식에서 마을에 놓을 수 있어요 (${r.plaques.map((k) => def(k as Kind).name).join(', ')})</p>` : '';
  const hint = r.miss.harmony ? `<small class="g">숨은 어울림 힌트가 더 또렷해졌어요 · 도감 → 어울림 #${r.miss.harmony}</small>` : '';
  queueEvent(() =>
    openWin(
      '평가 결과',
      `<div class="evres t${r.tier}"><img src="${icon(r.theme, false)}" alt=""><small>${themeName(r.theme)} 부문</small><b>${tierName(r.tier)}</b><em>${fmt(r.score)}점</em></div>
      <div class="evrows">${rows}</div>
      <div class="evmiss"><img src="${av('assets/emotes/emo_question.png')}" alt=""><span><b>평가단의 한마디</b><small>「${esc(r.miss.text)}」</small>${hint}</span></div>
      ${rw}${pl}${r.title ? `<p class="g">칭호 「${esc(r.title)}」를 얻었어요</p>` : ''}`,
    ),
  );
}

function seasonStart(t: number) {
  addMail({ from: 'system', title: `평가 시즌 시작 · ${themeName(t)} 부문`, body: `이번 주 『여행자 안내서』 평가단은 「${themeName(t)}」 부문을 봅니다. 일요일 저녁에 마을을 찾아와요. ${evalSummary(t)}`, reward: {} });
  const lines: TalkLine[] = [
    ['keeper', `이번 시즌 『여행자 안내서』는 「${themeName(t)}」 부문을 본다더군.`, undefined, '노주인 버나드'],
    ['keeper', '일요일 저녁에 깃 달린 모자를 쓴 평가단이 올 걸세. 어울리는 배치가 점수를 크게 올려 주지.', undefined, '노주인 버나드'],
    ['narr', '임무 카드 아래 평가 바를 누르면 점수 재료를 볼 수 있어요'],
  ];
  queueEvent(() => talk(lines), 'evalSeason');
}

/** 임무 카드 아래 작은 평가 바 */
let barAt = 0;
function updateBar() {
  const b = $('#evalbar');
  const on = evalOpen() && !!P.evaluation.season && S.started;
  b.hidden = !on;
  if (!on) return;
  const sc = evalScore();
  const nx = nextTier(sc);
  const lo = E.tiers.filter((t) => t <= sc).pop() ?? 0;
  const f = nx ? (sc - lo) / (nx - lo) : 1;
  b.innerHTML = `<img src="${icon(P.evaluation.theme)}" alt=""><span>${themeName(P.evaluation.theme)} ${fmt(sc)}${nx ? `<small>/${fmt(nx)} ${tierName(tierOf(nx))}</small>` : ''}</span><i><u style="width:${Math.round(f * 100)}%"></u></i>`;
}

let acc = 0;
export function tickEval(dt: number) {
  stepTour(dt);
  acc += dt;
  if (acc < 0.5) return;
  acc = 0;
  if (S.visiting) return;
  ensureSeason();
  sampleMood();
  if (performance.now() - barAt > 2000) {
    barAt = performance.now();
    updateBar();
  }
  // 마지막 날 저녁: 마을을 보고 있으면 평가단이 들어온다
  if (tourDue() && !tour.on && !isWinOpen() && !isTalking() && !placing.pl && !document.getElementById('hunt') && !document.getElementById('raid')) beginTour();
}

export function beginTour() {
  if (tour.on) return;
  talk([['narr', '깃 달린 모자를 쓴 평가단 세 명이 마을로 들어온다…']], () =>
    startTour(() => {
      const r = judge();
      updateBar();
      showResult(r);
    }),
  );
}

export function initEvalUI() {
  evalHooks.seasonStart = seasonStart;
  evalHooks.result = showResult;
  $('#evalbar').onclick = openEval;
}
