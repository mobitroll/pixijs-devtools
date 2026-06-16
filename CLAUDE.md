# CLAUDE.md

Guidance for working in this repository.

## What this repo is

This is **Kahoot's fork** of the official [PixiJS DevTools](https://github.com/pixijs/devtools)
(upstream `pixijs/devtools`, forked into `mobitroll/pixijs-devtools`). It is a Chrome extension
(plus a public npm API package) for debugging PixiJS v7/v8 applications.

### Why we forked: the "Open in editor" feature

We are adding a feature: **from the DevTools scene tree, open the source file of the selected
node's class directly in the user's editor (VSCode/Cursor/etc.)** — analogous to the
"Open in editor" shortcut in `kahoot-frontend`
(reference impl: `kahoot-frontend/src/common/utils/dev-automation/`).

Triggers: a **context-menu item** on the tree node **and** a **keyboard shortcut** within the panel.

## Architecture (npm-workspaces monorepo, `packages/*`)

| Package | Name | Role |
|---|---|---|
| `api` | `@pixi/devtools` | **Public** package the debugged app installs. Exposes `initDevtools()` and the extension API (tree/overlay/properties/stats). Published to npm. |
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

## Planned design for "Open in editor"

Decisions (the debugged app is **ours, built with Vite, run in dev with sourcemaps**):

1. **Source resolution → Vite build plugin (chosen approach).**
   Mirror `kahoot-frontend/config/plugins/jsx-dev-source.ts` (Babel + `magic-string`).
   A plugin (shipped as e.g. `@pixi/devtools/vite`, **dev-only**) tags each class declaration in
   `/src/` with its definition location, e.g. injects `MyClass.__devtoolSource = '/abs/path:line:col'`.
   At runtime the backend reads `selectedNode.constructor.__devtoolSource` — exact, no name ambiguity.
   (Rejected: runtime stack capture = fragile; source-tree grep by class name = ambiguous.)

2. **Editor is configurable**, simplified version of kahoot's `DEV_IDE`
   (`kahoot-frontend/config/vite.root.ts` using `launch-editor/guess` + `EDITOR_SHORTCUT_NAME`).
   The plugin injects the default editor; the panel lets the user override it (persist via the
   frontend `localStorage` helper). Build the URL like kahoot's `editorUrlTarget`:
   `vscode://file/<path>:<line>:<col>`, `cursor://file/...`, `webstorm://open?file=...`
   (WebStorm cannot target a line).

3. **Triggers:** context-menu item in `node.tsx` **and** a panel keyboard shortcut
   (a `keydown` listener in the React panel — the panel has focus, so **no global OS-level key
   listener / Swift binary is needed**, unlike kahoot-frontend).

4. **Flow:** backend exposes something like `scene.tree.getSelectedSource()` returning the node's
   `__devtoolSource`; the frontend builds the editor URL with the configured editor, then runs
   `bridge('window.open(<url>)')` so the page (not the extension origin) opens the editor.

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

Loading the unpacked extension: build, then load `packages/devtool-chrome/dist/chrome` in
`chrome://extensions` (Developer mode). Reference docs: https://pixijs.io/devtools.

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
