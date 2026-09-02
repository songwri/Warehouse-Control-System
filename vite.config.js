import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this repo at /<repo-name>/, not the domain root,
// so asset URLs need that prefix baked in. `npm run dev` then serves from
// http://localhost:5173/Warehouse-Control-System/ instead of the root.
export default defineConfig({
  base: '/Warehouse-Control-System/',
  plugins: [react()],
});
