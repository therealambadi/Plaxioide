import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '../xmlUtils.js': path.resolve(__dirname, '../../xmlUtils.ts'),
      '../dataTypeMap.js': path.resolve(__dirname, '../../dataTypeMap.ts'),
      '../variableTypeResolver.js': path.resolve(__dirname, '../../variableTypeResolver.ts'),
      '../pinSignatures.js': path.resolve(__dirname, '../../pinSignatures.ts'),
      '../types.js': path.resolve(__dirname, '../../types.ts'),
      '../../logicStore.js': path.resolve(__dirname, '../../../logicStore.ts'),
    },
  },
  test: {
    globals: true,
    reporters: ['verbose'],
  },
});
