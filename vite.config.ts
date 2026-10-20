import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served at sarvimo.com/games (proxied) and /games on this Vercel project.
export default defineConfig({ base: '/games/', plugins: [react()] });
