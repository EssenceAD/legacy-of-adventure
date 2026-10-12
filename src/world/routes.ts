// STORY v2·v3: 갈림길 루트 4개(용사·사랑·전설·마을) + 진 엔딩 「별지기」 — 목표 판정 · 루트 사건 · 엔딩 컷 글자·화자 채우기
//  대사·목표 글은 data/story/v2.ts · v3.ts 그대로 (고치지 않음). 은퇴 루트는 world/story.ts의 retireGoals 그대로
import { CONFIG } from '../data/config';
import { LEGENDS } from '../data/legends';
import { ROUTES, type RouteId, type SLine } from '../data/story/v1';
import { ROUTE_HERO, ROUTE_LOVE } from '../data/story/v2';
import { ROUTE_LEGEND, ROUTE_TOWN, ROUTE_TRUE, TRUE_PICK } from '../data/story/v3';
import { track } from '../net/telemetry';
import { townGrade } from './guide';
import { legendsJoined } from './legends';
import { markDirty, P, S, world, type Actor } from './state';
import { favActor, retireGoals, storyDay, type Goal } from './story';
import { bestOf } from './town';

// v2·v3 데이터를 갈림길에 붙인다 (진 엔딩은 조건을 채운 회차에만 열린다)
Object.assign(ROUTES.hero, { open: true, goals: ROUTE_HERO.goals, pickLines: ROUTE_HERO.pickLines });
Object.assign(ROUTES.love, { open: true, goals: ROUTE_LOVE.goals, pickLines: ROUTE_LOVE.pickLines });
Object.assign(ROUTES.legend, { open: true, goals: ROUTE_LEGEND.goals, pickLines: ROUTE_LEGEND.pickLines });
Object.assign(ROUTES.town, { open: true, goals: ROUTE_TOWN.goals, pickLines: ROUTE_TOWN.pickLines });
Object.assign(ROUTES.true, { goals: ROUTE_TRUE.goals, pickLines: TRUE_PICK });
// REGIONS2 §0: 지역 10이 들어가면서 목표 조정 — 용사 「심연의 바닥 x-9 돌파」 · 진 엔딩 「심연의 바닥 x-10 (열쇠 지참)」
//  (대사 파일은 그대로 두고 여기서 제목만 바꾼다 · 이미 이룬 목표는 이룬 그대로 — goalSeen)
export const GOAL_TITLE_R2: Record<string, string> = { h_abyss: '심연의 바닥 x-9 돌파', x_abyss: '심연의 바닥 x-10 (열쇠 지참)' };
ROUTES.hero.goals = ROUTES.hero.goals!.map((g) => (GOAL_TITLE_R2[g.id] ? { ...g, title: GOAL_TITLE_R2[g.id] } : g));
ROUTES.true.goals = ROUTES.true.goals!.map((g) => (GOAL_TITLE_R2[g.id] ? { ...g, title: GOAL_TITLE_R2[g.id] } : g));

const R = () => CONFIG.story.routes;
const st = () => P.story;
const flag = (k: string) => !!st().flags?.[k];
export function setFlag(k: string) {
  (st().flags ??= {})[k] = Date.now();
  markDirty();
}
const homeActors = (): Actor[] => world.home?.actors ?? world.actors;
const regulars = () => homeActors().filter((a) => !a.role && a.id && (a.status === 'regular' || a.status === 'hero'));

// ───────── 진 엔딩 조건 ─────────

export const STORY_FIVE: RouteId[] = ['hero', 'legend', 'town', 'love', 'retire'];
export const endsSeen = () => STORY_FIVE.filter((r) => P.legacy.album.includes('story_' + r)).length;
/** 엔딩 5종을 다 봤고 열쇠 조각이 5개 이상 */
export const trueReady = () => endsSeen() >= 5 && (P.legacy.shards ?? []).length >= R().trueShards;

// ───────── 루트를 고를 때 기준값 ─────────

export function onPickRoute(id: RouteId) {
  const s = st();
  s.base = { meals: P.counters.tavernMeals ?? 0, photos: P.counters.photos ?? 0, day: S.day };
  s.flags = {};
  // 용사: 다락의 옛 장비 (주인 장비) — 가방에 하나 넣어 준다
  if (id === 'hero') routeHooks.atticGear();
  markDirty();
}
/** ui·game이 채운다 (아이템 만들기 · 화면) */
export const routeHooks = { atticGear: () => {}, atticItem: (): { enh: number } | null => null };

// ───────── 목표 판정 ─────────

const mk = (id: string, title: string, cur: number, need: number, text?: string): Goal => ({ id, title, cur: Math.min(cur, need), need, done: cur >= need, text: text ?? `${Math.min(cur, need)}/${need}` });
/** REGIONS2 §0: 이번 회차에 이미 이룬 목표(완료 줄을 본 것)는 조건이 바뀌어도 이룬 그대로 */
const goalSeen = (id: string) => st().seen.includes('goal:' + id);
const kept = (g: Goal): Goal => (g.done || !goalSeen(g.id) ? g : { ...g, cur: g.need, done: true, text: '완료' });
const goalTitle = (route: RouteId, i: number) => ROUTES[route].goals![i].title;

/** 짝 (케미 단계 높은 순) — 사랑 루트의 @a / @b */
export function topPair(): [Actor, Actor] | null {
  const regs = regulars();
  let best: { lv: number; a: Actor; b: Actor } | null = null;
  for (const [k, b] of Object.entries(P.bonds)) {
    const [x, y] = k.split('-').map(Number);
    const a1 = regs.find((r) => r.id === x);
    const a2 = regs.find((r) => r.id === y);
    if (!a1 || !a2) continue;
    if (!best || b.lv > best.lv) best = { lv: b.lv, a: a1, b: a2 };
  }
  return best ? [best.a, best.b] : null;
}
const maxChem = () => Math.max(0, ...Object.values(P.bonds).map((b) => b.lv));
const legendTie5 = () => LEGENDS.filter((l) => (P.ties[l.key]?.stage ?? 0) >= 5).length;
const mealsSince = () => (P.counters.tavernMeals ?? 0) - (st().base?.meals ?? 0);

export function routeGoals(route: RouteId): Goal[] {
  if (route === 'retire') return retireGoals();
  const t = (i: number) => goalTitle(route, i);
  if (route === 'hero') {
    const it = routeHooks.atticItem();
    return [
      mk('h_gear', t(0), it?.enh ?? 0, 5, it ? `+${it.enh}/+5 · 대장간에서 「다락의 옛 칼」을 강화해요` : '다락의 옛 칼'),
      kept(mk('h_abyss', t(1), P.hunt.best.deep ?? 0, 9, `심연의 바닥 ${Math.min(9, P.hunt.best.deep ?? 0)}/9`)),
      mk('h_party', t(2), maxChem(), 4, `가장 깊은 케미 ${maxChem()}/4단계`),
      mk('h_final', t(3), flag('final') ? 1 : 0, 1, flag('final') ? '완료' : '앞의 목표를 마치면 최종 토벌'),
    ];
  }
  if (route === 'love') {
    const arch = P.harmony.found.includes(R().loveHarmony);
    return [
      mk('l_pairs', t(0), (P.chem5 ?? []).length, 3),
      mk('l_arch', t(1), arch ? 1 : 0, 1, arch ? '완료' : '장미 아치 · 장미 벤치 · 꽃밭을 가까이'),
      mk('l_ask', t(2), flag('confess') ? 1 : 0, 1, flag('confess') ? '완료' : '앞의 둘을 마치면 고백'),
      mk('l_wed', t(3), flag('wed') ? 1 : 0, 1, flag('wed') ? '완료' : `요리 ${Math.min(mealsSince(), R().wedMeals)}/${R().wedMeals} · 금화 ${R().wedGold.toLocaleString('ko-KR')}`),
    ];
  }
  if (route === 'legend') {
    const tav = bestOf('tavern')?.lvl ?? 0;
    return [
      mk('g_count', t(0), legendsJoined(), R().legendCount),
      mk('g_ties', t(1), legendTie5(), 3),
      mk('g_hall', t(2), tav >= 8 && mealsSince() >= R().feastMeals ? 1 : 0, 1, `주점 Lv.${tav}/8 · 연회 요리 ${Math.min(mealsSince(), R().feastMeals)}/${R().feastMeals}`),
      mk('g_feast', t(3), flag('feast') ? 1 : 0, 1, flag('feast') ? '완료' : '앞의 셋을 마치면 연회'),
    ];
  }
  if (route === 'town') {
    const photos = (P.counters.photos ?? 0) - (st().flags?.visitPhotos ?? Infinity);
    return [
      mk('t_grade', t(0), townGrade(), 4, `마을 등급 ${townGrade()}/4`),
      mk('t_harmony', t(1), P.harmony.found.length, 5),
      mk('t_eval', t(2), P.evaluation.best, 3, `평가단 최고 등급 ${P.evaluation.best}/3 (골드)`),
      mk('t_photo', t(3), flag('photo') || photos > 0 ? 1 : 0, 1, flag('visit') ? '사진 모드로 마을 전경 한 장' : '앞의 셋을 마치면 편집장이 찾아와요'),
    ];
  }
  // true
  const shards = (P.legacy.shards ?? []).length;
  const inn = bestOf('inn')?.lvl ?? 0;
  return [
    mk('x_shards', t(0), shards, R().trueShards),
    mk('x_room', t(1), inn, 10, `본관 Lv.${inn}/10`),
    kept(mk('x_abyss', t(2), P.hunt.best.deep ?? 0, 10, `심연의 바닥 ${Math.min(10, P.hunt.best.deep ?? 0)}/10`)),
    mk('x_night', t(3), flag('night') ? 1 : 0, 1, flag('night') ? '완료' : '밤에 「불 켜 두기」'),
  ];
}
/** 마지막 목표를 빼고 다 했나 (마지막은 사건 버튼) */
export const routePreDone = (r: RouteId) => routeGoals(r).slice(0, 3).every((g) => g.done);
export const routeDone = (r: RouteId) => routeGoals(r).every((g) => g.done);

/** 1초마다: 목표 완료 줄 · 마을 루트 편집장 방문 차례 */
export function routeTick(): SLine[] | null {
  const s = st();
  const r = s.route as RouteId | null;
  if (!r || r === 'retire' || s.heir >= 2) return null;
  const goals = routeGoals(r);
  for (const g of goals) {
    const k = 'goal:' + g.id;
    if (g.done && !s.seen.includes(k)) {
      s.seen.push(k);
      markDirty();
      track('route_goal', { route: r, goal: g.id, day: storyDay() });
      const d = ROUTES[r].goals!.find((x) => x.id === g.id)?.done;
      if (d) return [['narr', `갈림길 · ${g.title} ✓`], ['narr', d]];
    }
  }
  // 사진 목표: 편집장이 다녀간 뒤 찍은 사진
  if (r === 'town' && flag('visit') && !flag('photo') && (P.counters.photos ?? 0) > (s.flags?.visitPhotos ?? Infinity)) setFlag('photo');
  return null;
}

// ───────── 엔딩 컷: 글자·화자 채우기 ─────────

const nameOf = (a: Actor | null | undefined, d: string) => a?.name ?? d;
/** 인연이 깊은 전설 (조인한 전설 · 인연 점수 높은 순) */
export function topLegends(n: number) {
  return LEGENDS.filter((l) => P.legends[l.key]?.st === 'joined')
    .sort((a, b) => (P.ties[b.key]?.pts ?? 0) - (P.ties[a.key]?.pts ?? 0))
    .slice(0, n);
}
export interface CutCtx {
  vars: Record<string, string>;
  who: Record<string, string>;
}
export function cutCtx(route: RouteId): CutCtx {
  const vars: Record<string, string> = {};
  const who: Record<string, string> = {};
  if (route === 'love') {
    const p = topPair();
    vars.a = nameOf(p?.[0], '두 사람');
    vars.b = nameOf(p?.[1], '단골');
    if (p) {
      who['@a'] = '@' + p[0].id;
      who['@b'] = '@' + p[1].id;
    }
  }
  if (route === 'legend') {
    const ls = topLegends(3);
    ls.forEach((l, i) => {
      vars['L' + (i + 1)] = l.name;
      who['@L' + (i + 1)] = 'legend_' + l.key;
    });
    vars.legendCount = String(legendsJoined());
  }
  return { vars, who };
}
const fillVars = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
/** 컷 줄 → 화자·글자 채운 줄 · {pillar} 한 줄은 전설마다 여러 줄로 · {catchSpeaker} 부케 */
export function expandCut(route: RouteId, src: SLine[], extra: Record<string, string> = {}): SLine[] {
  const c = cutCtx(route);
  const v = { ...c.vars, ...extra };
  const out: SLine[] = [];
  for (const [who0, text, o] of src) {
    if (who0 === '{pillar}') {
      for (const l of topLegends(5)) {
        const p = ROUTE_LEGEND.pillar[l.key];
        if (p) out.push([p[0], fillVars(p[1], v), p[2]]);
      }
      continue;
    }
    let who = c.who[who0] ?? who0;
    if (who0 === '{catchSpeaker}') who = extra.catchSpeaker ?? 'post';
    // 짝·전설이 없으면 그 줄은 이야기꾼이
    if (/^@(a|b|L\d)$/.test(who)) who = 'narr';
    out.push([who, fillVars(text, v), o]);
  }
  return out;
}

/** 사랑 루트: 부케 받는 사람 (회차마다 무작위 · 이미 본 사람은 피해서 · 다 보면 처음부터) */
export function pickBouquet(): { who: string; name: string; line: string } {
  const all = ROUTE_LOVE.bouquet;
  const seen = (P.legacy.bouquetSeen ??= []);
  let left = all.filter((b) => !seen.includes(b.who));
  if (!left.length) {
    seen.length = 0;
    left = all.slice();
  }
  const b = left[Math.floor(Math.random() * left.length)];
  seen.push(b.who);
  markDirty();
  return b;
}
export { favActor, regulars };
