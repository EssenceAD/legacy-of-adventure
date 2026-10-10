// GitHub Pages 배포: 빌드한 dist/ 를 gh-pages 브랜치로 올린다.  실행: npm run deploy
// (GitHub Actions 대신 — 지금 로그인 토큰에 workflow 권한이 없어도 된다)
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd) => execSync(cmd).toString().trim();

const remote = out('git remote get-url origin');
const rev = out('git rev-parse --short HEAD');

run('npm run build');
// 핫픽스 7: 빌드 결과물에서 그림·소리 요청 실패가 하나라도 있으면 배포하지 않는다
run('npm run check');
writeFileSync('dist/.nojekyll', ''); // 밑줄로 시작하는 파일도 그대로 내보내게
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git commit -q -m "deploy ${rev}"`, 'dist');
run(`git push -f "${remote}" gh-pages`, 'dist');
console.log('\n배포 완료 → gh-pages 브랜치. 1~2분 뒤 Pages 주소에 반영돼요.');
