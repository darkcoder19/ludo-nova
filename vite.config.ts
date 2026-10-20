import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served at sarvimo.com/ludonova (and /ludonova on the Vercel project via a rewrite).
export default defineConfig({ base: '/ludonova/', plugins: [react()] });
