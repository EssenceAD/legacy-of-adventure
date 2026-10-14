// CHECKIN §J3 레벨업 배너 모습: 가운데 짧은 배너 + 반짝 (1초 뒤 사라짐 · 사진은 뜬 지 약 0.3초) — 실제 흐름(공사 끝 → 배너)은 e2e-e3에서 확인 · 전 = 배너 없음
const W = window.__world;
const objs = W.home?.objs ?? W.objs;
const o = objs.find((x) => x.kind === 'tavern') ?? objs.find((x) => x.kind === 'inn');
setTimeout(() => window.__checkin?.bannerFx(`${o.kind === 'tavern' ? '주점' : '여관'} Lv.${o.lvl + 1}`), 400);
