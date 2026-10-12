import fs from 'node:fs';
import { execSync } from 'node:child_process';
let s = fs.readFileSync('package.json', 'utf8');
s = s.replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> h22\n/, (m, a) => a);
fs.writeFileSync('package.json', s);
s = fs.readFileSync('src/main.ts', 'utf8');
s = s.replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> h22\n/, (m, a, b) => {
  const extra = a.match(/__mythic: \{ seed: debugMythic, prog: mythicProgress \}, __story: \{[^}]*\}[^,]*\},/);
  if (!extra) throw new Error('extra nf');
  if (!b.includes('__saveNow: writeSave,')) throw new Error('anchor nf');
  return b.replace('__saveNow: writeSave,', () => '__saveNow: writeSave, ' + extra[0]);
});
fs.writeFileSync('src/main.ts', s);
const ours = JSON.parse(execSync('git show :2:public/patchnotes.json', { encoding: 'utf8', maxBuffer: 1e8 }));
const theirs = JSON.parse(execSync('git show :3:public/patchnotes.json', { encoding: 'utf8', maxBuffer: 1e8 }));
const top = ours.find((x) => x.version === '0.19.0-beta');
fs.writeFileSync('public/patchnotes.json', JSON.stringify([top, ...theirs.filter((x) => x.version !== '0.19.0-beta')], null, 2) + '\n');
console.log('ok');
