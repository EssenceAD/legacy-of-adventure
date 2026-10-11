// 핫픽스 브랜치를 main 에 합칠 때: 버전 파일은 main(HEAD) 쪽 · 패치노트는 양쪽을 합쳐 버전 순(새것 먼저)
//  실행: git merge 충돌 뒤 node scripts/merge-versions.mjs
import fs from 'node:fs';
const CF = /<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g;
const ours = (f) => fs.existsSync(f) && fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(CF, (m, a) => a));
ours('index.html');
ours('package.json');
const f = 'public/patchnotes.json';
const raw = fs.readFileSync(f, 'utf8');
if (CF.test(raw)) {
  const pick = (i) => JSON.parse(raw.replace(CF, (m, a, b) => (i ? b : a)));
  const seen = new Set();
  const all = [...pick(0), ...pick(1)].filter((n) => !seen.has(n.version) && seen.add(n.version));
  const key = (v) => v.replace(/-.*/, '').split('.').map(Number);
  all.sort((x, y) => {
    const a = key(x.version);
    const b = key(y.version);
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return b[i] - a[i];
    return 0;
  });
  fs.writeFileSync(f, JSON.stringify(all, null, 2) + '\n');
  console.log('패치노트:', all.slice(0, 4).map((n) => n.version).join(' '));
}
