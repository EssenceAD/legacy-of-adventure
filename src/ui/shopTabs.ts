// 상점 창 맨 위 탭 줄 하나: 상점 · 🌾 수확제(기간 중) · 💎 명품관(LUXE §1 · 플래그 luxeShop)
//  창마다 지금 탭만 「on」 · 명품관은 장부 4장 전이면 자물쇠 + 이유(lockBtn)
//  여는 함수는 각 창 모듈이 채운다 (순환 import 피하기)
import { harvestShopOn } from '../world/harvest';
import { lxLockWhy, lxOn } from '../world/luxeShop';
import { shopOpen } from '../world/meta';
import { lockAttr } from './lockBtn';

export type ShopTab = 'shop' | 'hv' | 'luxe';
export const shopTabHooks: Record<ShopTab, () => void> = { shop: () => {}, hv: () => {}, luxe: () => {} };

/** 탭 줄 (탭이 하나뿐이면 '') — 예전 id·data 이름(#hvTabs · data-hvt) 그대로 */
export function shopTabsBar(cur: ShopTab): string {
  const tabs: [ShopTab, string, string][] = [];
  if (shopOpen() || cur === 'shop') tabs.push(['shop', '상점', '']);
  if (harvestShopOn() || cur === 'hv') tabs.push(['hv', '🌾 수확제', '']);
  if (lxOn() || cur === 'luxe') {
    const why = lxLockWhy();
    tabs.push(['luxe', why ? '🔒 명품관' : '💎 명품관', why]);
  }
  if (tabs.length < 2) return '';
  return `<div class="tabs" id="hvTabs">${tabs.map(([k, name, why]) => `<button class="tab ${k === cur ? 'on' : ''}" data-hvt="${k}" ${k !== cur ? lockAttr(why) : ''}>${name}</button>`).join('')}</div>`;
}
/** 탭 누르기 (막힌 탭은 lockBtn이 먼저 이유를 말하고 막는다) */
export function bindShopTabsBar() {
  document.querySelectorAll<HTMLElement>('#hvTabs [data-hvt]').forEach((b) => {
    if (b.classList.contains('on')) return;
    b.onclick = () => shopTabHooks[b.dataset.hvt as ShopTab]?.();
  });
}
