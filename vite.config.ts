import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dts from 'vite-plugin-dts'
import { peerDependencies } from "./package.json"

const libMode = true;
const devMode = true;

// https://vite.dev/config/
export default defineConfig({
  // NOTE: Using relative path so that assets can be found no matter the absolute path
  base: "./",
  plugins: [
      react(),
      tailwindcss(),
      libMode && dts({
        tsconfigPath: './tsconfig.app.json',
        rollupTypes: true,
      }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ...(libMode ? {
    build: {
      lib: {
        entry: path.resolve(__dirname, "./src/lib_index.ts"),
        name: "rdf-toolbag",
        fileName: "rdf-toolbag",
      },
      rollupOptions: {
        external: [...Object.keys(peerDependencies)],
      },
      // NOTE: If dev mode enabled, don't minify, otherwise keep the default setting
      minify: devMode ? false : "esbuild",
    },
  } : {}),
})
