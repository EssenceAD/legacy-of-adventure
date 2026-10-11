// GitHub Pages 배포: 빌드한 dist/ 를 gh-pages 브랜치로 올린다.  실행: npm run deploy
// (GitHub Actions 대신 — 지금 로그인 토큰에 workflow 권한이 없어도 된다)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd) => execSync(cmd).toString().trim();

const remote = out('git remote get-url origin');
const rev = out('git rev-parse --short HEAD');

// 핫픽스 7 (8-3): 패치노트 맨 위가 지금 버전이 아니면 배포하지 않는다
const ver = JSON.parse(readFileSync('package.json', 'utf8')).version;
const notes = JSON.parse(readFileSync('public/patchnotes.json', 'utf8'));
if (notes[0]?.version !== ver || !notes[0]?.items?.length) {
  console.error(`\n✗ 패치노트를 먼저 써 주세요: public/patchnotes.json 맨 위가 v${ver}이어야 해요 (지금 맨 위: v${notes[0]?.version ?? '없음'})`);
  process.exit(1);
}
// 핫픽스 10 §14: 꼭 받아야 하는 업데이트 — npm run deploy -- --force-update (기본은 아님)
const force = process.argv.includes('--force-update');
process.env.FORCE_UPDATE = force ? '1' : '';
if (force) console.log('⚠ force 업데이트: 플레이어는 「조금 있다가」 없이 새로 시작해야 해요');
// 자동 테스트 — 하나라도 실패하면 배포하지 않는다
if (existsSync('tests')) run('npm test');
run('npm run build');
// 핫픽스 7: 빌드 결과물에서 그림·소리 요청 실패가 하나라도 있으면 배포하지 않는다
run('npm run check');
writeFileSync('dist/.nojekyll', ''); // 밑줄로 시작하는 파일도 그대로 내보내게
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git commit -q -m "deploy ${rev}"`, 'dist');
run(`git push -f "${remote}" gh-pages`, 'dist');
console.log('\n배포 완료 → gh-pages 브랜치. 1~2분 뒤 Pages 주소에 반영돼요.');
