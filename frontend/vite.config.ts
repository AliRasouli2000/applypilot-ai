import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite'

// Emits a Cloudflare Pages _headers file with security headers.
// The CSP only allows API calls to the configured backend origin.
function securityHeaders(apiOrigin: string): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${apiOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')

  return {
    name: 'cloudflare-security-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: [
          '/*',
          `  Content-Security-Policy: ${csp}`,
          '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
          '  X-Content-Type-Options: nosniff',
          '  X-Frame-Options: DENY',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
          '',
          '/assets/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
        ].join('\n'),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const plugins: PluginOption[] = [react()]

  if (command === 'build' && mode === 'production') {
    const apiUrl = env.VITE_API_URL ?? process.env.VITE_API_URL

    if (!apiUrl || !apiUrl.startsWith('https://')) {
      throw new Error(
        'VITE_API_URL must be set to an https:// backend URL for production builds.',
      )
    }

    plugins.push(securityHeaders(new URL(apiUrl).origin))
  }

  return { plugins }
})
