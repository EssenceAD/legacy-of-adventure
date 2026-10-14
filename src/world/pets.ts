// LUXE §2 펫 「동물 친구」 — 규칙만 (플래그 pets · 실험실 vis): 활동마다 시도 · 확률 + 천장 · 만남 · 꺼내 두기 · 쓰다듬기 · 작은 효과
//  다른 모듈(사냥·낚시·텃밭·대장간·원정·토벌·심연·공방·주점·별똥별)이 부르는 작은 함수들 — 순환 import 없게 state·visual·숫자만 본다
//  화면은 ui/pets.ts (petHooks로 받는다) · 마을 그리기는 world/petsDraw.ts
//  끄면: 시도·효과 전부 멈춤(효과 0 · 배수 1) · 만난 펫·게이지는 저장에 그대로
import { PETS, type PetDef, type PetSrc } from '../data/luxe_cfg';
import { track } from '../net/telemetry';
import { kstDate } from './guestbook';
import { freshPets, markDirty, P, S, uiHooks, type PetState } from './state';
import { vis } from './visual';

export const PET_IDS = PETS.defs.map((d) => d.id);
export const petDef = (id: string): PetDef | undefined => PETS.defs.find((d) => d.id === id);
const BY_SRC = new Map<PetSrc, PetDef>(PETS.defs.map((d) => [d.src, d]));
/** 그 활동에서 나오는 펫 */
export const petOfSrc = (src: PetSrc) => BY_SRC.get(src);

/** 켜졌나: 플래그(모두) 또는 실험실(이 기기) */
export const petsOn = (): boolean => vis('pets');

/** 화면 쪽 통로 (ui/pets.ts가 채운다): 만남(반짝 + 카드) · 50% 힌트 한 줄 */
export const petHooks = {
  got: (_id: string, _src: PetSrc | 'bundle') => {},
  hint: (_id: string) => {},
};

/** 저장 칸 바로잡기 (옛 저장 · 망가진 값) — 같은 객체면 한 번만 (불러오기·초기화로 객체가 바뀌면 다시) */
let checked: unknown = null;
export function petState(): PetState {
  if (P.pets && P.pets === checked) return P.pets;
  const d = freshPets();
  const cur = P.pets as unknown;
  const f = (cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : (P.pets = d)) as PetState;
  const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  for (const k of Object.keys(d) as (keyof PetState)[]) {
    const v = f[k] as unknown;
    const bad = Array.isArray(d[k]) ? !Array.isArray(v) : !isObj(v);
    if (bad) (f as Record<string, unknown>)[k] = d[k];
  }
  for (const [k, v] of Object.entries(f.got)) {
    if (!petDef(k) || !isObj(v)) {
      delete f.got[k];
      continue;
    }
    if (typeof v.name !== 'string' || !v.name.trim()) v.name = petDef(k)!.name;
    if (!Number.isFinite(v.at)) v.at = 0;
  }
  for (const [k, v] of Object.entries(f.tries)) if (!petDef(k) || f.got[k] || typeof v !== 'number' || !Number.isFinite(v) || v < 0) delete f.tries[k];
  for (const [k, v] of Object.entries(f.pat)) if (!petDef(k) || typeof v !== 'string') delete f.pat[k];
  const uniq = (a: unknown[], ok: (x: string) => boolean) => a.filter((x, i): x is string => typeof x === 'string' && ok(x) && a.indexOf(x) === i);
  f.out = uniq(f.out, (x) => !!f.got[x]).slice(0, PETS.outMax);
  f.card = uniq(f.card, (x) => !!f.got[x]);
  f.hint = uniq(f.hint, (x) => !!petDef(x));
  P.pets = f;
  checked = f;
  return f;
}

// ───────── 만나기 ─────────

export const hasPet = (id: string) => !!petState().got[id];
export const petCount = () => Object.keys(petState().got).length;
/** 천장 게이지 (0~1 · 화면에는 숨김) */
export const petGauge = (id: string) => {
  const d = petDef(id);
  return d ? Math.min(1, (petState().tries[id] ?? 0) / d.pity) : 0;
};
/** 그 펫 이름 (지은 이름 · 없으면 기본 이름) */
export const petName = (id: string) => petState().got[id]?.name || petDef(id)?.name || id;

/**
 * 활동 1회 = 시도 1 (그 활동의 펫을 아직 못 만났을 때만)
 *  · rng() < p 이거나 시도 수가 천장(= 2배)에 닿으면 만남 → 펫 id
 *  · 게이지가 hintAt(50%)을 넘으면 힌트 한 줄 1번 (petHooks.hint)
 *  · 꺼짐 · 이웃 방문 중 · 이미 만남 → 아무것도 안 함 (null)
 */
export function petTry(src: PetSrc, rng: () => number = Math.random): string | null {
  if (!petsOn() || S.visiting) return null;
  const d = BY_SRC.get(src);
  if (!d) return null;
  const st = petState();
  if (st.got[d.id]) return null;
  const n = (st.tries[d.id] ?? 0) + 1;
  st.tries[d.id] = n;
  markDirty();
  if (rng() < d.p || n >= d.pity) {
    grantPet(d.id, src);
    return d.id;
  }
  if (n / d.pity > PETS.hintAt && !st.hint.includes(d.id)) {
    st.hint.push(d.id);
    petHooks.hint(d.id);
  }
  return null;
}

/** 펫을 준다 (1번만 · 이미 있으면 false): 이름 = 기본 이름 · 자리가 있으면 바로 마을로 · 카드 대기 · [소문] 한 줄 */
export function grantPet(id: string, how: PetSrc | 'bundle' = 'bundle'): boolean {
  const d = petDef(id);
  if (!d) return false;
  const st = petState();
  if (st.got[id]) return false;
  st.got[id] = { name: d.name, at: Date.now() };
  delete st.tries[id];
  if (st.out.length < PETS.outMax) st.out.push(id);
  if (!st.card.includes(id)) st.card.push(id);
  // 「○○ 여관에 아기 수달이 찾아왔대」 (이름이 이미 「…여관」이면 한 번만)
  const inn = (S.innName || '').trim();
  const where = !inn ? '어느 여관' : /여관$/.test(inn) ? inn : `${inn} 여관`;
  uiHooks.rumor(`${where}에 ${d.name}${josaIGa(d.name)} 찾아왔대`);
  track('pet_get', { id, how, n: petCount() });
  markDirty();
  petHooks.got(id, how);
  return true;
}
/** 받침에 따라 「이/가」 */
function josaIGa(w: string): string {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '가';
  return (c - 0xac00) % 28 ? '이' : '가';
}

/** LUXE §3 마을 회관 「주방」 완성: petGrant('dog') → 배부른 강아지 1번 (이미 만났으면 표시만) */
export function checkBundlePet(): string | null {
  if (!petsOn() || S.visiting) return null;
  const b = P.bundles as { petGrant?: string; petGiven?: boolean } | undefined;
  if (!b || !b.petGrant || b.petGiven) return null;
  b.petGiven = true;
  markDirty();
  const id = PETS.bundlePet;
  return grantPet(id, 'bundle') ? id : null;
}

/** 카드를 봤다 (이름 짓기 · 「마을에 데려가기」) — 이름이 비면 기본 이름 · 자리가 있으면 마을로 */
export function closeCard(id: string, name?: string): 'out' | 'home' | null {
  const st = petState();
  if (!st.got[id]) return null;
  st.card = st.card.filter((x) => x !== id);
  if (name != null) renamePet(id, name);
  if (!st.out.includes(id) && st.out.length < PETS.outMax) st.out.push(id);
  markDirty();
  return st.out.includes(id) ? 'out' : 'home';
}

// ───────── 마을 · 펫 집 ─────────

export const petsOut = (): string[] => (petsOn() ? petState().out.slice() : []);
export const isOut = (id: string) => petState().out.includes(id);
/** 마을로 꺼내기 (3마리 넘으면 이유) */
export function petOut(id: string): string | null {
  const st = petState();
  if (!st.got[id]) return '아직 못 만난 친구예요';
  if (st.out.includes(id)) return null;
  if (st.out.length >= PETS.outMax) return `마을엔 ${PETS.outMax}마리까지 데려갈 수 있어요`;
  st.out.push(id);
  markDirty();
  return null;
}
/** 펫 집으로 (효과도 꺼짐) */
export function petHome(id: string) {
  const st = petState();
  st.out = st.out.filter((x) => x !== id);
  markDirty();
}
/** 이름 바꾸기 (앞뒤 공백 · 8자 · 비면 기본 이름) */
export function renamePet(id: string, name: string): string {
  const st = petState();
  const g = st.got[id];
  if (!g) return '';
  g.name = name.replace(/\s+/g, ' ').trim().slice(0, 8) || petDef(id)!.name;
  markDirty();
  return g.name;
}
/** 오늘(한국 날짜) 쓰다듬었나 */
export const pattedToday = (id: string, now = Date.now()) => petState().pat[id] === kstDate(now);
/** 쓰다듬기: 하루 1번 · 그날 그 펫 효과 ×2 (꺼내 둔 펫만) */
export function patPet(id: string, now = Date.now()): string | null {
  const st = petState();
  if (!st.got[id]) return '아직 못 만난 친구예요';
  if (pattedToday(id, now)) return '오늘은 벌써 쓰다듬었어요';
  st.pat[id] = kstDate(now);
  track('pet_pat', { id });
  markDirty();
  return null;
}

// ───────── 효과 (꺼내 둔 3마리만 · 쓰다듬은 날 ×2 · 꺼지면 0) ─────────

/** 효과 배수: 0 = 없음 · 1 · 쓰다듬은 날 2 */
export function petFx(id: string, now = Date.now()): number {
  if (!petsOn() || S.visiting) return 0;
  const st = petState();
  if (!st.got[id] || !st.out.includes(id)) return 0;
  return pattedToday(id, now) ? PETS.patMult : 1;
}
const fxv = (id: string) => (petDef(id)?.fx ?? 0) * petFx(id);
/** 아기 너구리: 사냥 금화 배수 */
export const petHuntGold = () => 1 + fxv('raccoon');
/** 아기 수달: 낚시 판정 창 +초 */
export const petFishWin = () => fxv('otter');
/** 꼬마 두더지: 수확 +1 (확률) */
export const petHarvestPlus = (rng: () => number = Math.random) => (fxv('mole') > 0 && rng() < fxv('mole') ? 1 : 0);
/** 불도마뱀: 강화·초월 가루 −2% (반올림 · 최소 1) */
export const petEnhDust = (cost: number) => (fxv('salamander') > 0 && cost > 0 ? Math.max(1, Math.round(cost * (1 - fxv('salamander')))) : cost);
/** 아기 그리핀: 원정 시간 줄이기 (비율) */
export const petExpCut = () => fxv('griffin');
/** 꼬마 텐구: 토벌 피해 배수 */
export const petRaidDmg = () => 1 + fxv('tengu');
/** 별고양이: 심연 피해(전투력) 배수 */
export const petAbyssDmg = () => 1 + fxv('starcat');
/** 물약 슬라임: 재료 1개 덜 (확률) */
export const petBrewSave = (rng: () => number = Math.random) => fxv('slime') > 0 && rng() < fxv('slime');
/** 배부른 강아지: 식사한 손님 기분 + */
export const petMealMood = () => fxv('puppy');
/** 별여우: 별똥별을 잡아도 그날 잡은 수로 안 센다 (확률) */
export const petStarKeep = (rng: () => number = Math.random) => fxv('starfox') > 0 && rng() < fxv('starfox');

// ───────── 도감 · 명품관 ─────────

/** 10마리 다 만났나 (켜졌을 때만) — §1 명품관 「펫 놀이터」(2×2 장식) 해금 */
export const petPlaygroundUnlocked = (): boolean => petsOn() && PET_IDS.every((id) => !!petState().got[id]);
/** 이웃 방문 모습에 실을 펫 id (꺼내 둔 것 · 최대 3) */
export const petSnapshot = (): string[] => petsOut().slice(0, PETS.outMax);
/** 이웃 모습에서 온 펫 id 정리 (아는 id · 겹침 없이 · 3개) */
export function cleanPetIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x, i): x is string => typeof x === 'string' && !!petDef(x) && v.indexOf(x) === i).slice(0, PETS.outMax);
}
