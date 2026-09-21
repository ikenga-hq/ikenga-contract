---
"@ikenga/contract": patch
---

Correct `CONTRACT_PACKAGE_VERSION`, which had drifted to `0.5.0` while the
package shipped `0.18.0`. Any consumer doing a runtime contract-version check
was reading a stale constant.
