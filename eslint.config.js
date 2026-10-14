// @ts-check
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import globals from 'globals'

export default defineConfig(
  { ignores: ['node_modules/', 'dist/', 'stash-work/'] },
  js.configs.recommended,
  {
    files: ['plugins/*/src/js/**/*.js', 'plugins/*/design-system/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
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
