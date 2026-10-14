// EASTER: 베타 개척자 4인 — 전용 장식 효과 · 카메오 손님(외형·일정) · 선물 쿠폰 (화면은 ui/easter.ts)
import { CAMEO, CAMEO_GIFT, PIONEER_CREDIT, PIONEER_CREDIT5, PIONEERS, type PioneerId } from '../data/story/easter';
import { blankActor } from './adventurers';
import type { ClassDef } from '../data/classes';
import { hourNow } from './clock';
import { markDirty, P, S, world, type Actor, type Building } from './state';
import { dreamLine, fiveOn, starJoined } from './fivestars';
import { CONFIG } from '../data/config';

export const PIONEER_IDS = Object.keys(PIONEERS) as PioneerId[];
/** 지금 보이는 개척자 (FIVESTARS §5: 다섯 번째 왈왈콩선생은 플래그 fiveStars 켰을 때만 — 끄면 예전 넷 그대로) */
export const pioneerIds = (): PioneerId[] => (fiveOn() ? PIONEER_IDS : PIONEER_IDS.filter((x) => x !== 'walwal'));
export const isPioneer = (v: unknown): v is PioneerId => typeof v === 'string' && (pioneerIds() as string[]).includes(v);
/** 엔딩 크레딧 개척자 줄 (켜면 다섯 이름) */
export const pioneerCredit = () => (fiveOn() ? PIONEER_CREDIT5 : PIONEER_CREDIT);
/** 전용 장식 → 주인 */
export const PIONEER_DECO: Record<string, PioneerId> = Object.fromEntries(PIONEER_IDS.map((id) => [PIONEERS[id].deco, id]));
export const isPioneerDeco = (k: string) => k in PIONEER_DECO;

const homeObjs = (): Building[] => world.home?.objs ?? world.objs;
const has = (k: string) => homeObjs().some((o) => o.kind === k);

/** 바람개비 등대: 의뢰 시간 −3% · 이카몰리 선물 쿠폰(다음 의뢰 −10%) */
export const pioneerExpCut = () => (has('pinwheel_light') ? 0.03 : 0) + (P.meta.easter?.expCoupon ? 0.1 : 0) + bellNightCut() + walwalGiftCut();
/** FIVESTARS §5 왈왈콩선생 선물: 받은 날 밤(그 밤 새벽 4시까지) 출발하는 원정 시간 −10% */
export function walwalGiftCut(): number {
  const d = P.meta.easter?.nightCoupon;
  if (d == null || !fiveOn() || !S.night) return 0;
  return d === S.day || (d === S.day - 1 && hourNow() < 4) ? CONFIG.fiveStars.walwalGiftCut : 0;
}
/** FIVESTARS §5 밤길 방울: 밤에 출발하는 원정 시간 −3% */
export const bellNightCut = () => (S.night && fiveOn() && has('night_bell') ? CONFIG.fiveStars.bellNightCut : 0);
/** 밤길 방울: 근처(3칸) 손님 기분 + (1초마다 · ui/easter) */
export function bellAura(dt: number) {
  if (!fiveOn() || S.visiting) return;
  const b = homeObjs().find((o) => o.kind === 'night_bell');
  if (!b) return;
  for (const a of world.actors) if (!a.role && !a.hidden && Math.hypot(a.x - b.tx - 0.5, a.y - b.ty - 0.5) <= CONFIG.fiveStars.bellNear) a.mood = Math.min(100, a.mood + CONFIG.fiveStars.bellMoodPerSec * dt);
}
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
  gonu: { kind: 'mage', race: 'halfling', hair: '#6b3a24', face: { eyes: 'sparkle', mouth: 'tiny' } as Actor['face'] },
  warmnight: { kind: 'knight', race: 'human', hair: '#1c1418', face: { eyes: 'calm', mouth: 'flat', brow: 'angry' } as Actor['face'] },
  ikamolly: { kind: 'rogue', race: 'human', hair: '#e8c070', face: { eyes: 'round', mouth: 'grin', brow: 'up' } as Actor['face'] },
  // FIVESTARS §5 왈왈콩선생 (임시 외형)
  walwal: { kind: 'cleric', race: 'human', hair: '#6b4a2e', face: { eyes: 'happy', mouth: 'grin', blush: true } as Actor['face'] },
};
/** 마을 도트 소품 (손님 생성기 옷 칸): 웅스 흰 수건 · 고느끼 베레모 + 금빛 붓 · 따뜻한밤 붉은 망토 + 등불 · 이카몰리 바람개비 */
export const CAMEO_DEF: Record<PioneerId, Partial<ClassDef>> = {
  // 웅스: 인간 · 짧은 검은 머리 · 구릿빛 · 흰 도복 + 검은 띠 · 맨발 · 어깨에 흰 수건 · 무기 없음
  woongs: { style: 'short', hair: '#1e1a1a', skin: '#d99a6c', face: { eyes: 'dot', mouth: 'grin', brow: 'up', blush: false }, cloth: '#f2efe8', arm: '#f2efe8', pants: '#f2efe8', accent: '#2a2a2a', boots: '#d99a6c', towel: '#ffffff', weapon: null, shield: false, hood: undefined, helm: undefined, robe: false, cape: undefined, dot2: undefined },
  // 고느끼: 하플링 · 분홍 양갈래 · 반짝 눈 · 볼에 물감 · 청 멜빵바지 + 분홍 셔츠 · 남색 베레모 · 붓(끝 분홍)
  gonu: { style: 'twin', hair: '#ef6f9a', face: { eyes: 'sparkle', mouth: 'o', blush: true, paint: '#e8506a' }, cloth: '#f4a3be', arm: '#f4a3be', pants: '#3f5a8f', apron: '#3f5a8f', accent: '#3f5a8f', boots: '#5a3a2a', hat: 'beret', hatc: '#2a2f55', weapon: 'brush', weaponColor: '#ef6f9a', robe: false, cape: undefined, hood: undefined, elf: false, dwarf: true, beard: undefined, dot2: undefined },
  // 따뜻한밤: 인간 · 갈색 덥수룩 · 감은 눈 + 큰 볼터치 · 붉은 후드 망토 · 갈색 조끼 · 등불
  warmnight: { style: 'short', hair: '#7a3f24', face: { eyes: 'happy', blush: true }, cape: '#c8352e', hood: '#c8352e', cloth: '#5a3a2a', arm: '#5a3a2a', pants: '#4a3428', accent: '#7a5a3a', boots: '#3a2a20', weapon: 'lantern', shield: false, robe: false, helm: undefined, dot2: undefined },
  // 이카몰리: 인간 · 긴 갈색 웨이브 · 동그란 안경 · 크림 코트 · 하늘색 목도리 · 바람개비(빨강·노랑)
  ikamolly: { style: 'long', hair: '#8a4a2e', face: { eyes: 'calm', mouth: 'tiny', glasses: true }, glassesColor: '#c9a46a', cloth: '#f1e6d2', arm: '#f1e6d2', pants: '#d8c8ae', accent: '#c9b48e', boots: '#7a5a3a', towel: '#8fc6e0', weapon: 'pinwheel', weaponColor: '#e8503c', hood: undefined, dual: false, quiver: false, elf: false, robe: false, dot2: undefined },
  // 왈왈콩선생 (§5 · 임시): 흰 셔츠 + 갈색 조끼 · 둥근 얼굴 · 강아지 같은 웃는 눈 · 낚싯대(도트 소품이 아직 없어 빈손 — HERODOT 단계에서)
  walwal: { style: 'short', hair: '#6b4a2e', face: { eyes: 'happy', mouth: 'grin', blush: true }, cloth: '#f4f0e6', arm: '#f4f0e6', pants: '#5a4030', apron: '#8a5a34', accent: '#8a5a34', boots: '#4a3020', weapon: null, shield: false, robe: false, cape: undefined, hood: undefined, helm: undefined, elf: false, dot2: undefined },
};
export function makeCameo(id: PioneerId, x: number, y: number): Actor {
  const L = LOOK[id];
  const a = blankActor(L.kind, PIONEERS[id].name, x, y);
  Object.assign(a, { id: 0, race: L.race, rarity: 'common', status: 'passer', hair: L.hair, face: L.face, cameo: id, lvl: 30, mood: 100, leaveDay: S.day });
  return a;
}
/** 오늘 들를 개척자 (본인 마을이면 자기 빼고 나머지 셋) */
export function cameoPick(mine: PioneerId | null): PioneerId | null {
  // FIVESTARS: 신화로 합류한 개척자는 카메오로 지나가지 않는다
  const pool = pioneerIds().filter((x) => x !== mine && !starJoined(x) && !world.actors.some((a) => a.cameo === x));
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
  // FIVESTARS §1-1: 2막부터 끝에 꿈 한 줄 (복선 · 플래그 fiveStars)
  const dream = dreamLine(id);
  const lines = dream ? [...CAMEO[id], dream] : CAMEO[id];
  const i = a.cameoI ?? 0;
  a.cameoI = i + 1;
  if (i < lines.length) return { line: lines[i] };
  if (a.cameoGift) return { line: lines[(i - lines.length) % lines.length] };
  a.cameoGift = true;
  return { line: CAMEO_GIFT[id], gift: id };
}
