module.exports = {
  // Spec files are excluded from tsconfig.json, so type-aware ESLint cannot parse them;
  // they still get Prettier below.
  'src/**/!(*.spec|*.e2e-spec).{js,ts}': ['eslint --fix', 'prettier --write'],
  'src/**/*.{spec,e2e-spec}.{js,ts}': ['prettier --write'],
  'src/**/*.{json,css,scss,md}': ['prettier --write'],
};
