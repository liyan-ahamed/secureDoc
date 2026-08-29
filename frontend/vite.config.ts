import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL;

  return {
    plugins: [react(), tailwindcss()],
    server: apiUrl ? {
      port: 5173,
      proxy: {
        '/api': {
          target: apiUrl.replace(/\/api\/?$/, ''),
          changeOrigin: true,
        },
      },
    } : { port: 5173 },
  };
});
