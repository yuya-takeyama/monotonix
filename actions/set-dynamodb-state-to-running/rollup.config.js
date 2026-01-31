import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const onwarn = (warning, warn) => {
  // Suppress warnings from external packages (node_modules)
  if (warning.id?.includes('node_modules')) return;
  if (warning.ids?.some(id => id.includes('node_modules'))) return;
  warn(warning);
};

/** @type {import('rollup').RollupOptions[]} */
const config = [
  {
    input: 'src/index.ts',
    output: {
      esModule: true,
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [
      typescript({
        compilerOptions: {
          module: 'ESNext',
          moduleResolution: 'bundler',
          declaration: false,
        },
        exclude: ['**/*.test.ts'],
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
    ],
    onwarn,
  },
  {
    input: 'src/post.ts',
    output: {
      esModule: true,
      file: 'dist/post/index.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [
      typescript({
        compilerOptions: {
          module: 'ESNext',
          moduleResolution: 'bundler',
          declaration: false,
        },
        exclude: ['**/*.test.ts'],
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
    ],
    onwarn,
  },
];

export default config;
