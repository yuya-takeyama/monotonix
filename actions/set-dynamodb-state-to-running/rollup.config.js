import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

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
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
    ],
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
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
    ],
  },
];

export default config;
