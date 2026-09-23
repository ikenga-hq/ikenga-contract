---
"@ikenga/contract": minor
---

Remove the `ui.nav` → `ui.views` alias (DEC-37 hard cutover). The alias had a
one-release lifetime (G-MANIFEST-V5 §4) and v0.12.0 of the shell was the
soft-warn release, so `ui.nav` is now rejected outright with the canonical
message naming `ui.views[]` as the replacement.

**BREAKING for manifests still on `ui.nav`** — including api=1..4 manifests;
the api version does not exempt them. `NavEntrySchema` stays exported for
tooling that reads historical manifests.
