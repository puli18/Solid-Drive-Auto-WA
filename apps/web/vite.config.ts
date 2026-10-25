import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const demo = env.VITE_DEMO_MODE === 'true';

  // Demo mode (bundled fixtures, no Firebase) is for client previews only – never production.
  if (command === 'build' && demo && process.env.SDA_DEPLOY_ENV === 'production') {
    throw new Error('VITE_DEMO_MODE=true is not allowed for a production build');
  }

  /** Preview (demo) deploys must never be indexed – also for crawlers that don't run JS. */
  const noindexInDemo: Plugin = {
    name: 'sda-noindex-demo',
    transformIndexHtml: (html) => (demo ? html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>') : html),
  };

  return {
    plugins: [react(), tailwindcss(), noindexInDemo],
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    server: { port: 3000, strictPort: false },
    preview: { port: 3000 },
    build: { target: 'es2022', sourcemap: false },
  };
});
