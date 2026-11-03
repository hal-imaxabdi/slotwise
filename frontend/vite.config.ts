import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Public pages worth indexing. App pages need a session and are kept out of search.
const PUBLIC_ROUTES = ['/', '/privacy', '/terms', '/cookies', '/login', '/register']
const PRIVATE_PREFIXES = ['/services', '/appointments', '/account', '/staff', '/admin']

/**
 * Search and link previews need absolute URLs. With VITE_SITE_URL set (e.g. in the
 * Vercel project settings) the build adds canonical/og:url/og:image tags and a sitemap;
 * without it they are left out rather than pointing at a wrong domain.
 */
function seo(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/+$/, '')
  return {
    name: 'slotwise-seo',
    transformIndexHtml(html) {
      const tags = base
        ? [
            `<link rel="canonical" href="${base}/" />`,
            `<meta property="og:url" content="${base}/" />`,
            `<meta property="og:image" content="${base}/og-image.jpg" />`,
            `<meta name="twitter:image" content="${base}/og-image.jpg" />`,
          ].join('\n    ')
        : ''
      return html.replace(/<!-- seo:absolute[^>]*-->/, tags)
    },
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`)]
      if (base) {
        robots.push('', `Sitemap: ${base}/sitemap.xml`)
        const urls = PUBLIC_ROUTES.map((route) => `  <url><loc>${base}${route}</loc></url>`)
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
        })
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots.join('\n') + '\n' })
    },
  }
}

// The browser talks to /api on the Vite origin; Vite forwards to FastAPI
// with the /api prefix removed. Same-origin => no CORS needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), seo(env.VITE_SITE_URL ?? '')],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: false,
    },
  }
})
