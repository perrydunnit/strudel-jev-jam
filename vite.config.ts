import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * `@strudel/web` resolves to a pre-bundled `dist/index.mjs` that inlines its own copy
 * of `@strudel/webaudio`. Anything importing a Strudel package directly - here
 * `@strudel/soundfonts`, which calls `registerSound` - therefore writes to a *different*
 * module instance than the app's own `superdough` and `getSound`. Registered soundfonts
 * would exist in one registry and be looked up in another, so every `s("gm_...")` would
 * silently play nothing at all.
 *
 * Pointing the package at its unbundled entry (`web.mjs`, which re-exports the
 * individual packages) gives the whole app one shared instance of core, webaudio,
 * mini, tonal and transpiler.
 */
const webSource = fileURLToPath(new URL('./node_modules/@strudel/web/web.mjs', import.meta.url))

/**
 * The same trap in `@strudel/draw`: its `dist/index.mjs` inlines its own copy of
 * `@strudel/core`, and `@strudel/webaudio/scope.mjs` imports it for `getTheme`. Loading the
 * engine's analyser views therefore pulled in a second core, which fails to initialise
 * ("Cannot access 'u' before initialization") the moment a scope tries to draw. Pointing the
 * package at its unbundled entry keeps one core for the whole app.
 */
const drawSource = fileURLToPath(new URL('./node_modules/@strudel/draw/index.mjs', import.meta.url))

/**
 * And the same for `@strudel/soundfonts`, which the app imports for `registerSoundfonts`.
 * Its bundle carries a second copy of core, and the engine's analyser views read the theme
 * from `@strudel/draw`, which is core state: a second copy left uninitialised makes the
 * spectrum view throw "Cannot access 'u' before initialization" the moment it draws.
 */
const soundfontsSource = fileURLToPath(new URL('./node_modules/@strudel/soundfonts/index.mjs', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@strudel\/web$/, replacement: webSource },
      { find: /^@strudel\/draw$/, replacement: drawSource },
      { find: /^@strudel\/soundfonts$/, replacement: soundfontsSource },
    ],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
