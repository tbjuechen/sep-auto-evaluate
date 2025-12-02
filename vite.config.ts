import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import monkey, { cdn } from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'SEP 自动评价脚本',
        namespace: 'http://tampermonkey.net/',
        version: '0.1.0',
        description: '国科大SEP选课系统自动评价，智能识别课程/教师评估并填充相应内容',
        author: 'tbjuechen',
        match: [
          'https://xkcts.ucas.ac.cn/*',
          'https://xkcts.ucas.ac.cn:8443/*',
          'https://jwxk.ucas.ac.cn/*',
        ],
        icon: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        grant: ['GM_addStyle', 'GM_xmlhttpRequest'],
      },
      build: {
        externalGlobals: {
          vue: cdn.jsdelivr('Vue', 'dist/vue.global.prod.js'),
        },
      },
    }),
  ],
});
