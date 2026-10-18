// @ts-check
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import { existsSync, readdirSync } from 'node:fs'

// Plugins built from ES modules: the ones whose esbuild entry point,
// src/js/main.jsx, exists. Every other plugin's src/js holds classic scripts.
const modulePlugins = readdirSync('plugins').filter((name) =>
  existsSync(`plugins/${name}/src/js/main.jsx`),
)

export default defineConfig(
  { ignores: ['node_modules/', 'dist/', 'stash-work/'] },
  js.configs.recommended,
  {
    files: ['plugins/*/src/js/**/*.js', 'plugins/*/design-system/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    // Plugins built from ES modules (Cherry Pick): JSX compiled by esbuild
    // against PluginApi.React, so React is a global the shim provides.
    files: modulePlugins.flatMap((name) => [
      `plugins/${name}/src/js/**/*.js`,
      `plugins/${name}/src/js/**/*.jsx`,
    ]),
    languageOptions: {
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      'plugins/*/plugin.mjs',
      '*.config.js',
      '*.config.mjs',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // Test code runs in Node, and page.evaluate callbacks run in the browser.
    files: ['tests/**/*.mjs', 'plugins/*/tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
)
