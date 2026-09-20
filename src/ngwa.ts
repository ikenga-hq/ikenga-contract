// Ngwa — the unified "installed thing" item, frozen as gate G-NGWA-ITEM
// (`plans/shell-ux-rearchitecture/drafts/ngwa-item.md` §2, Round 11).
//
// One `NgwaItem` joins five subsystems that no command joins today: the pkg
// kernel (`InstalledSummary`), the Ọba Claude-asset store (`ClaudeStoreEntry`),
// the engine-config scan (`claude_config.rs`), the `engine_assets` registry,
// and trust (`pkg/trust.rs` + `commands/pkg_trust.rs`). None of the five is a
// superset of another, so this type is a join, not a rename of any one of them.
//
// Producer: the Rust `ngwa_snapshot` command (WP-14). Consumers: WP-15
// installed+store, WP-16 scopes+health, WP-17 item detail, WP-18 trust sheet.
//
// KEY CASING IS `snake_case`, deliberately. The producer is a Rust command
// whose neighbouring struct (`InstalledSummary`) serializes with serde defaults
// and no renames; Ọba's camelCase renames are the exception in this codebase,
// not the rule, and matching serde defaults keeps `ngwa_snapshot` free of a
// rename attribute per field.
//
// The draft is FROZEN: any change to the shape below needs a new round in
// `04-discussion.md`, not an edit here.

import { z } from 'zod';

// ── Kind ──────────────────────────────────────────────────────────────────

/** Eleven kinds — two more than D-02's locked Kind facet. `bundle` and
 *  `sidecar` are real in the code (`Kind::Bundle`, `SidecarSpec`) and reachable
 *  through *More filters*; `workflow` has no producer in Phase 2 (Phase 4 /
 *  G-MANIFEST-V5) but stays in the union so adding one is not a contract break.
 *  `project` and `artifact` from the older `ngwa-surface.html` are NOT here —
 *  neither is in the locked facet list and neither has a producer. */
export const NGWA_KINDS = [
  'app', 'engine', 'tool', 'sidecar',        // from the pkg kernel
  'skill', 'agent', 'command', 'hook',       // from Ọba + the engine-config scan
  'bundle',                                  // Ọba bundle, or a pkg that only pulls requires[]
  'schedule',                                // manifest cron[]
  'workflow',                                // Phase 4 — no producer in Phase 2
] as const;
export const NgwaKindSchema = z.enum(NGWA_KINDS);
export type NgwaKind = (typeof NGWA_KINDS)[number];

// ── Scope ─────────────────────────────────────────────────────────────────

/** `personal` is the kernel's `project_id: null` and Ọba's `workspace`. */
export const NgwaScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('personal') }),
  z.object({ kind: z.literal('project'), project_id: z.string() }),
]);
export type NgwaScope = z.infer<typeof NgwaScopeSchema>;

// ── Source (provenance) ───────────────────────────────────────────────────

/** The union of the kernel's `InstallSource` (`builtin`/`registry`/`local`/
 *  `dev`) and Ọba's `ProvenanceSource` (`local`/`git`/`npx`/`catalog`). */
export const NGWA_SOURCES = [
  'builtin', 'registry', 'git', 'npx', 'local', 'dev',
  'catalog',   // deprecated Ọba back-compat only (claude_store.rs:94-109)
] as const;
export const NgwaSourceSchema = z.enum(NGWA_SOURCES);
export type NgwaSource = z.infer<typeof NgwaSourceSchema>;

/** Provenance. The plan's single `source` string could not hold the url / ref /
 *  resolved version / publisher both provenance records carry, so it became an
 *  object; `origin.source` is the facet value. */
export const NgwaOriginSchema = z.object({
  source: NgwaSourceSchema,
  /** registry url | git remote | npm spec */
  url: z.string().nullable(),
  /** git ref */
  ref: z.string().nullable(),
  /** git SHA | npm version */
  resolved_version: z.string().nullable(),
  /** `InstallSource::Registry.publisher_key`, or catalog publisher */
  publisher: z.string().nullable(),
  /** vault-owned and deletable (Ọba `managed`) */
  managed: z.boolean(),
  auto_update: z.boolean(),
  installed_at_ms: z.number().nullable(),
  updated_at_ms: z.number().nullable(),
});
export type NgwaOrigin = z.infer<typeof NgwaOriginSchema>;

// ── State ─────────────────────────────────────────────────────────────────

export const NGWA_STATES = [
  'enabled', 'disabled', 'available', 'update', 'orphaned', 'broken',
] as const;
export const NgwaStateSchema = z.enum(NGWA_STATES);
export type NgwaState = z.infer<typeof NgwaStateSchema>;

/** Live supervisor state. Only long-lived sidecars / MCP servers have one.
 *  Read from `sidecar_supervisor` directly — `PkgRowV2.state` never does, which
 *  is drift §10.5 that this type fixes for the new surface. */
export const NgwaRuntimeSchema = z.object({
  state: z.enum([
    'spawning', 'running', 'crashed', 'blocked', 'parked', 'stopped', 'shuttingdown',
  ]),
  pid: z.number().nullable(),
  uptime_s: z.number().nullable(),
  restarts: z.number(),
  last_err: z.string().nullable(),
  last_crash_ms: z.number().nullable(),
});
export type NgwaRuntime = z.infer<typeof NgwaRuntimeSchema>;

// ── Trust ─────────────────────────────────────────────────────────────────

/** The four sorted permission lists the trust snapshot hash is taken over
 *  (`trust.rs:61-67`, `159-182`). All-or-nothing: no per-permission row exists
 *  anywhere, which is the constraint WP-18 inherits. */
export const NgwaPermsSummarySchema = z.object({
  shell_execute: z.array(z.string()),
  fs_write_outside_sandbox: z.array(z.string()),
  net: z.array(z.string()),
  vault_keys: z.array(z.string()),
});
export type NgwaPermsSummary = z.infer<typeof NgwaPermsSummarySchema>;

/** Two distinct trust systems exist and must not be conflated: `pkg/trust.rs`
 *  is the per-call sensitive-permission gate (`state`), `commands/pkg_trust.rs`
 *  is the separate boot-time capability-diff review (`review_pending`). The
 *  D-02 facet values are derived, not read off one enum:
 *  `builtin` ← `auto_trusted`; `signed` ← `signed`; `unsigned` ← `!signed &&
 *  state !== 'needs_approval'`; `review` ← `state === 'needs_approval' ||
 *  review_pending`. Ọba primitives get `state: 'not_applicable'`, `perms: null`
 *  — a skill declares intent and is never granted anything. */
export const NgwaTrustSchema = z.object({
  /** Mirrors PkgTrustState; 'not_applicable' for everything that is not a pkg. */
  state: z.enum([
    'auto_trusted', 'auto_granted', 'granted', 'needs_approval', 'not_applicable',
  ]),
  /** manifest `signature` present, or minisign-verified catalog entry */
  signed: z.boolean(),
  /** provenance-trusted (builtin / dev) */
  auto_trusted: z.boolean(),
  /** a TrustReview row is waiting (pkg_trust.rs) */
  review_pending: z.boolean(),
  /** null when state is 'not_applicable' */
  perms: NgwaPermsSummarySchema.nullable(),
  last_granted_at_ms: z.number().nullable(),
});
export type NgwaTrust = z.infer<typeof NgwaTrustSchema>;

// ── Placement ─────────────────────────────────────────────────────────────

/** The real per-instance placement record, sourced primarily from the
 *  `claude_config` scan; `engine_assets` is a second contributor that marks a
 *  placement `managed_by: 'pkg'`. `present === false` on an `enabled` item is
 *  the orphan case WP-16 Health reports. */
export const NgwaPlacementSchema = z.object({
  /** 'claude' | 'gemini' | 'codex' | ... */
  engine: z.string(),
  scope: NgwaScopeSchema,
  path: z.string(),
  mechanism: z.enum(['symlink-dir', 'file', 'settings-key']),
  /** the target actually exists on disk */
  present: z.boolean(),
  link_target: z.string().nullable(),
  /** the link resolves into the Ọba store */
  in_store: z.boolean(),
  managed_by: z.enum(['oba', 'pkg', 'user']),
  /** path of the placement that shadows this one */
  overridden_by: z.string().nullable(),
  format: z.enum(['md-yaml', 'toml', 'json-embedded']).nullable(),
  status: z.enum(['active', 'deprecated']),
});
export type NgwaPlacement = z.infer<typeof NgwaPlacementSchema>;

// ── Usage ─────────────────────────────────────────────────────────────────

/** null on the item means "never measured" and MUST render as "—", never as 0
 *  (designs/frame-workbench-v4.html:2679 — "anything not measured reads —").
 *  Phase 2 sources this from transcript JSONL (DEC-24); `'hooks'` stays a legal
 *  value so a later increment can add it — principally for `hook` rows, which
 *  the transcript cannot see at all — without reopening the gate. */
export const NgwaUsageSchema = z.object({
  source: z.enum(['hooks', 'transcript']),
  last_used_ms: z.number().nullable(),
  count_7d: z.number().nullable(),
  count_30d: z.number().nullable(),
  /** null when the chosen source carries no tokens */
  tokens_30d: z.number().nullable(),
  /** Earliest moment the source can see. Anything before it is unknown, not zero. */
  window_start_ms: z.number(),
});
export type NgwaUsage = z.infer<typeof NgwaUsageSchema>;

// ── Dependency edges ──────────────────────────────────────────────────────

export const NgwaRefSchema = z.object({
  /** open, mirroring RequiresEntry.kind (manifest.rs:177-192) */
  kind: z.union([NgwaKindSchema, z.string()]),
  name: z.string(),
  /** resolved NgwaItem.id, or null if unresolved */
  item_id: z.string().nullable(),
  source: NgwaSourceSchema.nullable(),
  ref: z.string().nullable(),
});
export type NgwaRef = z.infer<typeof NgwaRefSchema>;

// ── The item ──────────────────────────────────────────────────────────────

export const NgwaItemSchema = z.object({
  /** Stable across a refresh. Pkg-backed: the manifest id. Everything else:
   *  `${kind}:${scope_key}:${name}` where scope_key is 'personal' | `project:<id>`. */
  id: z.string(),
  kind: NgwaKindSchema,
  /** the on-disk / manifest name (stable, used for joins) */
  name: z.string(),
  /** manifest `name`, else `name` */
  display_name: z.string(),
  description: z.string().nullable(),
  /** null for Ọba primitives with no resolved version */
  version: z.string().nullable(),
  /** registry index only; null otherwise */
  latest_version: z.string().nullable(),
  scope: NgwaScopeSchema,
  origin: NgwaOriginSchema,
  state: NgwaStateSchema,
  runtime: NgwaRuntimeSchema.nullable(),
  trust: NgwaTrustSchema,
  /** An item with no placements is not an error: a pkg app has none. */
  placements: z.array(NgwaPlacementSchema),
  /** null = unmeasured. A measured zero is `{ count_7d: 0, … }`; the UI must
   *  distinguish them. */
  usage: NgwaUsageSchema.nullable(),
  requires: z.array(NgwaRefSchema),
  /** Computed per snapshot by inverting `requires[]`, never stored — Ọba
   *  deliberately does not persist the reverse graph (claude_store.rs:120-122). */
  required_by: z.array(NgwaRefSchema),
  /** The pkg that contributed this item, when it is not itself a pkg. */
  owner_pkg_id: z.string().nullable(),
  install_path: z.string().nullable(),
  /** Engines this item is placed in, derived from placements[]. Facet source. */
  engines: z.array(z.string()),
});
export type NgwaItem = z.infer<typeof NgwaItemSchema>;

/** Per-source health entry, so the UI can say "Ọba unreadable" instead of
 *  silently rendering "no skills". */
export const NgwaSourceHealthSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  count: z.number(),
});
export type NgwaSourceHealth = z.infer<typeof NgwaSourceHealthSchema>;

export const NgwaSnapshotSchema = z.object({
  /** `id` is unique within a snapshot; WP-14 asserts uniqueness. */
  items: z.array(NgwaItemSchema),
  as_of_ms: z.number(),
  /** Per-source health, so the UI can say "Ọba unreadable" instead of "no skills". */
  sources: z.object({
    kernel: NgwaSourceHealthSchema,
    oba: NgwaSourceHealthSchema,
    engine_config: NgwaSourceHealthSchema,
    engine_assets: NgwaSourceHealthSchema,
    trust: NgwaSourceHealthSchema,
    usage: NgwaSourceHealthSchema,
  }),
});
export type NgwaSnapshot = z.infer<typeof NgwaSnapshotSchema>;
