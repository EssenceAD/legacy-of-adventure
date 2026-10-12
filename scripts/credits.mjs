// DIRECTION §2-1: 패치 노트에 붙일 반영 크레딧 줄 — 「💌 제보: 웅스 · 고느끼」
//  실행: node scripts/credits.mjs 0.23.0
//  공개 키(anon · .env.production의 VITE_SUPABASE_URL/KEY 또는 같은 이름의 환경 변수)로 letter_credits 함수만 부른다 (읽기 전용)
//  출력된 줄을 public/patchnotes.json 그 버전 items 끝에 붙여 넣으면 된다 (게임 안 패치 노트 탭은 자동으로 같은 줄을 보여 준다)
import { existsSync, readFileSync } from 'node:fs';

/** .env 꼴 파일 읽기 (없으면 빈 값) */
export function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
export const normVer = (v) => String(v ?? '').trim().replace(/^v/i, '').replace(/-beta$/i, '');
/** src/data/credits.ts creditLine과 같은 모양 */
export function creditLine(names) {
  const seen = [];
  for (const n of names) {
    const t = String(n ?? '').trim();
    if (t && !seen.includes(t)) seen.push(t);
  }
  return seen.length ? `💌 제보: ${seen.join(' · ')}` : '';
}

/** 서버에서 그 버전의 닉네임들 (fetchImpl은 시험용) */
export async function fetchCredits(ver, { url, key, fetchImpl = fetch }) {
  const r = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/rpc/letter_credits`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_ver: normVer(ver) }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (/letter_credits|PGRST202|does not exist/i.test(t)) throw new Error('서버에 letter_credits 함수가 아직 없어요 — supabase/direction.sql을 먼저 실행해 주세요');
    throw new Error(`서버 오류 ${r.status}: ${t.slice(0, 200)}`);
  }
  const rows = await r.json();
  return rows.filter((x) => normVer(x.ver_fixed) === normVer(ver)).map((x) => x.nickname);
}

async function main() {
  const ver = process.argv[2];
  if (!ver) {
    console.error('사용법: node scripts/credits.mjs <버전>   예) node scripts/credits.mjs 0.23.0');
    process.exit(2);
  }
  const env = { ...readEnv('.env.production'), ...readEnv('.env'), ...process.env };
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Supabase 주소·공개 키가 없어요: VITE_SUPABASE_URL · VITE_SUPABASE_KEY (.env.production 또는 환경 변수)');
    process.exit(2);
  }
  try {
    const names = await fetchCredits(ver, { url, key });
    const line = creditLine(names);
    if (!line) console.error(`v${normVer(ver)}에 「반영」된 제보가 아직 없어요`);
    else console.log(line);
  } catch (e) {
    console.error(String(e.message ?? e));
    // Windows: 열린 연결이 있을 때 process.exit 하면 node가 멈추며 죽는다 → 종료 코드만
    process.exitCode = 1;
  }
}
if (process.argv[1] && /credits\.mjs$/.test(process.argv[1])) await main();
