import { defineConfig } from 'vite';

export default defineConfig({
  base: '/crypto-lab-isogeny-gate/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
