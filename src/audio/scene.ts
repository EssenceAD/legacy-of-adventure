// 핫픽스 8 (2-9): 소리·알림 장면 구분 — village / combat / ui
//  전투(사냥·토벌)나 티저가 화면에 있는 동안: 마을 효과음은 울리지 않고, 큰 팡파르는 가장 큰 것 하나만 모아 두었다가
//  마을로 돌아올 때 들려준다. 마을 알림(토스트·띠)도 쌓아 두었다가(최대 3개) 돌아오면 보여 준다.
//  다른 모듈을 거의 불러오지 않는다 (sfx · windows 어디서 불러도 순환이 생기지 않게)

let busyFn: () => boolean = () => false;
/** main이 채운다: 전투 화면 · 티저가 떠 있나 */
export const setBusy = (f: () => boolean) => (busyFn = f);
export const isBusy = () => {
  try {
    return busyFn();
  } catch {
    return false;
  }
};

/** 마을 장면의 소리 (전투 중엔 안 울림) */
export const VILLAGE_SFX = new Set([
  'coin', 'build', 'place_bad', 'levelup', 'harmony', 'mission', 'chapter', 'grade_up', 'event', 'heart', 'night', 'legend', 'record',
  'eval_bronze', 'eval_silver', 'eval_gold', 'eval_legend',
]);
/** 큰 팡파르 순위 — 돌아올 때 가장 큰 것 하나만 */
const BIG: Record<string, number> = { eval_legend: 9, grade_up: 8, eval_gold: 7, chapter: 6, legend: 6, eval_silver: 5, eval_bronze: 4, record: 3, harmony: 2, levelup: 1 };

let pendingSfx: string | null = null;
/** sfx가 부른다: 지금 막을 소리면 true (큰 팡파르는 모아 둔다) */
export function holdSfx(name: string): boolean {
  if (!VILLAGE_SFX.has(name) || !isBusy()) return false;
  const r = BIG[name] ?? 0;
  if (r && r > (BIG[pendingSfx ?? ''] ?? 0)) pendingSfx = name;
  return true;
}

const pendingUi: (() => void)[] = [];
/** 알림(토스트·띠): 전투 중이면 쌓아 두고(최대 3개) true */
export function holdUi(show: () => void): boolean {
  if (!isBusy()) return false;
  pendingUi.push(show);
  if (pendingUi.length > 3) pendingUi.shift();
  return true;
}

let play: (name: string) => void = () => {};
export const setScenePlayer = (f: (name: string) => void) => (play = f);
/** 전투·티저가 끝나 마을로 돌아왔을 때 */
export function flushScene() {
  if (isBusy()) return;
  const s = pendingSfx;
  pendingSfx = null;
  if (s) play(s);
  const list = pendingUi.splice(0);
  list.forEach((f, i) => setTimeout(f, 300 + i * 1800));
}
