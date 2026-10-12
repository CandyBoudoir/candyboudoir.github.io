// @ts-check

/** @type {import('stylelint').Config} */
const config = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'node_modules/**'],
  rules: {
    // The theme targets Stash's own class names (LoadingIndicator, scene-card__date).
    'selector-class-pattern': null,
    // Overrides follow Stash's component order, not specificity order.
    'no-descending-specificity': null,
  },
}

export default config
