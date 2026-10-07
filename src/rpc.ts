// Shell ↔ pkg RPC. Same envelope on both transports:
//  - iframe pkgs: postMessage over MessageChannel
//  - mounted pkgs: direct function call on the host bus
//
// Methods are namespaced by capability area. The kernel enforces scopes
// declared in the pkg manifest before dispatching.

export const CONTRACT_VERSION = 1 as const;

// ---------- Envelope ----------

export interface RpcRequest<TParams = unknown> {
  v: typeof CONTRACT_VERSION;
  id: string;
  method: string;
  params: TParams;
}

export interface RpcResponseOk<TResult = unknown> {
  v: typeof CONTRACT_VERSION;
  id: string;
  result: TResult;
}

export interface RpcResponseErr {
  v: typeof CONTRACT_VERSION;
  id: string;
  error: { code: RpcErrorCode; message: string; data?: unknown };
}

export type RpcResponse<T = unknown> = RpcResponseOk<T> | RpcResponseErr;
export type RpcMessage = RpcRequest | RpcResponse;

/** Every `RpcErrorCode`, in declaration order. Use for runtime checks
 *  (`isRpcErrorCode`) and exhaustive switches. Adding a code is a
 *  backward-compatible (minor) contract change; removing one is breaking.
 *
 *  - `method_not_found`        — no handler for `method`
 *  - `invalid_params`          — `params` failed validation
 *  - `scope_denied`            — the shell read the pkg's manifest and it does
 *                                not declare the scope/capability the call
 *                                needs. A definite "no": retrying won't help;
 *                                the pkg must declare the scope.
 *  - `scope_check_unavailable` — the shell could not *check* the capability
 *                                (kernel status or manifest read failed). The
 *                                call is still refused (fail-closed), but this
 *                                is NOT a denial: the pkg may hold the scope,
 *                                and a retry can succeed. `error.data` is
 *                                `ScopeCheckUnavailableData`.
 *  - `pkg_not_authenticated`   — the pkg has no session / credential
 *  - `shell_unavailable`       — the shell itself (or the transport) is not
 *                                reachable. Distinct from
 *                                `scope_check_unavailable`, where the shell
 *                                answered but its capability lookup failed.
 *  - `internal_error`          — anything else */
export const RPC_ERROR_CODES = [
  'method_not_found',
  'invalid_params',
  'scope_denied',
  'scope_check_unavailable',
  'pkg_not_authenticated',
  'shell_unavailable',
  'internal_error',
] as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[number];

export function isRpcErrorCode(v: unknown): v is RpcErrorCode {
  return typeof v === 'string' && (RPC_ERROR_CODES as readonly string[]).includes(v);
}

/** `error.data` for `scope_check_unavailable`. Every field is optional, so a
 *  shell may send the code with no data at all. */
export interface ScopeCheckUnavailableData {
  /** The scope or capability that could not be checked, e.g. `tasks:read`
   *  or `capabilities.sqlite`. */
  scope?: string;
  /** Why the check couldn't run (the kernel / manifest read error text).
   *  Diagnostic only; don't match on it. */
  detail?: string;
  /** Always `true` when present: a later call may succeed. */
  retryable?: true;
}

// ---------- host.* verb refusals ----------
//
// `host.*` verbs (dispatched FE-side by the iframe host, invoked from the
// iframe via `app.callServerTool`) don't use the RPC envelope above. A refused
// call resolves with `isError: true` and a `structuredContent` shaped like
// `HostCallRefusal`. `reason` is additive: older shells omit it, and some
// denials carry only `error`. A refusal without a known `reason` is "unknown"
// (`hostRefusalCode()` returns null), not a confirmed denial. Pkgs should
// branch on `reason` (or on `hostRefusalCode()`), never on the `error` text.
//
// Shell adoption follows this contract release: until then no shell sends
// `check-unavailable`, and only some verbs send `scope-denied`.

/** Why the shell refused a `host.*` call's capability check.
 *  - `scope-denied`      — same meaning as RPC `scope_denied`
 *  - `check-unavailable` — same meaning as RPC `scope_check_unavailable`
 *  Dispatch outcomes some verbs report in `reason` (e.g. `'unavailable'`,
 *  `'cancelled'`, `'failed'`) are about the action, not the capability check,
 *  and are deliberately not members. */
export const HOST_REFUSAL_REASONS = ['scope-denied', 'check-unavailable'] as const;
export type HostRefusalReason = (typeof HOST_REFUSAL_REASONS)[number];

export const HOST_REFUSAL_REASON_TO_RPC_CODE: Readonly<Record<HostRefusalReason, RpcErrorCode>> = {
  'scope-denied': 'scope_denied',
  'check-unavailable': 'scope_check_unavailable',
};

/** `structuredContent` of a refused `host.*` call. */
export interface HostCallRefusal {
  ok: false;
  /** Human-readable message (the same text as `content[0].text`). Some
   *  refusals (e.g. `host.notify` scope-denied) carry only `reason`. */
  error?: string;
  /** Set where it distinguishes the case. Absent on refusals that predate it
   *  (and, until the shell adopts this contract, on some current denials):
   *  treat those as unknown, not as a confirmed denial. Treat any other value
   *  (a newer shell's, or a dispatch outcome) like absence. */
  reason?: HostRefusalReason | (string & {});
}

/** Map a `host.*` call's `structuredContent` to the matching `RpcErrorCode`,
 *  or `null` when it isn't a refusal with a known `reason` (including
 *  reason-less refusals: unknown, not denied). Lets a pkg handle both
 *  transports with one switch:
 *
 *    switch (hostRefusalCode(res.structuredContent)) {
 *      case 'scope_denied':            // declare the scope
 *      case 'scope_check_unavailable': // transient: retry / show "couldn't check"
 *      default:                        // null: unknown refusal — show `error`
 *    } */
export function hostRefusalCode(structuredContent: unknown): RpcErrorCode | null {
  if (!structuredContent || typeof structuredContent !== 'object') return null;
  const sc = structuredContent as { ok?: unknown; reason?: unknown };
  if (sc.ok !== false || typeof sc.reason !== 'string') return null;
  if (!(HOST_REFUSAL_REASONS as readonly string[]).includes(sc.reason)) return null;
  return HOST_REFUSAL_REASON_TO_RPC_CODE[sc.reason as HostRefusalReason];
}

// ---------- Notifications (one-way, pkg → shell or shell → pkg) ----------

export interface RpcNotification<TParams = unknown> {
  v: typeof CONTRACT_VERSION;
  notify: string;
  params: TParams;
}

// ---------- Method catalogue ----------
//
// Adding a method is a contract change. Removals require a deprecation
// period across two contract minor versions.

export interface RpcMethods {
  // identity
  'identity.whoami': { req: void; res: { user_id: string; tenant_id: string | null } };

  // pkg → engine
  'engine.start_session': {
    req: { systemPrompt?: string; toolAllowList?: string[] };
    res: { sessionId: string };
  };
  'engine.stream': {
    req: { sessionId: string; input: string };
    res: { ok: true }; // events delivered via 'engine.event' notifications
  };
  'engine.cancel': { req: { sessionId: string }; res: { ok: true } };

  // shell chrome
  'shell.notify': { req: { title: string; body?: string; level?: 'info' | 'warn' | 'error' }; res: void };
  'shell.open_pane': {
    req: { route?: string; pkg_id?: string; split?: 'horizontal' | 'vertical' };
    res: { pane_id: string };
  };

  // tasks (capability: tasks:read / tasks:write)
  'tasks.list': { req: { status?: string; owner?: string }; res: unknown[] };
  'tasks.create': { req: { subject: string; description?: string }; res: { id: string } };

  // email drafts
  'email_drafts.list': { req: { status?: string }; res: unknown[] };
  'email_drafts.create': { req: { subject: string; body_html: string; to: string[] }; res: { id: string } };
}

// Notifications: shell → pkg
export interface ShellToPkgNotifications {
  'engine.event': { sessionId: string; event: import('./engine/index.js').EngineEvent };
  'shell.theme_changed': { theme: 'light' | 'dark' };
  'shell.pane_focused': { focused: boolean };
}

// ---------- Helpers ----------

export type RpcMethodName = keyof RpcMethods;
export type RpcParams<M extends RpcMethodName> = RpcMethods[M]['req'];
export type RpcResult<M extends RpcMethodName> = RpcMethods[M]['res'];
