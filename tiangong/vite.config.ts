import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

/**
 * content/dialogue/*.yaml 在构建时编译为 JSON（文档 02 §8.2：
 * 「DialogueEngine 加载该 NPC 的 yaml（构建时已编译为 JSON）」）。
 * 用法：import dlg from '@/content/dialogue/taibai-jinxing.yaml';
 */
function yamlContentPlugin(): Plugin {
  return {
    name: 'tiangong-yaml-content',
    transform(_code, id) {
      if (!id.endsWith('.yaml') && !id.endsWith('.yml')) return null;
      const raw = fs.readFileSync(id, 'utf8');
      const data = yaml.load(raw);
      return { code: `export default ${JSON.stringify(data)};`, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [yamlContentPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@content': path.resolve(__dirname, 'content'),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 12000,
  },
  server: { port: 5173, host: '127.0.0.1' },
});
