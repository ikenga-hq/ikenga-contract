---
"@ikenga/contract": minor
---

Add the `scope_check_unavailable` RPC error code, so a pkg can tell "denied" (`scope_denied`: its manifest doesn't declare the scope) from "couldn't check" (the shell's kernel or manifest read failed; the call is refused, but a retry may succeed). Its `error.data` is `ScopeCheckUnavailableData`. Also new: `RPC_ERROR_CODES` and `isRpcErrorCode` for runtime checks, and for `host.*` verbs the `HostCallRefusal` shape (`reason: 'scope-denied' | 'check-unavailable'`) with a `hostRefusalCode()` helper that maps a refusal to its RPC code. `hostRefusalCode()` returns `null` for a refusal without a known `reason` (unknown, not a confirmed denial). Existing codes and types are unchanged. The shell starts sending the new code and reasons in a follow-up release; until then no shell emits `scope_check_unavailable` / `check-unavailable`.
