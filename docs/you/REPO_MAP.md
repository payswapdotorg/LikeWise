# YOU / ZCode Repository Map

## Host architecture to reuse

### Workspace shell
- `packages/ui/src/app-shell/WorkspaceShellLayout.tsx`
- `packages/ui/src/app-shell/AnimatedSidePanePanel.tsx`
- `packages/ui/src/app-shell/SidePaneTabTrigger.tsx`
- `packages/ui/src/app-shell/SidePaneTabOverview.tsx`
- `packages/ui/src/app-shell/sidePaneLayout.ts`
- `packages/ui/src/v4/paneLayoutTree.ts`
- `packages/ui/src/v4/paneLayoutStore.ts`
- `packages/ui/src/v4/paneLayoutPersistence.ts`
- `packages/ui/src/v4/WorkbenchPane.tsx`
- `packages/ui/src/v4/workbenchDragDrop.ts`

### Existing Browser surface
- `packages/ui/src/browser-use/BrowserUseSidePaneContent.tsx`
- `packages/ui/src/browser-use/BrowserViewportSurface.tsx`
- `packages/ui/src/browser-use/UnifiedBrowserView.tsx`
- `packages/desktop/src/main/browserView/**`
- `packages/shared/src/browser-use/**`

### Existing artifact surface
- `packages/ui/src/components/ai-elements/artifact.tsx`
- `packages/ui/src/app-shell/WorkflowArtifactSidePane.tsx`
- `packages/ui/src/app-shell/workflow-artifacts/**`
- `packages/shared/src/zcode-protocol-v4/workflow-artifact.ts`

### Platform abstraction
- `packages/shared/src/platform.ts`
- `packages/ui/src/hooks/usePlatform.tsx`
- desktop platform bridge under `packages/desktop/src/**`

### Agent/session
- `packages/ui/src/v4/**`
- `apps/zcode-cli/packages/core/**`
- `apps/zcode-cli/packages/contracts/**`
- `packages/services/src/**`
- `packages/rpc/**`

## YOU implementation principle

Do not create a shadow implementation of:

- pane layout;
- browser lifecycle;
- Agent session state;
- workspace identity;
- platform operations;
- generic artifact lifecycle.

Adapt existing authorities.

## Controlled-context rule

Before editing a target module, use the repository's architecture-governance skill and controlled module-context tools to understand ownership and boundaries.

## New YOU target structure

Preferred conceptual organization:

```
packages/
  shared/src/you/
  ui/src/you/
  services/src/you/
  provider/
  provider-node/

docs/you/
tests/you/

future isolated packages:
  packages/you-lab/
  packages/you-render/
```

Exact physical placement is determined by existing repository layering and TL-controlled Work Orders.

## UI rule

Follow `DESIGN.md`.

Use repository typography tokens.

Reuse existing UI components before adding new primitives.

## Dependency rule

Workers may add dependencies only inside their owned package manifests. The TL serializes root lockfile reconciliation and verifies the resulting graph.
