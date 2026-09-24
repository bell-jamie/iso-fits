import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { version } from './package.json';

export default defineConfig({
  plugins: [
    wasm(),
		tailwindcss(),
		sveltekit()
  ],
  build: {
    target: 'esnext'
	},
  define: {
    __APP_VERSION__: JSON.stringify(version)
  }
});
