---
"@ikenga/contract": minor
---

Publish a JSON Schema for the pkg manifest at `schemas/manifest/v5.json` (it ships in the npm package), generated from `ManifestSchema` by `pnpm generate:schemas`. A new test fails when the committed file is out of date. The registry index schema gains an optional `ngwaKind` on each row: what the pkg actually is (app, engine, tool, sidecar, skill or bundle), derived from its manifest when the index is written. Existing readers ignore the new field.
