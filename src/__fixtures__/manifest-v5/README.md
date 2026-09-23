# manifest-v5 fixtures

Fixture set for the manifest v5 schema (G-MANIFEST-V5,
`plans/shell-ux-rearchitecture/drafts/g-manifest-v5.md`, frozen 2026-09-22).
Produced by WP-27 (`@ikenga/contract`); consumed by WP-28's Rust↔Zod parity
test in the shell repo.

## Contract

Every `*.json` file is a complete pkg `manifest.json`. Parse verdict by folder:

| Folder    | Expected verdict (`ManifestSchema.parse` / Rust `Manifest` parse) |
|-----------|------------------------------------------------------------------|
| `valid/`  | Parses successfully                                               |
| `invalid/`| Fails to parse                                                    |

The `alias/` folder is gone: DEC-37 closed the one-release `ui.nav` → `ui.views`
alias window (§4), so a manifest declaring `ui.nav` is now rejected on both
sides. The two former alias-window fixtures moved into `invalid/`:

- `invalid/nav-only.json` — declares `ikenga_api: "1"` on purpose; an api=1..4
  pkg still on `ui.nav` is exactly the population the cutover breaks, and the
  api version does not exempt it.
- `invalid/nav-and-views.json` — declaring both is rejected too; there is no
  "views win" precedence any more.

`valid/v4-manifest.json` is still a v4 parse-verdict fixture, but now declares
`ui.views[]` rather than `ui.nav`.
