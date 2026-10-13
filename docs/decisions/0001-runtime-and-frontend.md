# Decision 0001: runtime and frontend

**Status:** accepted for the first implementation

The build instructions require exactly Node.js 22.16.0. The frontend uses Vue 3, TypeScript, and Vite 7 instead of Nuxt/SSR so the selected stack can be built under that runtime. The [Vite 7 release notes](https://vite.dev/blog/announcing-vite7) list Node.js 20.19+ or 22.12+; the workspace build still verifies the actual installed combination.

The production web container serves the built SPA and proxies `/api` to the API service. This supports the eight requested screens and local search flows, but does not produce server-rendered activity pages. Revisit SSR or prerendering before relying on search-engine indexing for activity details.
