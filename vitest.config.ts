import { defineConfig } from 'vitest/config';

// 자동 테스트 (밤샘 ④-1): npm test — 배포 스크립트가 먼저 돌린다
export default defineConfig({
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] },
  define: { __APP_VERSION__: '"test"', __BUILD__: '"test"' },
});
