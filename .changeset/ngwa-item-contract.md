---
"@ikenga/contract": minor
---

Add the `NgwaItem` contract (`./ngwa` subpath, also re-exported from the root
barrel). Frozen gate G-NGWA-ITEM: `NGWA_KINDS`/`NgwaKind`, `NgwaScope` (a
two-arm union discriminated on `kind`), `NGWA_SOURCES`/`NgwaSource`,
`NgwaOrigin`, `NGWA_STATES`/`NgwaState`, `NgwaRuntime`, `NgwaTrust`,
`NgwaPermsSummary`, `NgwaPlacement`, `NgwaUsage`, `NgwaRef`, `NgwaItem` and the
`NgwaSnapshot` envelope with per-source health — each as a Zod schema plus its
inferred type.

`NgwaItem` is the unified "installed thing" row joining the pkg kernel, the Ọba
Claude-asset store, the engine-config scan, the `engine_assets` registry and
trust, which no single command joins today. Keys are `snake_case` to match the
Rust producer's serde defaults. Additive only — no existing export changes.
