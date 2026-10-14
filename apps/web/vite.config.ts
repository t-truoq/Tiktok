// truonglt Phase5 same-origin development REST proxy start
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { host: '127.0.0.1', port: 5173,
  proxy: { '/api': { target: process.env.API_PROXY_TARGET || 'https://tiktok-6kwu.onrender.com', changeOrigin: true, secure: true } } } });
// truonglt Phase5 same-origin development REST proxy end
