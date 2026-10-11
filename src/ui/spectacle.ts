// 베타 4장: 구경거리 사건 해결 — 탭하면 짧은 대사 + 고르기 → 결과 · [소문] 한 줄 · 해결 횟수(업적)
import { CONFIG } from '../data/config';
import { GIFT_KEYS, GIFTS, type GiftKey } from '../data/bonds';
import { REGIONS } from '../data/items';
import { arrive } from '../world/actors';
import { addBond } from '../world/chem';
import { floatW, puff } from '../world/fx';
import { addRep } from '../world/progress';
import { SHOP_FIXED, SHOP_POOL } from '../world/meta';
import { gotGold, markDirty, P, pick, S, uiHooks, world, type TalkChoice, type TalkLine } from '../world/state';
import { removeSpectacle, spawn, spectacleAt, spectacles, tickSpectacle, type SpecKind, type Spectacle } from '../world/spectacle';
import { tour } from '../world/evalTour';
import { placing } from '../world/town';
import { sx, sy } from '../engine/iso';
import { isTalking, speakerOf, talk } from './dialogue';
import { esc, fmt } from './common';
import { closeWin, isWinOpen, openWin, toast } from './windows';

const SP = CONFIG.spectacle;
const inn = () => S.innName || '어느 여관';
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

function solved(s: Spectacle, rumor?: string) {
  removeSpectacle(s);
  P.counters.eventsSolved = (P.counters.eventsSolved ?? 0) + 1;
  if (rumor) uiHooks.rumor(rumor);
  markDirty();
}
const ask = (lines: TalkLine[], choices: TalkChoice[]) => talk(lines, undefined, choices);

const SLEEPY = [
  '음냐… 맥주 한 통만 더… 아니 두 통…',
  '으응? 내가 언제 잠들었지? 이 벤치, 침대보다 편한데!',
  '드르렁… 망치… 내 망치는 어디…',
  '깨우지 마… 꿈속에서 금광을 찾았단 말이야…',
];

export function resolve(s: Spectacle) {
  const [a, b] = s.actors;
  switch (s.kind) {
    case 'quarrel':
      return ask([[speakerOf(a), `${b.name}, 그 자리 내가 먼저 맡았거든?`], [speakerOf(b), '무슨 소리! 내가 먼저 앉았다고!']], [
        { label: '말린다', fn: () => {
          for (const x of s.actors) x.mood = Math.min(100, x.mood + SP.calmMood);
          addRep(1);
          floatW(a.x, a.y, 40, '화해!', 'heart');
          solved(s, `${inn()} 주인이 손님 다툼을 말렸대`);
        } },
        { label: '구경한다', fn: () => solved(s) },
      ]);
    case 'thief':
      return ask([['narr', '그림자 같은 손님이 슬금슬금 좌판 쪽으로 손을 뻗는다…']], [
        { label: '붙잡는다', fn: () => {
          const g = SP.thiefGold * (world.objs.some((o) => o.kind === 'stall') ? 2 : 1);
          S.gold += g;
          gotGold(g);
          const n = s.npcs[0];
          floatW(n.x, n.y, 40, `+${g} 회수!`, 'big');
          solved(s, `${inn()}에서 좀도둑이 잡혔대`);
        } },
        { label: '못 본 척', fn: () => solved(s) },
      ]);
    case 'confess':
      return ask([[speakerOf(a), `${b.name}… 사실 처음 본 날부터…`], ['narr', `${b.name}의 얼굴이 빨개졌다.`]], [
        { label: '응원한다', fn: () => {
          const ok = addBond(a, b, 10);
          for (const x of s.actors) {
            x.mood = Math.min(100, x.mood + 10);
            x.moodSum += 10;
          }
          floatW(a.x, a.y, 40, ok ? '♥ 친밀도 UP' : '♥', 'heart');
          solved(s, `${inn()}에서 고백이 있었대!`);
        } },
        { label: '모른 척', fn: () => solved(s) },
      ]);
    case 'merchant':
      return openMerchant(s);
    case 'bard':
      return ask([['narr', '모닥불 곁에서 음유시인이 류트를 튕긴다. ♪']], [
        { label: `팁 주기 (${SP.bardTip}G)`, fn: () => {
          if (S.gold < SP.bardTip) return toast('금화가 모자라요');
          S.gold -= SP.bardTip;
          const f = s.near!;
          for (const g of world.actors) if (!g.role && g.id && !g.hidden && Math.hypot(g.x - f.tx, g.y - f.ty) < 4) g.mood = Math.min(100, g.mood + SP.bardMood);
          floatW(f.tx, f.ty, 50, '♪ 앵콜!', 'heart');
          solved(s, `${inn()} 모닥불 공연이 끝내줬대`);
        } },
        { label: '그냥 듣는다', fn: () => solved(s) },
      ]);
    case 'lost':
      return ask([['narr', '울먹이는 아이가 두리번거린다. 「엄마가 안 보여요…」']], [
        { label: '집을 찾아 준다', fn: () => {
          addRep(2);
          const n = s.npcs[0];
          floatW(n.x, n.y, 40, '고마워요!', 'heart');
          solved(s, `${inn()} 주인이 길 잃은 아이를 데려다줬대`);
        } },
        { label: '나중에', fn: () => {} },
      ]);
    case 'sleepy':
      return ask([['narr', `${a.name}이(가) 벤치에 곯아떨어져 코를 곤다.`]], [
        { label: '깨운다', fn: () => {
          talk([[speakerOf(a), pick(SLEEPY)]]);
          a.mood = Math.min(100, a.mood + 5);
          solved(s, `${inn()}에서 드워프가 또 곯아떨어졌대`);
        } },
        { label: '그냥 둔다', fn: () => {} },
      ]);
    case 'sparkle': {
      const reg = REGIONS.filter((r) => (P.hunt.best[r.id] ?? 0) > 0).pop() ?? REGIONS[0];
      const m = rnd(SP.sparkle.mats[0], SP.sparkle.mats[1]);
      const d = rnd(SP.sparkle.dust[0], SP.sparkle.dust[1]);
      P.mats[reg.id] += m;
      P.dust.n += d;
      const [x, y] = s.tile!;
      for (let i = 0; i < 12; i++) puff(sx(x + 0.5, y + 0.5), sy(x + 0.5, y + 0.5), '#ffd36b', (Math.random() - 0.5) * 30, -20 - Math.random() * 10, 0.8, 2);
      floatW(x + 0.5, y + 0.5, 40, `${reg.mat} +${m} · 가루 +${d}`, 'big');
      solved(s, `${inn()} 마당에서 반짝이는 게 나왔대`);
      return;
    }
    case 'group':
      return ask([['narr', '여행자 무리가 입구에서 웅성거린다. 「방 있나요? 우리 네 명인데!」']], [
        { label: '한꺼번에 받는다', fn: () => {
          let n = 0;
          for (let i = 0; i < 3 + (Math.random() < 0.5 ? 1 : 0); i++) if (arrive()) n++;
          toast(n ? `손님 ${n}명이 들어왔어요` : '방이 모자라 다들 지나가는 손님으로 갔어요');
          solved(s, `${inn()}에 손님 무리가 몰렸대`);
        } },
        { label: '다음에', fn: () => solved(s) },
      ]);
    case 'secret': {
      const gift = GIFT_KEYS.find((g) => (P.gifts[g] ?? 0) > 0) as GiftKey | undefined;
      return ask([['narr', '깃 달린 모자를 푹 눌러쓴 손님이 수첩에 뭔가를 적고 있다…']], [
        { label: gift ? `말 걸고 ${GIFTS[gift].name} 선물` : '말 걸고 금화 100으로 대접', fn: () => {
          if (gift) P.gifts[gift]! -= 1;
          else if (S.gold >= 100) S.gold -= 100;
          else return toast('대접할 선물이나 금화가 없어요');
          P.evaluation.bonus += CONFIG.evaluation.secretBonus;
          P.evaluation.secretDone = true;
          talk([['narr', '손님이 모자를 살짝 들어 보인다. 「…좋은 여관이군요. 기억해 두죠.」'], ['narr', `평가 점수 +${CONFIG.evaluation.secretBonus} (암행 평가단이었어요!)`]]);
          solved(s, `${inn()}에 수상한 모자 손님이 다녀갔대`);
        } },
        { label: '그냥 둔다', fn: () => {} },
      ]);
    }
  }
}

/** 떠돌이 상인: 희귀 재료 · 선물 · 씨앗 3칸 (3시간 동안) */
const merchantGoods = new WeakMap<Spectacle, string[]>();
function openMerchant(s: Spectacle) {
  let ids = merchantGoods.get(s);
  if (!ids) {
    const mats = SHOP_POOL.filter((x) => x.id.startsWith('mat_') && (!x.can || x.can()));
    const gifts = SHOP_POOL.filter((x) => x.id.startsWith('gift_'));
    ids = [pick(mats.length ? mats : SHOP_POOL).id, pick(gifts).id, SHOP_FIXED[0].id];
    merchantGoods.set(s, ids);
  }
  const all = [...SHOP_POOL, ...SHOP_FIXED];
  const goods = ids.map((id) => all.find((x) => x.id === id)!).filter(Boolean);
  openWin(
    '떠돌이 상인',
    `<p class="sub">「먼 길 왔수다! 오늘만 이 값이오.」 · 금화 <b class="g">${fmt(S.gold)}</b></p><div class="alist">${goods
      .map((g) => `<div class="arow shopi"><img src="assets/icons/${g.icon}.png" alt=""><span><b>${esc(g.name)}</b><small>${esc(g.desc)}</small></span><button data-g="${g.id}" ${S.gold < g.cost ? 'disabled' : ''}>${fmt(g.cost)}G</button></div>`)
      .join('')}</div><p class="note">상인은 게임 속 3시간 뒤 떠나요</p>`,
  );
  document.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((b) => (b.onclick = () => {
    const g = goods.find((x) => x.id === b.dataset.g)!;
    if (S.gold < g.cost) return toast('금화가 모자라요');
    S.gold -= g.cost;
    g.give();
    ids!.splice(ids!.indexOf(g.id), 1);
    toast(`${g.name} 구매!`);
    if (!ids!.length) {
      closeWin();
      solved(s, `${inn()}에 떠돌이 상인이 왔다 갔대`);
    } else openMerchant(s);
    markDirty();
  }));
}

/** 마을 탭: 사건이면 해결 창 (main) */
export function tapSpectacle(mx: number, my: number): boolean {
  const s = spectacleAt(mx, my);
  if (!s) return false;
  resolve(s);
  return true;
}

let acc = 0;
export function tickSpectacles(dt: number) {
  acc += dt;
  if (acc < 0.5) return;
  acc = 0;
  const viewing = !isWinOpen() && !isTalking() && !placing.pl && !tour.on && !$('#hunt') && !$('#raid');
  tickSpectacle(viewing);
}

/** 개발용: 사건 강제 발생 */
export const forceSpectacle = (k: SpecKind) => spawn(k);
export { spectacles };
