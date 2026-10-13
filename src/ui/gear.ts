// CHECKIN §C1 (gearAlways): 오른쪽 위 ⚙ 하나 — 마을·창 위에선 설정 창 (전투 중엔 combat/ui의 ⚙가 일시정지 시트)
//  예전 HUD: 맨 위 줄 오른쪽 끝 「메뉴」 자리를 ⚙ 「설정」이 쓴다 (메뉴는 아래 줄에 그대로) · 새 HUD(hud2): 상태줄 오른쪽 끝 한 칸
//  창이 열려 있어도 눌리게 어두운 바깥(scrim)보다 위에 둔다 · 플래그 끔: 아무것도 만들지 않는다
import { vis } from '../world/visual';
import { iconSrc } from './kit';
import { closeWin, isWinOpen } from './windows';

/** 설정 창 열기 (menu.ts가 채운다 — menu → gear 순환을 피하려고) */
export const gearHooks = { open: () => {} };

const settingsOpen = () => isWinOpen() && document.getElementById('winT')?.textContent === '설정';

export function initGear() {
  if (!vis('gearAlways')) return;
  document.body.classList.add('gear');
  const b = document.createElement('button');
  b.id = 'bGear';
  b.className = 'ibtn px hb';
  b.setAttribute('aria-label', '설정');
  b.innerHTML = `<img src="${iconSrc('m_settings', true)}" alt=""><small>설정</small>`;
  b.onclick = (e) => {
    e.stopPropagation();
    if (settingsOpen()) closeWin();
    else gearHooks.open();
  };
  const menu = document.getElementById('bMenu');
  if (menu?.parentElement) menu.parentElement.insertBefore(b, menu.nextSibling);
  else document.querySelector('#hud .top')?.appendChild(b);
}
