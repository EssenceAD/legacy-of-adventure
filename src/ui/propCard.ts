// HOTFIX16 §1: 단골 제안 대화 위 「손님 카드」 — 희귀도·Lv·전투력·단골 중 순위·능력치·역할·케미 · [자세히] · 자리가 꽉 차면 [○○ 대신 받기](확인 한 번 더)
import { CLASSES, RACE_NAME, RARITY_INFO, type ClassKey } from '../data/classes';
import { STAT_NAME } from '../data/items';
import { josa } from '../data/josa';
import { getPref, setPref } from '../save/save';
import { proposeUi } from '../world/actors';
import { baseStats, powerOf } from '../world/adventurers';
import { pairOf } from '../world/chem';
import { roleOf } from '../world/party';
import { P, world, type Actor, type TalkChoice, type TalkLine } from '../world/state';
import { esc, fmt, portrait } from './common';
import { talk } from './dialogue';
import { showActor } from './guests';
import { closeWin, isWinOpen, openWin } from './windows';

/** 설정: 자세히(일반 등급만 작게) · 간단히(모두 작게) */
export type PropCardMode = 'full' | 'simple';
export const propCardMode = (): PropCardMode => (getPref<string>('propCard', 'full') === 'simple' ? 'simple' : 'full');
export const setPropCardMode = (m: PropCardMode) => setPref('propCard', m);
export const PROP_CARD_NAME: Record<PropCardMode, string> = { full: '자세히', simple: '간단히' };

const ROLE_NAME = { tank: '탱', heal: '힐', dps: '딜' } as const;
const regulars = () => world.actors.filter((x) => !x.role && x.id && !x.leaving && (x.status === 'regular' || x.status === 'hero'));

export function cardHtml(a: Actor, compact: boolean): string {
  const rar = RARITY_INFO[a.rarity];
  const p = powerOf(a);
  const regs = regulars().filter((x) => x !== a);
  const pows = regs.map((x) => powerOf(x));
  const rank = pows.filter((v) => v > p).length + 1;
  const weakest = pows.length ? Math.min(...pows) : 0;
  const diff = p - weakest;
  const head = `<div class="pc1"><img src="${portrait(a)}" alt=""><span><b>${esc(a.name)}</b><small>${esc(CLASSES[a.kind as ClassKey]?.name ?? '')} · ${RACE_NAME[a.race]}</small></span><i class="rar" style="--rc:${rar.color}">${rar.name}</i><em>Lv.${a.lvl}</em></div>`;
  const pow = `<div class="pc2"><b class="pw">${fmt(p)}</b><small>전투력${regs.length ? ` · 단골 중 ${rank}위` : ''}</small>${regs.length ? `<small class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? `▲ 최약 단골보다 +${fmt(diff)}` : `▼ 최약 단골보다 ${fmt(diff)}`}</small>` : ''}</div>`;
  if (compact) return head + pow;
  const st = baseStats(a);
  const max = Math.max(1, ...Object.values(st));
  const bars = (Object.keys(st) as (keyof typeof st)[]).map((k) => `<span class="sb"><small>${STAT_NAME[k]}</small><i><u style="width:${Math.round((st[k] / max) * 100)}%"></u></i><b>${st[k]}</b></span>`).join('');
  const role = roleOf(a);
  const missing = regs.length > 0 && !regs.some((x) => roleOf(x) === role);
  const chem = regs
    .map((x) => ({ x, pair: pairOf(a, x) }))
    .filter((c) => c.pair && (c.pair.open || P.dex.chem.includes(c.pair.id)))
    .slice(0, 2);
  return `${head}${pow}<div class="pc3">${bars}</div><div class="pc4"><i class="role">${ROLE_NAME[role]}</i>${missing ? '<small class="up">✨ 파티에 없는 역할</small>' : ''}</div>${chem.length ? `<div class="pc5">${chem.map((c) => `<small>${esc(c.x.name)}${josa(c.x.name, "와")} 잘 맞아요 ♥</small>`).join('')}</div>` : ''}`;
}

let cardEl: HTMLDivElement | null = null;
function showCard(a: Actor) {
  hideCard();
  const compact = propCardMode() === 'simple' || a.rarity === 'common';
  cardEl = document.createElement('div');
  cardEl.id = 'propCard';
  cardEl.className = 'px' + (compact ? ' compact' : '');
  cardEl.innerHTML = cardHtml(a, compact);
  document.getElementById('view')!.appendChild(cardEl);
  place();
}
/** 선택지(또는 대화창) 바로 위에 — 선택지 버튼을 가리지 않게 */
function place() {
  if (!cardEl) return;
  const view = document.getElementById('view')!.getBoundingClientRect();
  const ch = document.getElementById('dChoice');
  const box = document.querySelector('#dlg .box') ?? document.getElementById('dlg');
  const anchor = ch && !ch.hidden && ch.offsetParent ? ch : box;
  const top = anchor ? anchor.getBoundingClientRect().top : view.bottom - 250;
  cardEl.style.bottom = Math.max(8, Math.round(view.bottom - top + 8)) + 'px';
  requestAnimationFrame(place);
}
function hideCard() {
  cardEl?.remove();
  cardEl = null;
}

/** 창이 닫힐 때까지 기다렸다가 */
function afterWin(fn: () => void) {
  const iv = setInterval(() => {
    if (isWinOpen()) return;
    clearInterval(iv);
    fn();
  }, 200);
}

export function initPropCard() {
  proposeUi.show = (a: Actor, lines: TalkLine[], choices: TalkChoice[], again: () => void, swap?: { weak: Actor; ok: () => void }) => {
    showCard(a);
    const cs: TalkChoice[] = choices.map((c, i) =>
      i === 0 && swap
        ? {
            label: c.label,
            fn: () => {
              hideCard();
              openWin(
                '단골 바꾸기',
                `<p class="sub">${esc(swap.weak.name)} 대신 ${esc(a.name)}${josa(a.name, '을')} 단골로 받을까요?</p><p class="note">${esc(swap.weak.name)}${josa(swap.weak.name, '는')} 대기 명단으로 가요. 자리가 나면 다시 찾아와요.</p>
                <div class="btnrow"><button class="bigbtn" id="psOk">바꾸기</button><button class="bigbtn ghost" id="psNo">취소</button></div>`,
              );
              let done = false;
              document.getElementById('psOk')!.onclick = () => {
                done = true;
                closeWin();
                swap.ok();
              };
              document.getElementById('psNo')!.onclick = () => closeWin();
              afterWin(() => !done && again());
            },
          }
        : { label: c.label, fn: () => (hideCard(), c.fn()) },
    );
    // [자세히]: 손님 상세 창 → 닫으면 제안 대화로 (선택 그대로)
    cs.splice(cs.length - 1, 0, {
      label: '자세히',
      fn: () => {
        hideCard();
        showActor(a);
        afterWin(again);
      },
    });
    talk(lines, hideCard, cs);
  };
}
