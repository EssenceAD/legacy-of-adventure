import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';

// 핫픽스 7 (8-2): 빌드마다 번호를 붙인다 → version.json · 서비스워커 캐시 이름 · 게임 안 버전이 모두 같은 번호
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
let rev = 'dev';
try {
  rev = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  /* git 없음 */
}
const BUILD = `${pkg.version}+${rev}.${Date.now().toString(36)}`;

function versionFiles(): Plugin {
  return {
    name: 'legacy-version',
    apply: 'build',
    closeBundle() {
      const notes = existsSync('public/patchnotes.json') ? JSON.parse(readFileSync('public/patchnotes.json', 'utf8')) : [];
      const top = notes[0] ?? {};
      writeFileSync('dist/version.json', JSON.stringify({ version: pkg.version, build: BUILD, at: new Date().toISOString(), title: top.version === pkg.version ? (top.title ?? '') : '' }));
      // 캐시 이름에 빌드 번호 → 배포할 때마다 바뀌어서 이름이 같은 그림도 새로 받는다
      const sw = readFileSync('dist/sw.js', 'utf8').replace('__BUILD__', BUILD.replace(/[^a-z0-9.]/gi, '-'));
      writeFileSync('dist/sw.js', sw);
      // 타이틀 아래 버전 글자
      const html = readFileSync('dist/index.html', 'utf8').replace(/<div class="ver">[^<]*<\/div>/, `<div class="ver">v${pkg.version}</div>`);
      writeFileSync('dist/index.html', html);
    },
  };
}

// base: './' — GitHub Pages 같은 하위 경로에 올려도 그대로 열리게 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  server: { port: 5181 },
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD__: JSON.stringify(BUILD) },
  plugins: [versionFiles()],
});
