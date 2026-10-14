// save: tests/fixtures/real_pace_meoribak.json
// PACE §1: 게시판 토벌 칸 — 이번 주 첫 보스를 잡은 저장 → 「이번 주 1/3 · 다음: 도전장 고르기」 + 도전장 카드 (전: 「이번 주 처치 완료!」)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
document.getElementById('bExp').click();
await T(900);
(document.querySelector('#win .chainline') ?? document.querySelector('.raids'))?.scrollIntoView({ block: 'start' });
await T(100);
// 위 탭 줄에 가리지 않게 조금 올림
for (let el = document.querySelector('#win .chainline')?.parentElement; el; el = el.parentElement) if (el.scrollHeight > el.clientHeight + 4) { el.scrollTop -= 140; break; }
