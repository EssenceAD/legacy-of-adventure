// RAIDWEAPON §2 전용 무기 — 끼우는 조건 · 처음 낄 때 깨어남 (items.ts equip이 부른다 · 순환 없게 state·데이터만 본다)
//  조건: 플래그 exWeapons(또는 실험실) · 그 영웅(전설 legendId · 다섯 별 starId)만 · ★5 (CONFIG.raidWeapon.ex.needStars)
//  ★5 전에도 가방에 들고 있을 수는 있다 (「★5가 되면 깨어나요」)
import { CONFIG } from '../data/config';
import { exDef, exShort, type ExWeaponDef } from '../data/exweapons';
import { isStarId, STARS } from '../data/fivestars';
import { josa } from '../data/josa';
import { legendByKey } from '../data/legends';
import { exOn, rwState } from './frags';
import { markDirty, uiHooks, type Actor, type Item } from './state';

const X = () => CONFIG.raidWeapon.ex;

/** 이 손님이 전용 무기를 가질 수 있는 영웅이면 그 키 (전설 → legendId · 다섯 별 → starId) */
export const exOwnerKey = (a: Pick<Actor, 'legendId' | 'starId'> | null | undefined): string | undefined =>
  a ? (a.legendId && exDef(a.legendId) ? a.legendId : isStarId(a.starId) ? a.starId : undefined) : undefined;
/** 무기 주인 이름 */
export function exOwnerName(d: ExWeaponDef): string {
  return d.owner === 'star' && isStarId(d.id) ? STARS[d.id].name : (legendByKey(d.id)?.name ?? d.id);
}
/** 그 영웅 색 (깨어나는 빛기둥) — 다섯 별 = 궤적 색 · 전설 = 머리색 */
export function exHeroColor(id: string): string {
  if (isStarId(id)) return STARS[id].trail;
  return legendByKey(id)?.hair ?? X().legendColor;
}

/** 못 끼는 까닭 ('' = 낄 수 있음) — 전용 무기가 아니면 늘 '' */
export function exWhy(a: Pick<Actor, 'legendId' | 'starId' | 'stars'>, it: Pick<Item, 'ex'>): string {
  if (!it.ex) return '';
  const d = exDef(it.ex);
  if (!d) return '알 수 없는 전용 무기예요';
  if (!exOn()) return '전용 무기가 아직 잠들어 있어요';
  if (exOwnerKey(a) !== d.id) return `${exOwnerName(d)}만 낄 수 있어요`;
  if ((a.stars ?? 1) < X().needStars) return `★${X().needStars}가 되면 깨어나요`;
  return '';
}
export const exCanWear = (a: Pick<Actor, 'legendId' | 'starId' | 'stars'>, it: Pick<Item, 'ex'>): boolean => !exWhy(a, it);

/** 화면 쪽 통로 (ui/exWeapons.ts가 채운다): 깨어나는 컷 */
export const exHooks = {
  cut: (_a: Actor, _it: Item, _color: string, _text: string) => {},
};

/** 「★ 웅스의 양손 대검이 깨어났습니다!」 */
export function exAwakeText(a: Pick<Actor, 'name'>, d: ExWeaponDef): string {
  const w = exShort(d);
  return `★ ${a.name}의 ${w}${josa(w, '이')} 깨어났습니다!`;
}

/** 끼운 직후 (equip): 그 영웅이 처음이면 알림 + 컷 (1번만) */
export function exAwaken(a: Actor, it: Item): boolean {
  if (!it.ex || !exOn()) return false;
  const d = exDef(it.ex);
  const st = rwState();
  if (!d || st.awoke.includes(d.id)) return false;
  st.awoke.push(d.id);
  markDirty();
  const text = exAwakeText(a, d);
  uiHooks.announce(text);
  exHooks.cut(a, it, exHeroColor(d.id), text);
  return true;
}

/** ★5 알림 (legends.ts starUpLegend) — 켜졌으면 「유산 무기가 깨어날 준비가 됐어요」 · 꺼졌으면 null (예전 문구) */
export const exReadyText = (a: Pick<Actor, 'name'>): string | null => (exOn() ? `★ ${a.name}의 유산 무기가 깨어날 준비가 됐어요` : null);

/** 전투·마을 무기 색: 켜졌으면 전용 무기를 낀 ★5만 (다섯 별 = 궤적 색 · 전설 = 금빛) — undefined = 이 규칙 해당 없음 */
export function exWeaponColor(a: Pick<Actor, 'legendId' | 'starId' | 'stars'>, weapon: Pick<Item, 'ex'> | undefined): string | undefined {
  if (!weapon?.ex || exWhy(a, weapon)) return undefined;
  return isStarId(a.starId) && !a.legendId ? STARS[a.starId].trail : X().legendColor;
}
