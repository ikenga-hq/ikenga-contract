---
"@ikenga/contract": patch
---

Manifest schema: `capabilities.sqlite` now accepts a boolean as well as an object. Zod-side mirror of the shell's Rust manifest relaxation (#179), so a pkg declaring `"sqlite": true` validates identically in both parsers.
