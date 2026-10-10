import { defineConfig } from 'vite';

// base: './' — GitHub Pages 같은 하위 경로에 올려도 그대로 열리게 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  server: { port: 5181 },
});
