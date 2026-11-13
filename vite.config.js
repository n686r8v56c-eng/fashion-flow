import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
export default defineConfig({plugins:[react()],build:{rollupOptions:{input:{main:resolve(root,'index.html'),shoot:resolve(root,'shoot.html')}}}});
