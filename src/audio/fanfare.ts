// RAIDWEAPON §0 팡파르 반복 줄이기 (플래그 없이)
//  1. 승리 팡파르는 「의미 있는 승리」에만: 첫 클리어 · 보스 스테이지(손으로) · 토벌 처치 · 심연 보스 층 · 보스 연전 · 월드 레이드
//     반복 사냥 · 자동 사냥 · 접어 둔 판 · 토벌 시간 끝 → 팡파르 없이 작은 coin(0.4)
//  2. 같은 팡파르는 45초에 한 번까지 (그 안이면 coin)
//  3. win = J1 · J6 · J7 돌려 쓰기(직전 것 빼고 무작위) · levelup = J8(없으면 J5 0.6) · chapter = J1
//  다른 모듈을 불러오지 않는다 (sfx · field 어디서 불러도 순환 없게 · 단위 테스트용)

export const WIN_JINGLES = ['J1', 'J6', 'J7'] as const;
export const LEVELUP_JINGLE = 'J8';
export const CHAPTER_JINGLE = 'J1';
/** 같은 팡파르 다시 틀 수 있기까지 (초) */
export const FANFARE_GAP = 45;
/** 팡파르 대신 울리는 coin 음량 */
export const SMALL_WIN_VOL = 0.4;

export interface WinInfo {
  mode: 'hunt' | 'raid';
  /** 처음 깨는 스테이지 (사냥) */
  first: boolean;
  /** 보스 스테이지 (사냥 10) */
  boss: boolean;
  /** 자동 전투를 한 번이라도 썼나 */
  auto: boolean;
  /** 접어 둔 판 */
  folded: boolean;
  /** 토벌: 보스를 쓰러뜨렸나 (아니면 시간 끝) */
  bossDown: boolean;
  /** 부르는 쪽이 정함 (심연: 보스 층만 true · 보스 연전·월드 레이드: true) */
  force?: boolean;
}
/** 이 승리에 팡파르를 틀까 (false면 coin 0.4) */
export function winFanfare(w: WinInfo): boolean {
  if (w.folded) return false;
  if (w.force != null) return w.force;
  if (w.mode === 'raid') return w.bossDown;
  if (w.first) return true;
  return w.boss && !w.auto;
}

export type FanfareKind = 'win' | 'levelup' | 'chapter';
/** 팡파르 고르기 (돌려 쓰기 + 45초 규칙) — null이면 팡파르 대신 coin */
export function makeFanfarePicker(rnd: () => number = Math.random) {
  const lastAt: Record<string, number> = {};
  let prevWin = '';
  const ready = (f: string, now: number) => lastAt[f] == null || now - lastAt[f] >= FANFARE_GAP;
  const take = (f: string, now: number) => ((lastAt[f] = now), f);
  return {
    pick(kind: FanfareKind, now: number): string | null {
      if (kind === 'win') {
        const free = WIN_JINGLES.filter((f) => ready(f, now));
        const pool = free.length > 1 ? free.filter((f) => f !== prevWin) : free;
        if (!pool.length) return null;
        const f = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
        prevWin = f;
        return take(f, now);
      }
      const f = kind === 'levelup' ? LEVELUP_JINGLE : CHAPTER_JINGLE;
      return ready(f, now) ? take(f, now) : null;
    },
    /** 테스트용 */
    reset() {
      for (const k of Object.keys(lastAt)) delete lastAt[k];
      prevWin = '';
    },
  };
}
