import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// 어디서 실행해도(npm --prefix 등) 이 폴더 기준으로
const ROOT = dirname(fileURLToPath(import.meta.url));
const at = (p: string) => join(ROOT, p);

// 핫픽스 7 (8-2): 빌드마다 번호를 붙인다 → version.json · 서비스워커 캐시 이름 · 게임 안 버전이 모두 같은 번호
const pkg = JSON.parse(readFileSync(at('package.json'), 'utf8'));
let rev = 'dev';
try {
  rev = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
} catch {
  /* git 없음 */
}
const BUILD = `${pkg.version}+${rev}.${Date.now().toString(36)}`;

let out = 'dist';
function versionFiles(): Plugin {
  return {
    name: 'legacy-version',
    apply: 'build',
    configResolved(c) {
      out = c.build.outDir;
    },
    closeBundle() {
      const notes = existsSync(at('public/patchnotes.json')) ? JSON.parse(readFileSync(at('public/patchnotes.json'), 'utf8')) : [];
      const top = notes[0] ?? {};
      writeFileSync(at(join(out, 'version.json')), JSON.stringify({ version: pkg.version, build: BUILD, at: new Date().toISOString(), title: top.version === pkg.version ? (top.title ?? '') : '', ...(process.env.FORCE_UPDATE === '1' ? { force: true } : {}) }));
      // 캐시 이름에 빌드 번호 → 배포할 때마다 바뀌어서 이름이 같은 그림도 새로 받는다
      const sw = readFileSync(at(join(out, 'sw.js')), 'utf8').replace('__BUILD__', BUILD.replace(/[^a-z0-9.]/gi, '-'));
      writeFileSync(at(join(out, 'sw.js')), sw);
      // 타이틀 아래 버전 글자
      const html = readFileSync(at(join(out, 'index.html')), 'utf8').replace(/(<button class="ver" id="tVer">)[^<]*(<\/button>)/, `$1v${pkg.version}$2`);
      writeFileSync(at(join(out, 'index.html')), html);
    },
  };
}

// base: './' — GitHub Pages 같은 하위 경로에 올려도 그대로 열리게 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  server: { port: 5181 },
  // BOT_BUILD=1: 봇·검사용 빌드 (개발용 전역 함수 포함 · dist-bot) — 개발 서버를 건드리지 않고 긴 봇을 돌리려고
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD__: JSON.stringify(BUILD), ...(process.env.BOT_BUILD ? { 'import.meta.env.DEV': 'true' } : {}) },
  plugins: [versionFiles()],
});
