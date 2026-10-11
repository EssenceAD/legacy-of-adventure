// 실제 저장 리플레이 1단계: Supabase saves(읽기 전용 조회) 결과 파일 → 저장 하나당 JSON 파일
//  조회: select i as replay_i, data::text as replay_save from (select data, row_number() over (order by updated_at) as i from public.saves) t order by i
//  실행: node scripts/replay-extract.mjs <조회 결과 파일> <내보낼 폴더(저장소 밖! 유저 데이터)>
import fs from 'node:fs';
import path from 'node:path';
const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('사용법: node scripts/replay-extract.mjs <결과 파일> <폴더>');
if (path.resolve(out).startsWith(path.resolve('.'))) throw new Error('유저 저장은 저장소 밖 폴더에 두세요');
const raw = fs.readFileSync(src, 'utf8');
let text = raw;
try {
  const o = JSON.parse(raw);
  text = typeof o === 'string' ? o : (o.result ?? JSON.stringify(o));
} catch {
  /* 그냥 글자 */
}
// 앞 안내문에도 같은 태그 이름이 나오므로, 바로 뒤에 JSON 배열이 오는 태그를 찾는다
const m = text.match(/<untrusted-data-[0-9a-f-]+>\s*(\[[\s\S]*\])\s*<\/untrusted-data/);
const rows = JSON.parse(m ? m[1] : text);
fs.mkdirSync(out, { recursive: true });
for (const r of rows) {
  const s = typeof r.replay_save === 'string' ? JSON.parse(r.replay_save) : r.replay_save;
  fs.writeFileSync(path.join(out, `save_${String(r.replay_i).padStart(2, '0')}.json`), JSON.stringify(s));
}
console.log(`${rows.length}개 저장 → ${out}`);
