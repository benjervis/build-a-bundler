const seek = require('eslint-config-seek/base');

const filteredOverrides = seek.overrides.filter(
  (override) => !override?.plugins?.includes('jest'),
);

module.exports = {
  ...seek,
  overrides: filteredOverrides,
  rules: {
    ...seek.rules,
    'no-console': 'off',
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        pathGroups: [
          {
            pattern: '*.@(less|css)',
            group: 'index',
            position: 'after',
            patternOptions: { matchBase: true },
          },
        ],
      },
    ],
  },
};
