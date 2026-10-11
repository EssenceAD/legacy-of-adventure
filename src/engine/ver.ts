// 핫픽스 13: 에셋 주소에 빌드 번호 — 업데이트 뒤 새 코드가 옛 meta.json·옛 그림(서비스워커 캐시)을 받지 않게
//  `assets/…` 로 부르는 모든 JSON·PNG·초상화·아이콘·UI 그림은 av()를 거친다 (index.html 의 그림은 빌드 때 붙인다)
declare const __BUILD__: string;
export const BUILD_ID = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
const Q = 'v=' + encodeURIComponent(BUILD_ID);
/** 주소 뒤에 ?v=빌드번호 (data:·blob: 은 그대로, 이미 붙어 있으면 그대로) */
export const av = (u: string): string => (/^(data|blob):/.test(u) || u.includes(Q) ? u : u + (u.includes('?') ? '&' : '?') + Q);
