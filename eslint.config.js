// @ts-check
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import globals from 'globals'

export default defineConfig(
  { ignores: ['node_modules/', 'dist/', 'stash-work/'] },
  js.configs.recommended,
  {
    files: ['src/js/**/*.js', 'design-system/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js', '*.config.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // Test code runs in Node, and page.evaluate callbacks run in the browser.
    files: ['tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
)
