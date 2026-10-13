// v0.25.4 CHECKIN §C4 빨간 점 하나의 규칙 (플래그 redDots · 실험실) — 화면 쪽
//  규칙은 world/redDots.ts dotPlan · 여기선 지금 상태를 모아 버튼에 점(.ndot) 하나씩만 켠다
//  예전(끔): 원정 버튼 아이콘 깜빡임 · 메뉴 점 = 업적+보상 편지 · 건설 버튼 숫자 배지 — 켜면 원정은 점(첫 원정 안내 깜빡임만 남김) · 건설은 숫자 대신 점
//  새 HUD(body.hud2): 「모험」 버튼이 원정 점을 따라 한다 · 소식 띠는 받을 것이 돌 때 점
import { achReady } from '../world/meta';
import { unseenDrops } from '../world/decodrop';
import { dotPlan, mailUnread, ripe, runsDone, smithReady, type DotPlan } from '../world/redDots';
import { P as PG, S } from '../world/state';
import { vis } from '../world/visual';

export const redDotsOn = () => vis('redDots');

function missionReady(): boolean {
  const m = document.getElementById('mission');
  return !!m && !m.hidden && m.classList.contains('done');
}
const goalsReady = () => PG.goals.list.some((g) => g.progress >= g.target && !g.claimed);

/** 지금 점 계획 (마을이 아니거나 이웃 방문 중이면 다 끔) */
export function planNow(): DotPlan {
  const live = S.started && !S.visiting;
  return dotPlan({
    mailUnread: live ? mailUnread() : 0,
    runsDone: live ? runsDone() : 0,
    smithReady: live && smithReady(),
    ripe: live ? ripe() : 0,
    missionReady: live && missionReady(),
    achReady: live ? achReady() : 0,
    goalsReady: live && goalsReady(),
    unseenDeco: live ? unseenDrops().length : 0,
  });
}

/** 버튼에 점 하나 — 클래스(::before)로: 안의 글을 다시 그리는 카드(장부·소식 띠)도 깜빡이지 않게 */
function setDot(el: HTMLElement | null, on: boolean) {
  if (el && el.classList.contains('rdot') !== on) el.classList.toggle('rdot', on);
}

/** HUD 타이머(0.5초)마다: 예전 표시를 덮어쓴다 */
export function applyHudDots() {
  const p = planNow();
  const ex = document.getElementById('bExp');
  // 원정 깜빡임은 첫 원정 안내만 (받을 것은 점)
  ex?.classList.toggle('ready', S.started && !S.visiting && PG.counters.expeditions === 0);
  setDot(ex, p.exp);
  setDot(document.getElementById('bAdv'), p.exp);
  const md = document.querySelector<HTMLElement>('#bMenu2 .ndot');
  if (md && md.hidden === p.menu) md.hidden = !p.menu;
  const nb = document.querySelector<HTMLElement>('#bBuild .nbadge');
  if (nb) nb.hidden = true;
  setDot(document.getElementById('bBuild'), p.build);
  setDot(document.getElementById('mission'), p.mission);
  const band = document.getElementById('newsBand');
  if (band) setDot(band, band.classList.contains('hot'));
}

/** 메뉴 격자 칸 점 (켜졌을 때만 · 끄면 undefined → 예전 그대로) */
export function tileDot(k: keyof DotPlan['tiles']): boolean | undefined {
  if (!redDotsOn()) return undefined;
  return planNow().tiles[k];
}
