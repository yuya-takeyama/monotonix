import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

/** @type {import('rollup').RollupOptions} */
const config = {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
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
  onwarn(warning, warn) {
    // Suppress warnings from external packages (node_modules)
    if (warning.id?.includes('node_modules')) return;
    if (warning.ids?.some(id => id.includes('node_modules'))) return;
    warn(warning);
  },
};

export default config;
