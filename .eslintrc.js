module.exports = {
	env: {
		browser: true,
		es6: true,
		node: true,
		jest: true,
	},
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
	ignorePatterns: ['src/test_archive/**', 'src/lib/***'],
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly',
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaFeatures: {
			jsx: true,
		},
		ecmaVersion: 2018,
		sourceType: 'module',
	},
	plugins: ['@typescript-eslint'],
	rules: {
		'@typescript-eslint/explicit-function-return-type': 'error',
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-empty-function': 'off',
		'@typescript-eslint/no-var-requires': 'off',
		'@typescript-eslint/no-use-before-define': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'error',
		'@typescript-eslint/no-this-alias': 'off',
		'@typescript-eslint/no-inferrable-types': 'off',
		'@typescript-eslint/ban-ts-comment': 'off',
		'react/no-unescaped-entities': 'off',
		'react/prop-types': 'off',
		'react/react-in-jsx-scope': 'off',
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			},
		],
		'linebreak-style': ['error', 'unix'],
		indent: 'off',
		quotes: 'off',
		'no-mixed-spaces-and-tabs': 'off',
	},
	overrides: [
		{
			// Test files and mocks: relax any and explicit return types
			files: ['src/test/**/*.ts'],
			rules: {
				'@typescript-eslint/no-explicit-any': 'off',
				'@typescript-eslint/explicit-function-return-type': 'off',
				'@typescript-eslint/explicit-module-boundary-types': 'off',
				'@typescript-eslint/no-unused-vars': 'off',
			},
		},
	],
};
