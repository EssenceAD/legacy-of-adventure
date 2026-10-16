// FASTSHIP: 원격 끄기 스위치 — 기본값 켬 · 끄면 그 기능만 멈춤
import { describe, expect, it } from 'vitest';
import { flag, FLAG_DEFAULTS, setFlag } from '../src/world/flags';
import { autoGoldMult, convItems } from '../src/world/goldsink';

describe('flags', () => {
  it('기본값은 모두 켬 (VISUAL 실험실 플래그만 꺼짐)', () => {
    const LAB = new Set(['paletteV2', 'calmWorld', 'hudV2', 'uiKitV2', 'visualLabOpen', 'propFilter', 'storyInbox', 'guestSortPin', 'autoPathNone', 'boardLevelUp', 'mythicGuide', 'firstFlowFix', 'backRule', 'thumbZone', 'pressFeel', 'timeBars', 'confirmSheet', 'welcomeBack', 'redDots', 'bulkTidy', 'resendRun', 'gardenLevelUp', 'personActionsV2', 'actionsTidy', 'gearAlways', 'settingsTabs', 'sound70', 'screenSaver', 'uiHide', 'bldStatus', 'heroCards', 'heroDotV2', 'smithOne', 'checkinFx', 'uiCards', 'sunset', 'ledgerDaily', 'almanac', 'leftIcons', 'legendFrame', 'huntSlots', 'enhTransfer', 'fiveStars', 'bundles', 'guestbook', 'flQuiet', 'flTouchHints', 'flFirstCam', 'flTeaserFit', 'flSideRail', 'flCharPop', 'luxeShop', 'outfits', 'pets', 'abyssRush', 'exWeapons', 'burnWeekend', 'worldRaid']);
    // 운영 스위치로 일부러 꺼 둔 것 (실험실 아님): communityLinks = 유저 톡방 링크 (10/16 형철 · 커뮤 홍보 전 숨김)
    const OPS_OFF = new Set(['communityLinks']);
    for (const k of Object.keys(FLAG_DEFAULTS) as (keyof typeof FLAG_DEFAULTS)[]) expect(flag(k)).toBe(!LAB.has(k) && !OPS_OFF.has(k));
  });
  it('끄면 자동 사냥 금화 100% · 변환 목록 없음', () => {
    setFlag('goldsinkAutoCap', false);
    expect(autoGoldMult()).toBe(1);
    setFlag('goldsinkConvert', false);
    expect(convItems()).toEqual([]);
    setFlag('goldsinkAutoCap', true);
    setFlag('goldsinkConvert', true);
  });
});
