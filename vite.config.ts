import path from 'node:path';
import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { defineConfig } from 'vite';

// GitHub Pages serves under /<repo>/ unless a custom domain is set.
// Override via env var when needed: BASE_URL=/htxlabs/ npm run build
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex],
        providerImportSource: '@mdx-js/react',
      }),
    },
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
