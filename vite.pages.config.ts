import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

const projectRoot=fileURLToPath(new URL('.',import.meta.url));
const base=process.env.PAGES_BASE_PATH||'/exam-graph-studio/';
if(!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(base))throw new Error('PAGES_BASE_PATH must be / or a trailing-slash repository path.');

export default defineConfig({
  root:projectRoot+'pages',
  base,
  publicDir:projectRoot+'public',
  envDir:projectRoot,
  plugins:[react()],
  resolve:{alias:{'@':projectRoot}},
  css:{postcss:projectRoot},
  build:{outDir:projectRoot+'dist-pages',emptyOutDir:true},
});
