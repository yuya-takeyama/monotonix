export default {
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    watchExclude: ['**/coverage/**', '**/dist/**'],
  },
};
