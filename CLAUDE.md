# CLAUDE.md

Guidance for working in this repository.

## What this repo is

This is **Kahoot's fork** of the official [PixiJS DevTools](https://github.com/pixijs/devtools)
(upstream `pixijs/devtools`, forked into `mobitroll/pixijs-devtools`). It is a Chrome extension
(plus a public npm API package) for debugging PixiJS v7/v8 applications.

### Why we forked: the "Open in editor" feature

We added a feature: **from the DevTools scene tree, open the source file of the selected node's
class directly in the editor (VSCode/Cursor/WebStorm/…)** — analogous to the "Open in editor"
shortcut in `kahoot-frontend` (reference impl: `kahoot-frontend/src/common/utils/dev-automation/`).

Triggers: an **"Open" context-menu item** on the tree node **and** the **Ctrl/Cmd+Shift+E**
keyboard shortcut within the panel. See "How 'Open in editor' works" below. The feature lives on the
`open-in-editor` branch.

## Architecture (npm-workspaces monorepo, `packages/*`)

| Package | Name | Role |
|---|---|---|
| `api` | `@mobitroll/pixi-devtools` | **Public** package the debugged app installs. Exposes `initDevtools()` and the extension API (tree/overlay/properties/stats). Published to npm. |
| `backend` | `@devtool/backend` | Runs **inside the inspected page**. Walks the Pixi `stage` and builds the scene graph. |
| `frontend` | `@devtool/frontend` | The React DevTools **panel UI** (Zustand store, Radix UI, `react-arborist` tree, Tailwind). |
| `devtool-chrome` | `@devtool/chrome` | Packages the **Chrome extension** (content / inject / background / devtools panel). |
| `devtool-local` | `@devtool/local` | Local dev harness for the panel without Chrome. |
| `example` | `@devtool/example` | Sample Pixi app to debug. |
| `docs` | — | Documentation site (`pixijs.io/devtools`). |

### The frontend ↔ page bridge (the key mechanism)

The panel cannot touch Pixi objects directly. It runs code **in the inspected page** via
`chrome.devtools.inspectedWindow.eval(code)` and gets back a serializable result.

- Bridge defined in `packages/devtool-chrome/src/devtools/panel/panel.tsx` (`BridgeFn`).
- Used throughout the frontend as `const bridge = useDevtoolStore.use.bridge()`.
- Backend entry point in the page is the global `window.__PIXI_DEVTOOLS_WRAPPER__`
  (type `PixiDevtools`, see `packages/api/global.d.ts`). Example call:
  `bridge('window.__PIXI_DEVTOOLS_WRAPPER__?.scene.tree.nodeContextMenu(id, action)')`.
- The currently selected node is also mirrored to `window.$pixi` (`backend .../tree/tree.ts:159`).

### Scene tree internals (most relevant to this feature)

- **Tree build / selection:** `packages/backend/src/scene/tree/tree.ts`
  - Each node's type is `container.constructor.name` (`_getName`, ~line 227).
  - `setSelected(id)` sets `this.selectedNode` and `window.$pixi`.
- **Node UI + context menu:** `packages/frontend/src/pages/scene/graph/tree/node.tsx`
  (built-in items: Select / Rename / Toggle / Delete) and `context-menu-button.tsx`
  (custom items from extensions, dispatched via `nodeContextMenu`).
- **Selection store:** `packages/frontend/src/pages/scene/scene.ts` (`selectedNode`).
- **Tree extension API:** `packages/api/src/extensions/tree.ts` (`onSelected`, `onContextButtonPress`,
  `updateNodeMetadata`, `contextMenu` metadata, etc.).

## How "Open in editor" works (as built)

The debugged app is **ours, built with Vite, run in dev with sourcemaps**. End-to-end flow:

1. **Build-time source tagging — `@mobitroll/pixi-devtools/vite` plugin** (`packages/api/src/vite/index.ts`,
   exported as the `pixiDevtoolsSource()` subexport). Dev-only (`apply: 'serve'`, `enforce: 'pre'`
   so positions map to the original source). Using Babel + `magic-string` (modelled on
   `kahoot-frontend/config/plugins/jsx-dev-source.ts`), it injects a **static field into every class
   body** — `static __devtoolSource = "/abs/path:line:col"` — covering all class shapes (named,
   anonymous default, `const X = class {}`, mixin-returned). Unparseable files are warned and
   skipped so it can never break a build. The app enables it by adding `pixiDevtoolsSource()` to its
   Vite dev config (see `packages/example/vite.config.ts`; in kahoot-frontend `config/vite.root.ts`).

2. **Editor resolution.** The same plugin resolves which editor to open and injects it into the page
   as `window.__PIXI_DEVTOOLS_EDITOR__` (via `transformIndexHtml`). Precedence: `options.editor` →
   `process.env.EDITOR_SHORTCUT_NAME` (same var as kahoot) → `launch-editor/guess()`. Mirrors
   kahoot's `DEV_IDE`, so devs who already set that env var get it for free.

3. **Backend resolution** (`packages/backend/src/scene/tree/tree.ts`):
   - `getNodeSource(id)` returns the node's `constructor.__devtoolSource`, **walking up the parent
     chain** (stopping at the stage) to the nearest tagged ancestor — so a built-in `Sprite` child
     resolves to its custom parent class.
   - `hasTaggedClasses()` — whether any node on the page is tagged (used to distinguish "plugin not
     enabled" from "this node is just a built-in class").

4. **Panel** (`packages/frontend/src/pages/scene/graph/useOpenInEditor.ts`, the shared hook):
   gets the source via `bridge`, reads the injected editor, builds the deep-link with
   `buildEditorUrl` (`lib/editor.ts`: `code → vscode://`, `code-insiders → vscode-insiders://`,
   `webstorm → webstorm://open?file=` (no line), `cursor → cursor://`, default VSCode), then opens
   it with `window.open` **from the panel** (the click/keypress provides the user gesture Chrome
   needs to launch an external protocol; eval'd page code has no gesture and is blocked silently).
   When no source is found it logs guidance **to the inspected page's console** (via `bridge`):
   `console.error` (plugin missing) vs `console.warn` (built-in node).

5. **Triggers:** the **"Open"** item in the node context menu (`node.tsx`, with an external-link
   icon and an OS-aware shortcut hint via `lib/utils.ts` `isMac`) and the **Ctrl/Cmd+Shift+E**
   shortcut (`SceneTree.tsx`, acts on the store's `selectedNode`). Both call the same hook. No global
   OS-level key listener / Swift binary is needed (unlike kahoot-frontend), because the panel has
   focus when the tree is in use.

## Commands

```bash
npm install                # root install (workspaces)
npm run start:chrome       # dev: build chrome ext (watch) + run example app
npm run start:local        # dev: run the panel locally (@devtool/local)
npm run start:docs         # docs site
npm run build              # build all workspaces; zips to .upload/chrome.zip
npm run lint  / lint:fix   # ESLint over .ts/.tsx
npm run types              # tsc --noEmit typecheck
```

Loading the unpacked extension in `chrome://extensions` (Developer mode):
- **Dev:** run `npm run start:chrome`, then load `packages/devtool-chrome/dist/chrome-dev` (the
  watcher rebuilds it with HMR; reload the extension with ↻ after backend/manifest/devtools-page
  changes — frontend panel changes hot-reload on their own).
- **Prod:** `npm run build`, then load `packages/devtool-chrome/dist/chrome`.

Reference docs: https://pixijs.io/devtools.

## Conventions

- TypeScript + Prettier (`.prettierrc`) + ESLint (`.eslctrc.cjs`). Husky + lint-staged on commit.
- Frontend: React 18, Zustand store accessed via `useDevtoolStore.use.<field>()` selectors,
  Radix UI primitives wrapped in `components/ui/`, Tailwind.
- Backend code must stay **page-injectable / serializable** across the bridge — values returned to
  the panel must be JSON-serializable.
- Support both Pixi **v7 and v8** (version branches exist in the tree/property extensions;
  e.g. `label` vs `name`, see `tree.ts` `renameNode`/`_getName`).
- Keep upstream-mergeable: prefer additive changes; localize Kahoot-specific code where practical.

## Reference implementations (kahoot-frontend)

- `src/common/utils/dev-automation/utils/open-in-editor.ts` — `editorUrlTarget` (URL schemes).
- `src/common/utils/dev-automation/editor-shortcut/index.tsx` — reads selection, resolves source, opens.
- `config/plugins/jsx-dev-source.ts` — Babel/`magic-string` build-time source injection (the model
  for our Pixi class-tagging plugin).
- `config/vite.root.ts` (`DEV_IDE`) + `config/key-listener.ts` + `scripts/GlobalKeyListener.swift`
  — editor guessing and the (here-unneeded) global key listener.
