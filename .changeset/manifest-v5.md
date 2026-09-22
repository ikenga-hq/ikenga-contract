---
'@ikenga/contract': minor
---

Manifest v5 (G-MANIFEST-V5, frozen 2026-09-22): add the `ui.views[]`,
`ui.explorer_sections[]` (+ the `ExplorerSectionData` wire shape),
`ui.companion_panels[]`, `ui.context_actions[]`, and `ui.widgets[]`
contribution blocks; mark `ui.nav` a deprecated one-release alias;
hard-retire `ui.side_pane_viewers` (declaring it now fails validation);
enforce `views[].route` ⊆ `ui.routes[]` paths via superRefine.
`IKENGA_API_VERSION` 4 → 5; the support window stays `[1, CURRENT]`, so
api=1..4 manifests parse unchanged. Ships the `src/__fixtures__/manifest-v5/`
fixture set (valid / invalid / alias) for the shell-side Rust↔Zod parity test.
