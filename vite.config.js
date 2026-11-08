import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const shellOrigin = new URL(env.VITE_SHELL_ORIGIN || 'http://localhost:3000').origin;
  const securityHeaders = {
    'Content-Security-Policy': `frame-ancestors 'self' ${shellOrigin}`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  };
  return {
    plugins: [react()],
    server: {
      port: 3002,
      host: true,
      headers: securityHeaders
    },
    preview: {
      headers: securityHeaders
    }
  };
});
