// EASTER: 베타 개척자 4인 — 전용 장식 효과 · 카메오 손님(외형·일정) · 선물 쿠폰 (화면은 ui/easter.ts)
import { CAMEO, CAMEO_GIFT, PIONEERS, type PioneerId } from '../data/story/easter';
import { blankActor } from './adventurers';
import type { ClassDef } from '../data/classes';
import { hourNow } from './clock';
import { markDirty, P, S, world, type Actor, type Building } from './state';

export const PIONEER_IDS = Object.keys(PIONEERS) as PioneerId[];
export const isPioneer = (v: unknown): v is PioneerId => typeof v === 'string' && (PIONEER_IDS as string[]).includes(v);
/** 전용 장식 → 주인 */
export const PIONEER_DECO: Record<string, PioneerId> = Object.fromEntries(PIONEER_IDS.map((id) => [PIONEERS[id].deco, id]));
export const isPioneerDeco = (k: string) => k in PIONEER_DECO;

const homeObjs = (): Building[] => world.home?.objs ?? world.objs;
const has = (k: string) => homeObjs().some((o) => o.kind === k);

/** 바람개비 등대: 의뢰 시간 −3% · 이카몰리 선물 쿠폰(다음 의뢰 −10%) */
export const pioneerExpCut = () => (has('pinwheel_light') ? 0.03 : 0) + (P.meta.easter?.expCoupon ? 0.1 : 0);
/** 의뢰를 보내면 쿠폰은 쓴다 */
export function useExpCoupon() {
  if (P.meta.easter?.expCoupon) {
    P.meta.easter.expCoupon = false;
    markDirty();
  }
}
/** 붉은 무사의 투구: 토벌 금화 +3% */
export const pioneerRaidMult = () => (has('red_helmet') ? 1.03 : 1);
/** 고느끼 선물: 장식 하나 10% 할인 (다음 장식 한 번) */
export const decoCoupon = () => (P.meta.easter?.decoCoupon ? 0.1 : 0);
export function useDecoCoupon() {
  if (P.meta.easter?.decoCoupon) {
    P.meta.easter.decoCoupon = false;
    markDirty();
  }
}

/** 온천 오리상: 근처(3칸) 손님 기분 + · 온천이 2칸 안에 있으면 「쌍둥이 온천」 (더 큰 기분) */
export function duckAura(dt: number) {
  const duck = homeObjs().find((o) => o.kind === 'duck_spa');
  if (!duck || S.visiting) return null;
  const cx = duck.tx + duck.fw / 2;
  const cy = duck.ty + duck.fh / 2;
  const twin = homeObjs().some((o) => o.kind === 'bath' && Math.abs(o.tx + o.fw / 2 - cx) <= o.fw / 2 + duck.fw / 2 + 2 && Math.abs(o.ty + o.fh / 2 - cy) <= o.fh / 2 + duck.fh / 2 + 2);
  const per = (twin ? 2 : 1) * dt * 0.4;
  for (const a of world.actors) if (!a.role && !a.hidden && Math.hypot(a.x - cx, a.y - cy) <= 3) a.mood = Math.min(100, a.mood + per);
  return { duck, twin };
}

// ───────── 카메오 (지나가는 손님) ─────────

/** 손님 생성기로 고정한 외형 (성별·직업·머리색·얼굴) — §2·§5 */
const LOOK: Record<PioneerId, { kind: Actor['kind']; race: Actor['race']; hair: string; face: Actor['face'] }> = {
  woongs: { kind: 'knight', race: 'human', hair: '#2a1e16', face: { eyes: 'happy', mouth: 'grin' } as Actor['face'] },
  gonu: { kind: 'mage', race: 'human', hair: '#6b3a24', face: { eyes: 'sparkle', mouth: 'tiny' } as Actor['face'] },
  warmnight: { kind: 'knight', race: 'human', hair: '#1c1418', face: { eyes: 'calm', mouth: 'flat', brow: 'angry' } as Actor['face'] },
  ikamolly: { kind: 'rogue', race: 'elf', hair: '#e8c070', face: { eyes: 'round', mouth: 'grin', brow: 'up' } as Actor['face'] },
};
/** 마을 도트 소품 (손님 생성기 옷 칸): 웅스 흰 수건 · 고느끼 베레모 + 금빛 붓 · 따뜻한밤 붉은 망토 + 등불 · 이카몰리 바람개비 */
export const CAMEO_DEF: Record<PioneerId, Partial<ClassDef>> = {
  woongs: { hood: '#f4f4f4', cloth: '#e8e2d4', weapon: 'sword' },
  gonu: { hat: 'feather', hatc: '#b03a3a', robe: false, cloth: '#5a7ac8', weapon: 'staff', weaponColor: '#ffd36b' },
  warmnight: { cape: '#b03a2a', cloth: '#3a2a3a', weapon: 'holy', weaponColor: '#ffb04a', shield: false },
  ikamolly: { hood: undefined, cloth: '#4fa8a0', weapon: 'staff', weaponColor: '#ff7a6a', dual: false },
};
export function makeCameo(id: PioneerId, x: number, y: number): Actor {
  const L = LOOK[id];
  const a = blankActor(L.kind, PIONEERS[id].name, x, y);
  Object.assign(a, { id: 0, race: L.race, rarity: 'common', status: 'passer', hair: L.hair, face: L.face, cameo: id, lvl: 30, mood: 100, leaveDay: S.day });
  return a;
}
/** 오늘 들를 개척자 (본인 마을이면 자기 빼고 나머지 셋) */
export function cameoPick(mine: PioneerId | null): PioneerId | null {
  const pool = PIONEER_IDS.filter((x) => x !== mine && !world.actors.some((a) => a.cameo === x));
  return pool.length ? pool[(Math.random() * pool.length) | 0] : null;
}
/** 게임 하루 1~2번: 낮 10~17시에 가끔 · 오늘 몇 번 왔는지 */
export function cameoDue(): boolean {
  const E = (P.meta.easter ??= {});
  if (E.cameoDay !== S.day) Object.assign(E, { cameoDay: S.day, cameoN: 0, cameoPlan: 1 + (Math.random() < 0.5 ? 1 : 0) });
  const h = hourNow();
  return h >= 10 && h < 17 && (E.cameoN ?? 0) < (E.cameoPlan ?? 1) && !world.actors.some((a) => a.cameo);
}
export function noteCameo(id: PioneerId) {
  const E = (P.meta.easter ??= {});
  E.cameoN = (E.cameoN ?? 0) + 1;
  void id;
  markDirty();
}
/** 말을 걸어 만난 개척자 (도감 칸이 밝아진다) */
export function noteMet(id: PioneerId) {
  const E = (P.meta.easter ??= {});
  if ((E.met ?? []).includes(id)) return;
  E.met = [...(E.met ?? []), id];
  markDirty();
}
/** 누를 때마다 다음 대사 · 다 말하면 선물 (그 방문에 한 번) */
export function cameoNext(a: Actor): { line: string; gift?: string } {
  const id = a.cameo as PioneerId;
  const lines = CAMEO[id];
  const i = a.cameoI ?? 0;
  a.cameoI = i + 1;
  if (i < lines.length) return { line: lines[i] };
  if (a.cameoGift) return { line: lines[(i - lines.length) % lines.length] };
  a.cameoGift = true;
  return { line: CAMEO_GIFT[id], gift: id };
}
