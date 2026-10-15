// BUILDINGS2_SPEC (10/16): 땅 6~10 새 건물 7종 효과 — 숫자는 CONFIG.buildings2 한 곳 · 레벨(1~5)마다 배열
//  효과는 「가장 높은 레벨 한 채」 기준 (facilities.fLv) · 플래그 buildings2는 건설 목록만 숨긴다 (지어 둔 건물 효과는 그대로)
//  재료: P.b2 { flour 밀가루 · bread 빵 · bakeAt 마지막으로 구운 때 · kitDay 잡화점 꾸러미 받은 날 · bankDay 이자 받은 날 }
import { CONFIG } from '../data/config';
import { S, P, markDirty } from './state';
import { addCrop, fLv } from './facilities';
import { addMail } from './meta';
import { kstDay } from './goldsink';

const B = CONFIG.buildings2;
/** 레벨 배열에서 그 레벨 값 (없으면 0) */
const at = (arr: readonly number[], lv: number) => (lv <= 0 ? 0 : arr[Math.min(arr.length, lv) - 1]);
export const b2 = () => (P.b2 ??= { flour: 0, bread: 0, bakeAt: 0, kitDay: '', bankDay: '' });

// ───────── 잡화점 ─────────
/** 잡화점 손님 수입 배수 (주점 기본 × 이것) */
export const storeMult = (lv: number) => at(B.store.mult, lv) || B.store.mult[0];
/** 하루 한 번 「잡화점 꾸러미」 — 지금 땅에서 기를 수 있는 작물 3종 2개씩 (먹는 것만) · 받은 것 글자 */
export function dailyStoreKit(today = kstDay()): string | null {
  if (S.visiting || fLv('general_store') <= 0) return null;
  const st = b2();
  if (st.kitDay === today) return null;
  st.kitDay = today;
  const pool = Object.entries(CONFIG.garden.crops).filter(([, c]) => (c.land ?? 1) <= S.land && c.eat !== false);
  const got: string[] = [];
  for (let i = 0; i < B.store.kitN && pool.length; i++) {
    const [id, c] = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    addCrop(id, 2);
    got.push(`${c.name} 2`);
  }
  markDirty();
  return got.length ? got.join(' · ') : null;
}

// ───────── 음유시인 무대 ─────────
/** 밤(18~6시)이고 무대가 있으면 그 레벨 */
export const stageNightLv = () => (S.night ? fLv('bard_stage') : 0);
/** 밤 한 시간마다 마을 손님 기분 + */
export const stageMood = () => at(B.stage.mood, stageNightLv());
/** 케미 발생 배수 (무대가 있으면 늘 · 밤만이 아니라) */
export const stageChem = () => at(B.stage.chem, fLv('bard_stage'));

// ───────── 풍차 방앗간 · 빵집 ─────────
/** 수확물 n개 중 밀가루로 갈 개수 (방앗간 없으면 0 · 소수점은 확률) */
export function millCut(n: number, rnd = Math.random): number {
  const pct = at(B.mill.pct, fLv('grain_mill'));
  if (!pct || n <= 0) return 0;
  const x = n * pct;
  return Math.min(n, Math.floor(x) + (rnd() < x - Math.floor(x) ? 1 : 0));
}
export function addFlour(n: number) {
  if (n <= 0) return;
  b2().flour += n;
  markDirty();
}
export const breadMax = () => at(B.bakery.stockMax, fLv('bakery'));
/** 빵 굽기 (실제 시간 bakeMin분마다 밀가루 1 → 빵 1 · 재고 상한) → 구운 개수 */
export function bake(now = Date.now()): number {
  const lv = fLv('bakery');
  const st = b2();
  if (lv <= 0 || S.visiting) {
    st.bakeAt = now;
    return 0;
  }
  const every = at(B.bakery.bakeMin, lv) * 60000;
  if (!st.bakeAt) st.bakeAt = now;
  const steps = Math.floor((now - st.bakeAt) / every);
  if (steps <= 0) return 0;
  const n = Math.max(0, Math.min(steps, st.flour, breadMax() - st.bread));
  st.flour -= n;
  st.bread += n;
  // 밀가루가 없거나 꽉 찼으면 시계만 앞으로 (밀린 시간을 나중에 몰아서 굽지 않게)
  st.bakeAt = n === steps ? st.bakeAt + steps * every : now;
  if (n) markDirty();
  return n;
}
/** 손님이 묵을 때: 빵이 있으면 하나 먹고 숙박비 배수 (없으면 1) */
export function breadStay(): number {
  const lv = fLv('bakery');
  const st = b2();
  if (lv <= 0 || st.bread <= 0 || S.visiting) return 1;
  st.bread--;
  markDirty();
  return 1 + at(B.bakery.stay, lv);
}

// ───────── 낚시 선착장 ─────────
export const dockReward = () => at(B.dock.reward, fLv('fishing_dock'));
/** 박제 되는 물고기가 걸릴 확률 배수 (없으면 1) */
export const dockTrophy = () => at(B.dock.trophy, fLv('fishing_dock')) || 1;

// ───────── 은행 ─────────
/** 한국 0시가 지나면 이자 한 번 (우편) — 처음 지은 날은 기준만 잡고 다음 날부터 · 받은 금화 */
export function dailyBank(today = kstDay()): number {
  const lv = fLv('bank');
  if (S.visiting || lv <= 0) return 0;
  const st = b2();
  if (st.bankDay === today) return 0;
  const first = !st.bankDay;
  st.bankDay = today;
  markDirty();
  if (first) return 0;
  const gold = Math.min(Math.floor(Math.max(0, S.gold) * at(B.bank.pct, lv)), S.land * at(B.bank.capPerLand, lv));
  if (gold <= 0) return 0;
  addMail({ from: 'system', title: '🏦 은행 이자', body: `어제까지 맡겨 둔 금화에 이자가 붙었어요 (보유 금화의 ${+(at(B.bank.pct, lv) * 100).toFixed(2)}% · 하루 최대 ${(S.land * at(B.bank.capPerLand, lv)).toLocaleString('ko-KR')}G)`, reward: { gold } });
  return gold;
}

// ───────── 마법 학원 ─────────
/** 전투(원정·사냥·토벌) 경험치 배수 더하기 */
export const academyXp = () => at(B.academy.xp, fLv('mage_academy'));

/** 한 시간(게임)마다 · 시작할 때: 꾸러미 · 빵 · 이자 → 알림 글자 */
export function tickB2(): string[] {
  const out: string[] = [];
  const kit = dailyStoreKit();
  if (kit) out.push(`🧺 잡화점 꾸러미: ${kit}`);
  bake();
  const g = dailyBank();
  if (g) out.push(`🏦 은행 이자 ${g.toLocaleString('ko-KR')}G가 우편함에 왔어요`);
  return out;
}
