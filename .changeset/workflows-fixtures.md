---
"@ikenga/contract": patch
---

Add manifest-v5 fixtures for `workflows[]` (valid/workflows-basic,
valid/workflows-multi, invalid/workflows-bad-handler) so the shell's
`manifest_v5_parity` workflow test stops relying on its local stand-in.
Test fixtures only; no runtime change.
