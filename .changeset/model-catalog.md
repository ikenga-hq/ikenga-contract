---
"@ikenga/contract": minor
---

Add a Claude model catalog at `@ikenga/contract/models` (also exported from the package root): `MODEL_CATALOG` with ids, tier aliases, context windows and verified per-million-token prices (input, output, cache read, 5-minute cache write), plus `defaultModelFor(role)` for the `chi`, `pane` and `plan` launch roles, `MODEL_TIER_ALIASES`, `findModel` and `estimateCostUsd`. A generated JSON copy ships at `schemas/models.json`, described by `schemas/models/catalog-v1.json`, for the Rust shell and pkg manifests; `pnpm generate:schemas` writes it and a test fails when it is stale.
