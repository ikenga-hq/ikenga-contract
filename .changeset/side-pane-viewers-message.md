---
"@ikenga/contract": patch
---

`ui.side_pane_viewers` now rejects with the same canonical message as the shell's Rust parser (G-MANIFEST-V5 §8 Q1 / DEC-34), instead of Zod's generic `never` text.
