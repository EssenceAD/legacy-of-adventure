// FIRSTLOOK §5 오른쪽 버튼 줄 줄이기 (플래그 flSideRail · 실험실 vis) — 새 HUD(body.hud2)에서만
//  늘 보이는 것: 배율(#bZoom ×1) + 「⋯」(#bRail) · 「⋯」를 누르면 낮밤·어울림·소리·구경(👁)이 그 아래로 펼쳐진다
//  버튼은 원래 요소 그대로(id·onclick·점) — 접힌 동안 CSS(body.flrail:not(.railopen))가 숨기기만 한다
//  바깥을 누르거나 안의 것을 하나 고르면 접힘 · 안의 항목에 빨간 점이 있으면 「⋯」에 점 (redDots 와 같은 .rdot)
//  끄면(플래그·실험실 둘 다 아님 또는 예전 HUD) 아무것도 만들지 않는다 → 예전 다섯 버튼 그대로
import { CONFIG } from "../data/config";
import { vis } from "../world/visual";

const R = () => CONFIG.firstLook.rail;
export const sideRailOn = (): boolean =>
  vis("flSideRail") && document.body.classList.contains("hud2");

/** 접히는 버튼들 (지금 DOM에 있는 것만 · 설정 순서) */
export function railItems(): HTMLElement[] {
  return R()
    .items.map((id) => document.getElementById(id))
    .filter((e): e is HTMLElement => !!e);
}

/** 이 버튼에 빨간 점이 있나: .rdot(빨간 점 규칙) 또는 숨기지 않은 .dot/.ndot 자식 */
export function hasDot(el: Element): boolean {
  if (el.classList.contains("rdot")) return true;
  return [...el.querySelectorAll<HTMLElement>(".dot,.ndot")].some(
    (d) => !d.hidden,
  );
}
/** 「⋯」에 점 = 안의 항목 중 하나라도 점 */
export const railDot = (items: Element[]): boolean => items.some(hasDot);

export const railOpen = (): boolean =>
  document.body.classList.contains("railopen");

/** 펼친 항목 자리: 보이는 것만 차례로 (빈칸 없이) — --ri = 0, 1, 2 … */
function layout() {
  let i = 0;
  for (const e of railItems()) {
    const shown = !e.hidden && getComputedStyle(e).display !== "none";
    e.style.setProperty("--ri", String(shown ? i++ : 0));
  }
}

export function setRailOpen(open: boolean) {
  const b = document.getElementById("bRail");
  if (!b) return;
  document.body.classList.toggle("railopen", open);
  b.setAttribute("aria-expanded", String(open));
  b.classList.toggle("on", open);
  if (open) layout();
}

/** 빨간 점 · 창/대화가 열리면 접기 (HUD 틱처럼 0.5초마다) */
export function railTick() {
  const b = document.getElementById("bRail");
  if (!b) return;
  const dot = railDot(railItems());
  if (b.classList.contains("rdot") !== dot) b.classList.toggle("rdot", dot);
  if (
    railOpen() &&
    (document.body.classList.contains("winopen") ||
      document.querySelector(".talking") ||
      document.body.classList.contains("uihide"))
  )
    setRailOpen(false);
}

let timer = 0;
let wired = false;
/** 안쪽인가: 「⋯」 또는 접히는 버튼 */
const inside = (t: EventTarget | null): boolean =>
  !!t &&
  t instanceof Node &&
  (!!document.getElementById("bRail")?.contains(t) ||
    railItems().some((i) => i.contains(t)));
/** 부팅 때 한 번 (👁 버튼을 만든 뒤) */
export function initSideRail() {
  if (!sideRailOn() || document.getElementById("bRail")) return;
  const b = document.createElement("button");
  b.id = "bRail";
  b.className = "ibtn px hb";
  b.setAttribute("aria-label", "버튼 더 보기");
  b.setAttribute("aria-expanded", "false");
  b.innerHTML = "<b>⋯</b><small>더 보기</small>";
  b.onclick = (e) => {
    e.stopPropagation();
    setRailOpen(!railOpen());
  };
  document.getElementById("hud")!.appendChild(b);
  document.body.classList.add("flrail");
  // 바깥을 누르면 접힘 (누른 것은 원래대로 먹는다) · 안의 것을 고르면 그 동작 뒤에 접힘 — 문서 듣기는 한 번만
  if (!wired) {
    wired = true;
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (railOpen() && !inside(e.target)) setRailOpen(false);
      },
      true,
    );
    // capture: 👁처럼 stopPropagation 하는 버튼도 · 접기는 그 버튼 동작이 끝난 뒤
    document.addEventListener(
      "click",
      (e) => {
        if (
          railOpen() &&
          e.target instanceof Node &&
          railItems().some((i) => i.contains(e.target as Node))
        )
          setTimeout(() => setRailOpen(false), 0);
      },
      true,
    );
  }
  railTick();
  clearInterval(timer);
  timer = window.setInterval(() => {
    if (!document.hidden) railTick();
  }, R().tickMs);
}
