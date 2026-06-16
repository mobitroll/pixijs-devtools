# Kahoot's PixiJS DevTools

This is a fork from the official [PixiJS DevTools project](https://github.com/pixijs/devtools).

## What this fork adds: "Open in editor"

From the DevTools **Scene** tree you can jump straight to a node's class source in your editor —
via the **"Open"** context-menu item or the **Ctrl/Cmd+Shift+E** shortcut. If the node's own class
isn't yours (e.g. a built-in `Sprite`), it walks up to the nearest ancestor class you control.

### Installing the extension

```bash
npm install
npm run build      # outputs packages/devtool-chrome/dist/chrome (+ .upload/chrome.zip)
```

In `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `packages/devtool-chrome/dist/chrome`. (For wider sharing, publish it to the Chrome Web
Store as *unlisted* so it auto-updates.)

### Enabling "Open in editor" in your app

The feature needs your app's classes tagged with their source location at dev time. This is done by
a Vite plugin shipped in the companion package **`@kahoot/pixi-devtools`** (published to our
private registry):

```ts
// vite.config.ts (or your dev config)
import { pixiDevtoolsSource } from '@kahoot/pixi-devtools/vite';

export default defineConfig({
  plugins: [pixiDevtoolsSource()], // dev-only; no effect on production builds
});
```

The editor is auto-detected (`launch-editor`) or forced via the `EDITOR_SHORTCUT_NAME` env var
(same as kahoot-frontend), or the plugin's `editor` option. Supported: VSCode (default), VSCode
Insiders, Cursor, WebStorm.

> Your app must also expose itself to the devtools (`window.__PIXI_DEVTOOLS__ = { app }` or
> `initDevtools(...)`) — see https://pixijs.io/devtools.

### Local development of this extension

```bash
npm run start:chrome   # builds the extension (HMR) + runs the example app on http://localhost:3001
```

Then load `packages/devtool-chrome/dist/chrome-dev` as an unpacked extension. See `CLAUDE.md` for
the architecture and how the feature works end-to-end.

## License

MIT License.
