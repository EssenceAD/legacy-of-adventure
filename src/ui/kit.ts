// 5단계 UI 키트: 창·버튼·탭·바·칸 그림(assets/ui) · 금테 아이콘(assets/icons)
// 「깨지지 않게」: 그림은 늘 정수 배율(×1·×2)로만 키우고 pixelated, 9-slice는 border-image(그림 픽셀 × --k)로 늘린다.
// CSS의 url()은 빌드 경로(base './')에서 깨지므로, 그림 주소는 여기서 CSS 변수(--ui-*)로 넣는다 (문서 기준 절대 주소).

import { av } from '../engine/ver';

export const UI = [
  'panel', 'titlebar', 'btn', 'btn_pressed', 'btn_disabled', 'btn_primary',
  'tile', 'tile_pressed', 'tile_selected', 'tile_locked', 'tile_grade_n', 'tile_grade_r', 'tile_grade_e', 'tile_grade_l', 'tile_grade_a',
  'tab_on', 'tab_off', 'bar_frame', 'bar_fill_hp', 'bar_fill_xp', 'bar_fill_mp', 'bar_fill_bond', 'bar_fill_grn',
  // UI_SKIN: 창 재질 (양피지·나무·코르크·돌) · 의뢰서 카드·압정 · 제목 리본 · 책갈피 탭 · 재질 버튼
  'panel_parchment', 'panel_wood', 'panel_cork', 'panel_stone', 'note_card', 'pin_red', 'title_ribbon', 'tab_bookmark_on', 'tab_bookmark_off', 'btn_gold', 'btn_wood', 'btn_iron',
  'dialog', 'nameplate', 'lock', 'dot_new', 'close', 'arrow_r', 'star', 'star_empty', 'coin', 'heart', 'hand_0', 'hand_1',
] as const;

/**
 * 절대 주소로 (핫픽스 7): CSS 변수 url()은 빌드된 CSS 파일(/assets/index-*.css) 기준으로 풀려서
 * 상대 경로면 /assets/assets/ui/…로 가 404가 났다 (개발 서버는 CSS가 문서 안이라 멀쩡했다)
 */
export const abs = (path: string) => new URL(path, document.baseURI).href;
export const uiSrc = (k: (typeof UI)[number]) => av(abs(`assets/ui/${k}.png`));
/** 금테 도트 아이콘 (24px, 작은 건 _16) */
export type IconKey =
  | 'm_account' | 'm_achieve' | 'm_album' | 'm_attendance' | 'm_bag' | 'm_bond' | 'm_chat' | 'm_dex' | 'm_expedition' | 'm_garden'
  | 'm_guests' | 'm_guide' | 'm_heroes' | 'm_hunt' | 'm_letter' | 'm_mail' | 'm_neighbor' | 'm_notice' | 'm_owner' | 'm_quest'
  | 'm_raid' | 'm_rank' | 'm_settings' | 'm_shop' | 'm_smith' | 'm_title'
  | 'skill_attack' | 'skill_auto' | 'skill_block' | 'skill_combo' | 'skill_fireslash' | 'skill_pray'
  | 'harmony' | 'eval_gourmet' | 'eval_relax' | 'eval_adventure' | 'eval_scenery'
  | 'cur_gold' | 'cur_seed' | 'cur_token' | 'cur_dust_n' | 'cur_dust_r' | 'cur_dust_e' | 'cur_dust_l' | 'cur_dust_a';
export const iconSrc = (k: IconKey, small = false) => av(`assets/icons/${k}${small ? '_16' : ''}.png`);
/** 아이콘 <img>: 크기는 그림의 정수배만 (24 → 24·48, 16 → 16·32) */
export const icon = (k: IconKey, px: 16 | 24 | 32 | 48 = 24, cls = '') =>
  `<img class="kic ${cls}" src="${iconSrc(k, px === 16 || px === 32)}" width="${px}" height="${px}" alt="">`;

/**
 * README 0장: 배율 k = 원본 1px이 기기 픽셀 몇 개인지(정수). CSS 크기 = 원본 × k ÷ devicePixelRatio.
 * --k  : UI 부품(창·버튼·바·아이콘 ×2 정도)   --k1 : 작은 부품·아이콘 ×1 정도
 * snap(원본, 원하는 CSS 크기) = 원하는 크기에 가장 가까운 「기기 픽셀 정수배」 CSS 크기
 */
export const dpr = () => window.devicePixelRatio || 1;
export const kDev = (cssScale: number) => Math.max(1, Math.round(cssScale * dpr()));
export const snap = (art: number, wantCss: number) => (art * Math.max(1, Math.round((wantCss * dpr()) / art))) / dpr();
/** 정수 기기 픽셀로 맞춘 CSS px (위치·크기) */
export const px = (css: number) => Math.round(css * dpr()) / dpr();

function applyScale() {
  const r = document.documentElement.style;
  r.setProperty('--k', String(kDev(2) / dpr()));
  r.setProperty('--k1', String(kDev(1) / dpr()));
  r.setProperty('--dpx', String(1 / dpr()));
}

/** 부팅 때 한 번: --ui-panel: url(assets/ui/panel.png) … · 배율 변수 (화면 배율이 바뀌면 다시) */
export function initKit() {
  const r = document.documentElement.style;
  for (const k of UI) r.setProperty('--ui-' + k.replace(/_/g, '-'), `url(${uiSrc(k)})`);
  applyScale();
  addEventListener('resize', applyScale);
  // 그림을 미리 받아 둔다 (창이 처음 열릴 때 테두리가 늦게 뜨지 않게)
  for (const k of UI) new Image().src = uiSrc(k);
}


