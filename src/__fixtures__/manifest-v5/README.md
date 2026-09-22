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
| `alias/`  | Parses successfully; on the shell side the `ui.nav`→`ui.views` alias mapping applies (§4) |

`alias/nav-only.json` declares `ikenga_api: "1"` on purpose — the real-world
alias population is the api=1..4 pkgs still declaring `ui.nav`.

`valid/v4-manifest.json` and `valid/nav-and-views.json` also carry `ui.nav`:
they are parse-verdict fixtures (both parse on both sides); the alias *mapping*
assertion lives in `alias/`.
