import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    host: true,
    port: 3000,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'firebase-messaging-sw.js',
      injectRegister: false,
      manifest: false,
      workbox: {
        // Remove globIgnores or ensure it doesn't ignore wasm
      },
      injectManifest: {
        injectionPoint: null, // Deshabilitar inyección si lo manejamos manual
        globPatterns: ['**/*.{js,css,html,png,ico,svg,json}']
      }
    })
  ],
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
    exclude: ['date-fns', 'react-icons']
  },

  base: "/",
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      "@": path.resolve(__dirname, "./"),
      "firebase/firestore": path.resolve(__dirname, "./core/firestore-wrapper.ts"),
    }
  },
  define: {
    '__BUILD_VERSION__': JSON.stringify(Date.now().toString())
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // SEGURIDAD: Excluir explícitamente scripts de administración del bundle de cliente.
      external: [
        /scripts\/.*\.cjs/,
        /service-account\.json/
      ]
    }
  }
});
