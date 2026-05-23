import { defineConfig } from 'vitest/config';

import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, './src/test/obsidian-mock.ts'),
		},
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/main.ts', 'src/types/**', 'src/**/*.d.ts'],
		},
	},
});
