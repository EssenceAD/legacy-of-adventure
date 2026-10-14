// 배포 전 플래그 검사 (2026-10-14 노을·장부 18분 노출 뒤 규칙): 라이브 flags.json과 비교해
//  ① 새로 생긴 플래그가 true · ② false → true 로 바뀐 플래그 가 있으면 멈춘다.
//  형철 OK로 일부러 켜는 것은 ALLOW_FLAGS=키1,키2 로 넘긴다 (예: ALLOW_FLAGS=legendFrame npm run deploy)
//  실행: node scripts/check-flags.mjs   (deploy.mjs가 먼저 부른다)
import fs from 'node:fs';
const LIVE = process.env.LIVE_FLAGS ?? 'https://essencead.github.io/legacy-of-adventure/flags.json';
const local = JSON.parse(fs.readFileSync('public/flags.json', 'utf8'));
let live = {};
try {
  const r = await fetch(`${LIVE}?x=${Date.now()}`, { cache: 'no-store' });
  if (r.ok) live = await r.json();
  else throw new Error(String(r.status));
} catch (e) {
  console.error(`✗ 라이브 flags.json을 못 읽었어요 (${e}) — 네트워크 확인 후 다시`);
  process.exitCode = 1;
  live = null;
}
if (live) {
const allow = new Set((process.env.ALLOW_FLAGS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const turnedOn = Object.entries(local).filter(([k, v]) => v === true && live[k] !== true).map(([k]) => k);
const newOff = Object.keys(local).filter((k) => !(k in live) && local[k] === false);
const bad = turnedOn.filter((k) => !allow.has(k));
if (newOff.length) console.error(`· 새 플래그(꺼짐): ${newOff.join(', ')}`);
if (turnedOn.length) console.error(`· 이번에 켜지는 플래그: ${turnedOn.map((k) => (allow.has(k) ? `${k}(허용)` : k)).join(', ')}`);
if (bad.length) {
  console.error(`✗ 형철 확인 없이 켜지는 플래그: ${bad.join(', ')}\n  보이는 새 기능은 꺼진 채로 배포해요. 일부러 켜는 거면 ALLOW_FLAGS=${bad.join(',')} 로 다시.`);
  process.exitCode = 1;
} else console.error('✓ 플래그 검사 통과');
}
