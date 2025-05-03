module.exports = {
  'src/**/*.{js,ts}': [
    'eslint --fix',
    'prettier --write',
  ],
  'src/**/*.{json,css,scss,md}': ['prettier --write'],
};
