---
"@ikenga/contract": minor
---

Add an optional `ui.context_actions[].key` (a package key request, DEC-54 / G-PKG-KEY) and type `ui.command_palette[].action` as the package run union (`dispatch` | `view`, previously `z.unknown()`) per G-ACTIONS §7 and §12 (`plans/shell-ux-rearchitecture/drafts/actions-schema.md`, frozen Round 39). Both additions are additive on manifest api 5 — no version bump — but `ContextActionEntrySchema` is `.strict()`, so a manifest declaring `key` is rejected by every contract/shell parser that predates this change, whatever `ikenga_api` it declares. Also exports `deriveContextActionKeyWhen`, the pure `ContextSelector` → derived key `when` function from G-ACTIONS §7.3 (mirrored in `shell/src-tauri/src/pkg/manifest.rs` as `derive_context_action_key_when`).
