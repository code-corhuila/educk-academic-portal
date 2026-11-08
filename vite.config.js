import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SHELL_ORIGIN = new URL(process.env.VITE_SHELL_ORIGIN || 'http://localhost:3000').origin;
const securityHeaders = {
  'Content-Security-Policy': `frame-ancestors ${SHELL_ORIGIN}`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: true,
    headers: securityHeaders
  },
  preview: {
    headers: securityHeaders
  }
});
