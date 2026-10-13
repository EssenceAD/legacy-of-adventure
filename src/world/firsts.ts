// WAYFIND §1: 처음 해 보기 — 조건이 열렸는데 현실 2일 동안 안 써 본 기능 → 어울리는 인물 머리 위 「!」
//  하루 한 명 · 「나중에」 = 3일 뒤 다시 · 처음 써 보면 그 인물 한 줄 + 작은 보상 · 다 채우면 칭호 「구석구석 아는 주인」
import { CONFIG } from '../data/config';
import { diaryDoneCount, diaryKey, diaryList } from './diary';
import { fLv } from './facilities';
import { flag } from './flags';
import { kstDay } from './goldsink';
import { feature, townGrade } from './guide';
import { markDirty, P, S, world } from './state';
import { wfState } from './wayfind';

export type FirstGo = 'pond' | 'build' | 'guests' | 'smith' | 'alchemy' | 'chapel' | 'raid' | 'village' | 'decor' | 'photo' | 'diary' | 'favors';
export interface FirstDef {
  id: string;
  name: string;
  /** 대사 화자 (초상화 키) · 이름표 · 마을에서 머리 위에 「!」를 띄울 사람 (영웅·전설 id / 'npc' 모모 / 'keeper' 버나드) */
  who: string;
  tag: string;
  host: string;
  can: () => boolean;
  /** 저장 상태로 「써 봤다」 (옛 저장 채우기 · 매초 확인) */
  used: () => boolean;
  lines: () => [string, string][];
  react: [string, string][];
  /** 처음 보상 (주고 나서 보여 줄 글) */
  reward: () => string;
  rewardText: string;
  go: () => FirstGo;
  /** v0.23.2 GOLDSINK에 새로 생긴 기능 — 옛 저장도 「막 열림」으로 (2일 기다림) */
  fresh?: boolean;
}

const DAY_MS = 86400000;
const hit = (id: string) => wfState().hit.includes(id);
const objs = () => world.home?.objs ?? world.objs;
const homeActors = () => world.home?.actors ?? world.actors;
const has = (k: string) => objs().some((o) => o.kind === k && o.build === undefined);
const pond = () => has('lily_pond') || has('koi_pond');
const regs = () => homeActors().filter((a) => !a.role && a.status === 'regular');
const giftN = () => Object.values(P.gifts).reduce((s, n) => s + Math.max(0, n), 0);
const gs = () => (P.gs ?? { cnt: {}, weekN: 0 }) as { cnt: Record<string, number>; weekN: number };
const shards = (n: number) => {
  P.hunt.shards += n;
  while (P.hunt.shards >= CONFIG.hunt.shardsPerToken) {
    P.hunt.shards -= CONFIG.hunt.shardsPerToken;
    P.tokens++;
  }
};
const deco = (k: string) => (P.meta.giftDeco[k] = (P.meta.giftDeco[k] ?? 0) + 1);

export const FIRSTS: FirstDef[] = [
  {
    id: 'fish', name: '낚시', who: 'hero_twins', tag: '렌·린', host: 'twins',
    can: () => pond() || S.land >= 5,
    used: () => Object.keys(P.growth.fish.rec ?? {}).length > 0 || (P.growth.fish.trophies ?? 0) > 0,
    lines: () =>
      pond()
        ? [['hero_twins', '린: 사장님 연못에 물고기 있는 거 알아요? 렌: 우리가 봤어! 엄청 커!']]
        : [['hero_twins', '린: 사장님, 마을에 연못 하나 파면 물고기가 온대요! 렌: 우리가 제일 먼저 낚을 거야!']],
    react: [['hero_twins', '린: 잡았다!! 렌: 내가 먼저 봤는데…']],
    reward: () => ((P.growth.fish.extra += 5), '미끼 +5'),
    rewardText: '미끼 5',
    go: () => (pond() ? 'pond' : 'build'),
  },
  {
    id: 'gift', name: '단골에게 선물', who: 'post', tag: '모모', host: 'npc',
    can: () => !!P.owner && regs().length > 0 && giftN() > 0,
    used: () => Object.keys(P.growth.guestGift ?? {}).length > 0 || P.growth.hints.some((h) => h.startsWith('guestknow:')) || hit('gift'),
    lines: () => [['post', '사장님, 단골손님들도 선물 받으면 엄청 좋아해요! 좋아하는 걸 주면 그날 케미도 쑥쑥 올라요~']],
    react: [['post', '봐요봐요, 얼굴이 환해졌잖아요! 다음엔 뭘 좋아하는지 맞혀 봐요~']],
    reward: () => (shards(3), '증표 조각 +3'),
    rewardText: '인연의 증표 조각 3',
    go: () => 'guests',
  },
  {
    id: 'enhance', name: '장비 강화 (+1)', who: 'hero_brok', tag: '브로크', host: 'brok',
    can: () => fLv('smith') > 0,
    used: () => P.counters.enhanceMax > 0,
    lines: () => [['hero_brok', '도끼날이 무디면 나무도 안 베여. 사장님 손님들 무기도 한번 갈아 보지?']],
    react: [['hero_brok', '그래, 그 소리야! 쇠가 노래를 하잖아.']],
    reward: () => ((P.growth.whet += 1), '행운의 숫돌 +1'),
    rewardText: '행운의 숫돌 1',
    go: () => 'smith',
  },
  {
    id: 'whet', name: '숫돌 만들기', who: 'legend_jin', tag: '진', host: 'jin',
    can: () => fLv('smith') > 0 && P.dust.n >= CONFIG.growth.whet.ash,
    used: () => P.growth.whet > 0 || hit('whet'),
    lines: () => [['legend_jin', '잿빛 가루가 그만큼 쌓였으면 숫돌 하나 깎아 둬. 강화가 한 번 덜 미끄러질 거야.']],
    react: [['legend_jin', '잘 깎였네. 쓴 가루는 내가 채워 둘게.']],
    reward: () => ((P.dust.n += CONFIG.growth.whet.ash), `잿빛 가루 +${CONFIG.growth.whet.ash}`),
    rewardText: `잿빛 가루 ${CONFIG.growth.whet.ash} (돌려줌)`,
    go: () => 'smith',
  },
  {
    id: 'reforge', name: '재련', who: 'legend_jin', tag: '진', host: 'jin',
    can: () => fLv('smith') >= 3 && P.bag.some((it) => it.grade !== 'n'),
    used: () => hit('reforge'),
    lines: () => [['legend_jin', '옵션이 마음에 안 들면 재련해 봐. 쇠는 몇 번이고 다시 태어나.']],
    react: [['legend_jin', '봐, 같은 칼인데 눈빛이 달라졌지?']],
    reward: () => ((P.dust.r += 10), '푸른(희귀) 가루 +10'),
    rewardText: '희귀 가루 ×10',
    go: () => 'smith',
  },
  {
    id: 'convert', fresh: true, name: '연금술 변환', who: 'hero_morga', tag: '모르가', host: 'morga',
    can: () => flag('goldsinkConvert') && fLv('alchemy') > 0,
    used: () => (gs().cnt?.conv ?? 0) > 0 || hit('convert'),
    lines: () => [['hero_morga', '금화는 무겁기만 하지. 내 공방에 오면 쓸모 있는 걸로 바꿔 줄게.']],
    react: [['hero_morga', '킬킬, 첫 손님이니까 이번 값은 돌려줄게. 단골 되면 좋고.']],
    reward: () => {
      const v = Math.max(0, Math.round(wfState().pay.convert ?? 0));
      S.gold += v;
      return `금화 +${v.toLocaleString('ko-KR')} (돌려받음)`;
    },
    rewardText: '첫 구매 값 돌려줌',
    go: () => 'alchemy',
  },
  {
    id: 'bless', fresh: true, name: '예배당 축복', who: 'legend_aria', tag: '아리아', host: 'aria',
    can: () => flag('goldsinkBless') && fLv('chapel') > 0,
    used: () => (gs().cnt?.bless ?? 0) > 0,
    lines: () => [['legend_aria', '먼 길 떠나는 분들께 축복을 빌어 드리고 싶어요. 예배당에 들러 주실래요?']],
    react: [['legend_aria', '빛이 오래 머물도록 조금 더 기도해 둘게요.']],
    reward: () => {
      if (P.gs) P.gs.blessUntil = Math.max(Date.now(), P.gs.blessUntil) + 30 * 60000;
      return '축복 30분 연장';
    },
    rewardText: '첫 축복 30분 무료 연장',
    go: () => 'chapel',
  },
  {
    id: 'raid', name: '주간 토벌', who: 'hero_oswin', tag: '오스윈', host: 'oswin',
    can: () => feature('raid'),
    used: () => P.counters.raidTries > 0,
    lines: () => [['hero_oswin', '이번 주 토벌 소식 들었나? 늙은 기사도 피가 끓는군.']],
    react: [['hero_oswin', '허허! 좋은 싸움이었네. 다음 주에도 부르게.']],
    reward: () => (shards(3), '증표 조각 +3'),
    rewardText: '증표 조각 3',
    go: () => 'raid',
  },
  {
    id: 'neighbor', name: '이웃 마을 구경·좋아요', who: 'post', tag: '모모', host: 'npc',
    can: () => townGrade() >= 1,
    used: () => (gs().cnt?.likes ?? 0) > 0 || hit('neighbor'),
    lines: () => [['post', '사장님, 이웃 마을 구경 가 봤어요? 마음에 들면 좋아요도 꾹 눌러 주고요~']],
    react: [['post', '다른 여관 구경 재밌죠? 거기서 본 장식 하나 얻어 왔어요!']],
    reward: () => (deco('birdhouse'), '장식 「새집」 1 (건설 → 선물 장식)'),
    rewardText: '꾸미기 장식 1',
    go: () => 'village',
  },
  {
    id: 'decor', name: '꾸미기 · 길 칠하기', who: 'keeper', tag: '버나드', host: 'keeper',
    can: () => S.land >= 3,
    used: () => Object.keys(P.decor.paint ?? {}).length > 0 || (P.decor.recent ?? []).length > 0 || hit('decor'),
    lines: () => [['keeper', '땅이 넓어졌으니 길도 깔고 장식도 옮겨 보게. 손님들 발길이 달라질 걸세.']],
    react: [['keeper', '허허, 여관이 한결 사람 사는 곳 같군. 화분 하나 보태지.']],
    reward: () => (deco('tulip_box'), '꽃 화분 1 (건설 → 선물 장식)'),
    rewardText: '꽃 화분 1',
    go: () => 'decor',
  },
  {
    id: 'photo', name: '사진 모드', who: 'keeper', tag: '버나드', host: 'keeper',
    can: () => townGrade() >= 1,
    used: () => P.counters.photos > 0 || hit('photo'),
    lines: () => [['keeper', '이만큼 키운 마을, 한 장 남겨 두지 않겠나? 나중에 보면 다 추억이라네.']],
    react: [['keeper', '좋은 사진이군. 내 젊을 적 여관보다 낫네.']],
    reward: () => {
      if (!P.titles.includes('첫 사진')) P.titles.push('첫 사진');
      return '칭호 「첫 사진」';
    },
    rewardText: '칭호 「첫 사진」',
    go: () => 'photo',
  },
  {
    id: 'diary', name: '단골 일기 읽기', who: 'hero_seril', tag: '세릴', host: 'seril',
    can: () => diaryList().length > 0,
    used: () => hit('diary') || diaryDoneCount().done > 0,
    lines: () => [['hero_seril', '손님들이 일기를 쓰고 있대요. 도감에 모아 두셨던데… 한 장만 읽어 볼래요?']],
    react: [['hero_seril', '다 읽으셨어요? 그 손님, 오늘 기분이 좋아 보이더라고요.']],
    reward: () => {
      // 읽은 일기의 단골 (직업_종족) 기분 +10 · 못 찾으면 가장 기분이 낮은 단골
      const k = wfState().diaryKey;
      const rs = regs();
      const a = rs.find((x) => diaryKey(x) === k) ?? rs.slice().sort((p, q) => p.mood - q.mood)[0];
      if (!a) return '';
      a.mood = Math.min(100, a.mood + 10);
      return `${a.name} 기분 +10`;
    },
    rewardText: '기분 +10 (그 단골)',
    go: () => 'diary',
  },
  {
    id: 'favors', fresh: true, name: '마을 부탁', who: 'post', tag: '모모', host: 'npc',
    can: () => flag('villageFavors') && !!P.owner && townGrade() >= 1,
    used: () => (gs().weekN ?? 0) > 0 || hit('favors'),
    lines: () => [['post', '마을 사람들이 부탁을 맡겨 놨어요! 게시판 「마을 부탁」 탭에 있어요~']],
    react: [['post', '부탁 해결! 다음 부탁이 마음에 안 들면 한 번은 공짜로 바꿔 드릴게요~']],
    reward: () => {
      if (P.gs) P.gs.swaps -= 1;
      return '부탁 바꾸기 1회 무료 (오늘)';
    },
    rewardText: '부탁 바꾸기 1회 무료',
    go: () => 'favors',
  },
];
export const firstDef = (id: string) => FIRSTS.find((f) => f.id === id);
const safe = (fn: () => boolean) => {
  try {
    return fn();
  } catch {
    return false;
  }
};

/**
 * 옛 기록으로 done을 채운다 (처음 한 번) · 이미 열려 있던 기능은 「2일 전에 열린」 것으로 (게임 5일차부터)
 *  다 깬 사람(심연의 바닥 x-10)은 옛 기능으로 귀찮게 하지 않는다 — 새 기능(fresh)만 2일 뒤에
 */
export function seedFirsts(now = Date.now()) {
  const w = wfState();
  if (w.seeded) return;
  w.seeded = true;
  const veteran = (P.hunt.best.deep ?? 0) >= CONFIG.hunt.stages;
  for (const f of FIRSTS) {
    if (safe(f.used)) {
      if (!w.done.includes(f.id)) w.done.push(f.id);
    } else if (veteran && !f.fresh) w.later[f.id] = now + 3650 * DAY_MS;
    else if (safe(f.can) && S.day >= 5 && !f.fresh) w.avail[f.id] = now - 2 * DAY_MS;
  }
  markDirty();
}

/** 매초: 새로 열린 기능 시각 · 처음 써 본 기능 → done + 보상 (반응 줄은 pend에) */
export function checkFirsts(now = Date.now()): string[] {
  const w = wfState();
  if (!w.seeded) seedFirsts(now);
  const fresh: string[] = [];
  for (const f of FIRSTS) {
    if (w.done.includes(f.id)) continue;
    if (safe(f.used)) {
      w.done.push(f.id);
      delete w.later[f.id];
      if (w.today === f.id) w.today = '#';
      let got = '';
      try {
        got = f.reward();
      } catch {
        /* 보상 실패는 넘어간다 */
      }
      w.pend.push(`${f.id}|${got}`);
      fresh.push(f.id);
      markDirty();
    } else if (!w.avail[f.id] && safe(f.can)) {
      w.avail[f.id] = now;
      markDirty();
    }
  }
  if (!w.title && FIRSTS.every((f) => w.done.includes(f.id))) {
    w.title = true;
    if (!P.titles.includes('구석구석 아는 주인')) P.titles.push('구석구석 아는 주인');
    w.pend.push('all|칭호 「구석구석 아는 주인」');
    markDirty();
  }
  return fresh;
}

/** 다음 후보 (표 순서 · 열린 지 2일 · 「나중에」 3일) */
export function pickFirst(now = Date.now()): FirstDef | null {
  const w = wfState();
  for (const f of FIRSTS) {
    if (w.done.includes(f.id)) continue;
    const at = w.avail[f.id];
    if (!at || now - at < 2 * DAY_MS) continue;
    if ((w.later[f.id] ?? 0) > now) continue;
    if (!safe(f.can)) continue;
    return f;
  }
  return null;
}
/** 지금 「!」를 띄울 기능 (하루 한 명) — 없으면 null */
export function bubbleFirst(now = Date.now()): FirstDef | null {
  const w = wfState();
  if (w.day === kstDay(now)) return w.today && w.today !== '#' && !w.done.includes(w.today) ? firstDef(w.today) ?? null : null;
  return pickFirst(now);
}
/** 「!」를 실제로 띄웠다 (오늘 몫) */
export function noteBubble(id: string, now = Date.now()) {
  const w = wfState();
  w.day = kstDay(now);
  w.today = id;
  markDirty();
}
/** 말풍선을 눌렀다 (later = 「나중에」 → 3일 뒤) */
export function answerBubble(id: string, later: boolean, now = Date.now()) {
  const w = wfState();
  w.today = '#';
  w.day = kstDay(now);
  if (later) w.later[id] = now + 3 * DAY_MS;
  markDirty();
}
/** 처음 해 보기 목록 (안내서 탭 · 오늘 해 볼 만한 것) */
export function firstsStatus(): { f: FirstDef; st: 'done' | 'open' | 'lock' }[] {
  const w = wfState();
  return FIRSTS.map((f) => ({ f, st: w.done.includes(f.id) ? 'done' : safe(f.can) ? 'open' : 'lock' }));
}
