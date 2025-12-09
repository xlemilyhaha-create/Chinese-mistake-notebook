
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TS errors
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Expose API_KEY to client-side for the Hybrid Fallback strategy (Preview mode or Vercel Timeout fallback)
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});
