// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env from .env, .env.local, etc.
  // Vite exposes only variables prefixed with VITE_ on import.meta.env by default.
  // We also lift GEMINI_API_KEY (non-prefixed) into define() for legacy access.
  const env = loadEnv(mode, process.cwd(), '');

  // Prefer the Vite way (VITE_*), but also provide legacy aliases:
  const VITE_GEMINI_API_KEY = env.VITE_GEMINI_API_KEY ?? '';
  const GEMINI_API_KEY = env.GEMINI_API_KEY ?? VITE_GEMINI_API_KEY ?? '';

  return {
    // IMPORTANT for GitHub Pages project sites:
    // If your repo is named "Galaxia", this must be "/Galaxia/".
    base: '/Galaxia/',

    // If you keep static assets in "public/" they are copied verbatim to dist.
    // Ensure: public/manifest.json, public/sw.js, public/vite.svg, etc.
    publicDir: 'public',

    // Resolve config (add aliases here if you use them in imports)
    resolve: {
      alias: {
        // example:
        // '@': path.resolve(__dirname, './src'),
        // For this project, root-level imports are fine; add aliases if needed.
      },
    },

    // Define constants replaced at build time.
    // We provide both `import.meta.env` (Vite-native) and legacy `process.env.*`.
    define: {
      // Legacy access used in some code paths:
      'process.env': {
        NODE_ENV: mode,
        API_KEY: GEMINI_API_KEY,            // legacy alias if your code expects process.env.API_KEY
        GEMINI_API_KEY: GEMINI_API_KEY,     // legacy alias if referenced directly
      },
      // Optional app metadata you might want at runtime:
      __APP_NAME__: JSON.stringify('Galaxia'),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },

    // Server for local development
    server: {
      port: 5173,
      strictPort: true,
      open: false,
    },

    // Preview the production build locally with the same base path semantics.
    // After `npm run build`, do `npm run preview` and open the served URL.
    preview: {
      port: 4173,
      strictPort: true,
      // Vite preview respects the built base; you’ll typically navigate to:
      //   http://localhost:4173/Galaxia/
      // No need to set headers or proxies here.
    },

    // Build configuration for deterministic, Pages-friendly output
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      // Keep inline limit modest; Pages handles separate assets fine
      assetsInlineLimit: 4096, // bytes; set to 0 to force all assets to files
      sourcemap: false,         // set true if you want to debug production
      cssCodeSplit: true,
      rollupOptions: {
        // If you need to control chunk names, do it here
        output: {
          // Ensure hashed file names to avoid cache collisions
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: ({ name }) => {
            // keep images/fonts grouped
            if (name && /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(name)) {
              return 'assets/img/[name]-[hash][extname]';
            }
            if (name && /\.(woff2?|ttf|otf|eot)$/i.test(name)) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            if (name && /\.(css)$/i.test(name)) {
              return 'assets/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
      // Target modern browsers (adjust if you need legacy support)
      target: 'es2018',
      // Minifier can be 'esbuild' (default) or 'terser'
      minify: 'esbuild',
    },

    // Dependency pre-bundling
    optimizeDeps: {
      // If you rely on CDN import maps during dev, you can exclude React libs here.
      // However, since package.json declares react/react-dom, Vite can prebundle normally.
      // Uncomment these if you intentionally want to keep dev deps external:
      // exclude: ['react', 'react-dom'],
    },
  };
});
