// Ikenga pkg manifest schema — mirrors the Rust schema in
// `ikenga-hq/ikenga` at `src-tauri/src/pkg/manifest.rs`.
//
// Source of truth is the Rust struct. This zod schema is used by the CLI,
// registry, and tooling for client-side parse + validation. Field changes
// MUST be made in lockstep with the Rust struct, and IKENGA_API_VERSION
// must be bumped if semantics change in a non-additive way.
//
// On disk: `<pkg-root>/manifest.json` (JSON, not TOML).

import { z } from 'zod';
import { EngineProvidesSchema } from './engine/index.js';
import { BrowserEngineSchema } from './browser.js';

// v2 (WP-05): added capabilities.sqlite + permissions["sqlite.tables"];
// permissions["supabase.tables"] kept as a compat alias for api=1 manifests.
// v3 (ADR-017): added capabilities.http / .secrets / .invoke (trusted-cap tier)
// + top-level optional `signature`. All additive; api=1/2 manifests parse
// unchanged. Elevated caps are inert unless the pkg is trusted.
// v5 (WP-27, G-MANIFEST-V5 — plans/shell-ux-rearchitecture/drafts/g-manifest-v5.md,
// frozen 2026-09-22 Round 24): added ui.views[] / ui.explorer_sections[] (+ the
// ExplorerSectionData wire shape) / ui.companion_panels[] / ui.context_actions[] /
// ui.widgets[]; ui.nav was a deprecated alias for one shell release (shell-side
// mapping, §4) and is now hard-retired by DEC-37 — declaring it fails validation,
// as does ui.side_pane_viewers (§8 Q1 / DEC-34). All additions are optional-with-default, so api=1..4 manifests
// parse unchanged; the support window stays [MIN_SUPPORTED, CURRENT].
// WP-51 (G-PKG-KEY / G-ACTIONS §7, §12 — plans/shell-ux-rearchitecture/drafts/
// actions-schema.md, frozen 2026-09-25 Round 39): added an optional
// `ui.context_actions[].key` (a DEC-54 key request) and typed
// `ui.command_palette[].action` as `ContextActionRunSchema` (was
// `z.unknown()`). Both are additive on api 5 — no version bump — but `key`
// sits on a `.strict()` object, so a manifest declaring it is rejected by
// every parser that predates this change, whatever `ikenga_api` it declares
// (g-manifest-v5 §11; the same caveat class as `workflows[]`, §10).
export const IKENGA_API_VERSION = 5 as const;
export const IKENGA_API_MIN_SUPPORTED = 1 as const;

// ---------- Sub-schemas ----------

export const AuthorSchema = z.object({
  name: z.string(),
  key: z.string().optional(),
});

export const McpServerSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  /** "per-call" (default) | "long-lived" */
  lifecycle: z.enum(['per-call', 'long-lived']).optional(),
  /** Phase 9: glob patterns relative to pkg dir; supervisor restarts the
   * long-lived child 250 ms after any matched file changes. Per-call entries
   * ignore this. Empty = no watcher. */
  restart_when_changed: z.array(z.string()).default([]),
  /** Phase 9: auto-restart on unexpected exit. Default true (existing
   * supervisor behavior). Set false for one-shot long-lived tools. Per-call
   * entries ignore this. */
  auto_restart: z.boolean().default(true),
});
export type McpServer = z.infer<typeof McpServerSchema>;

export const SidecarSpecSchema = z.object({
  /** Must start with `pa-<pkg-slug>-` (slug = id with `.` → `-`). */
  name: z.string(),
  /** Path inside pkg dir; may contain `{target}` (host triple). */
  bin: z.string(),
  /** "json" (default) | "raw" */
  stdio: z.string().default('json'),
  /** Phase 9: glob patterns relative to pkg dir; supervisor restarts the
   * sidecar 250 ms after any matched file changes. Empty = no watcher. */
  restart_when_changed: z.array(z.string()).default([]),
  /** Phase 9: auto-restart on unexpected exit. Default true (existing
   * supervisor behavior). Set false for one-shot tools. */
  auto_restart: z.boolean().default(true),
});
export type SidecarSpec = z.infer<typeof SidecarSpecSchema>;

export const PermissionsSchema = z.object({
  'shell.execute': z.array(z.string()).default([]),
  'fs.read': z.array(z.string()).default([]),
  'fs.write': z.array(z.string()).default([]),
  net: z.array(z.string()).default([]),
  /** Local SQLite table patterns; validated against tables.json at install time.
   *  For api ≥ 2 manifests. Replaces `supabase.tables`. */
  'sqlite.tables': z.array(z.string()).default([]),
  /** @deprecated api=1 compat alias for `sqlite.tables`. New manifests should
   *  use `sqlite.tables` instead. Kept so ikenga_api="1" manifests parse
   *  without errors during the transition window. */
  'supabase.tables': z.array(z.string()).default([]),
  'vault.keys': z.array(z.string()).default([]),
  /** Engine scopes exercisable from the pkg iframe. `"invoke"` gates the
   *  FE-side host.sendToActiveSession / host.startChatSession verbs
   *  (pkgDeclaresScope). Mirrors `Permissions.engine` in the shell's
   *  manifest.rs — keep in lockstep. */
  engine: z.array(z.string()).default([]),
  /** Notification scopes. `"send"` gates the FE-side `host.notify` verb
   *  (pkgDeclaresScope), which raises a real OS notification and therefore
   *  reaches the user even when Ikenga is not the focused window — which is
   *  why it is gated at all. Mirrors `Permissions.notify` in the shell's
   *  manifest.rs — keep in lockstep. */
  notify: z.array(z.string()).default([]),
  events: z.array(z.string()).default([]),
}).default({});

export const NavEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  section: z.string().optional(),
  route: z.string(),
});

export const UiRouteSchema = z.object({
  path: z.string(),
  /** "iframe" | "component" | "webview" (component is builtin-only) */
  kind: z.enum(['iframe', 'component', 'webview']),
  /** iframe/webview: URL or pkg-relative html path. component: identifier. */
  source: z.string(),
  partition: z.string().optional(),
});

export const SidePaneViewerSchema = z.object({
  id: z.string(),
  label: z.string(),
  route: z.string(),
});

export const ManifestUiSessionSchema = z.object({
  persistence: z.enum(['keep', 'clear-on-exit', 'ask']),
});
export type ManifestUiSession = z.infer<typeof ManifestUiSessionSchema>;

// ---------- Manifest v5 contribution blocks ----------
// Frozen type block from G-MANIFEST-V5 §2
// (plans/shell-ux-rearchitecture/drafts/g-manifest-v5.md, frozen 2026-09-22,
// Round 24 / DEC-34). Copied verbatim — do not reinterpret. `UiBlock` gains
// `views`, `explorer_sections`, `companion_panels`, `context_actions`,
// `widgets` (all optional-with-default). `nav` kept its field and type for the
// one-release alias window; DEC-37 closed that window and now rejects it.

// ── ui.views[] — replaces ui.nav (alias window closed, §4 / DEC-37) ───────
export const ViewEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),          // lucide name; same vocabulary as pins
  /** A pkg UI namespace path, e.g. `/grid` → pane route `pkg://<id>/grid`.
   *  Must match a declared `ui.routes[]` path (§6 Q3). */
  route: z.string(),
  /** Honoured ONCE, at first install (Round 2 Q1). Updates never re-pin;
   *  unpin is permanent. Kernel "first install" = no prior install row. */
  pin_on_install: z.boolean().default(false),
}).strict();
export type ViewEntry = z.infer<typeof ViewEntrySchema>;

// ── ui.explorer_sections[] — Project Explorer sections (G-STATE §1 id rule) ─
export const ExplorerSectionEntrySchema = z.object({
  id: z.string(),                       // pkg-local; state id = `${pkg_id}:${id}`
  title: z.string(),
  icon: z.string().optional(),
  order: z.number().int().optional(),   // default: declaration order; ties by pkg id
  /** GET iyke route under `/pkg/<id>/` returning ExplorerSectionData. */
  data_route: z.string(),
}).strict();
export type ExplorerSectionEntry = z.infer<typeof ExplorerSectionEntrySchema>;

/** The JSON a `data_route` returns. The shell renders it natively — the
 *  section is data, never an embedded iframe (P4 fix, discussion §3.2). */
export const ExplorerSectionDataSchema = z.object({
  rows: z.array(z.object({
    id: z.string(),
    label: z.string(),
    badge: z.object({
      count: z.number().int().optional(),
      tooltip: z.string().optional(),
    }).optional(),
    /** Pane target on click: a pkg route (`pkg://...`) or a shell route (`/...`). */
    open: z.string().optional(),
  })).default([]),
  as_of_ms: z.number().optional(),
}).strict();
export type ExplorerSectionData = z.infer<typeof ExplorerSectionDataSchema>;

// ── ui.companion_panels[] — Companion state panels (ADR-021: state only) ───
export const CompanionPanelEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  /** Pane route rendered in the panel slot (an iframe view). Must render
   *  state, never model prose — ADR-021 checklist applies. */
  route: z.string(),
  /** When true the shell threads `panelScopeSessionId` (the selected
   *  Companion session tab) through the AppBridge hostContext. */
  session_scoped: z.boolean().default(false),
}).strict();
export type CompanionPanelEntry = z.infer<typeof CompanionPanelEntrySchema>;

// ── ui.context_actions[] — selector-scoped menu contributions ─────────────
export const ContextSelectorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), glob: z.string().optional() }),
  z.object({ kind: z.literal('artifact') }),
  z.object({ kind: z.literal('session') }),
  z.object({ kind: z.literal('ngwa-item'), kinds: z.array(z.string()).optional() }),
]);
export type ContextSelector = z.infer<typeof ContextSelectorSchema>;

export const ContextActionRunSchema = z.discriminatedUnion('kind', [
  /** "Hand to Chi" — fills the Companion dispatch bar (spec §5.3 resolveTarget).
   *  `prompt` is a template over the six-variable D-06 set: {{file.path}},
   *  {{file.name}}, {{selection}}, {{project.root}}, {{pane.url}}, {{branch}}
   *  — {{file.name}} added additively by WP-51 (DEC-63.4, G-ACTIONS §8.2). */
  z.object({ kind: z.literal('dispatch'), prompt: z.string(), target: z.string().optional() }),
  z.object({ kind: z.literal('view'), route: z.string() }),
]);
export type ContextActionRun = z.infer<typeof ContextActionRunSchema>;

export const ContextActionEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  when: ContextSelectorSchema,
  run: ContextActionRunSchema,
  /** A DEC-54 key request (G-PKG-KEY, G-ACTIONS §7): a single stroke in the
   *  registry grammar, never a chord. The request's `when` is NOT authored
   *  here — it is derived deterministically from `when` above (the
   *  ContextSelector) per G-ACTIONS §7.3, and is always narrower than
   *  `always` and never OS-wide. Granted only if the key is free at merge
   *  time (G-ACTIONS §7.4); otherwise the action arrives unbound. Older
   *  shells (pre-WP-51) reject a manifest declaring this field outright,
   *  since `ContextActionEntry` is `.strict()` / `deny_unknown_fields`
   *  (g-manifest-v5 §11). */
  key: z.string().optional(),
}).strict();
export type ContextActionEntry = z.infer<typeof ContextActionEntrySchema>;

/** Escapes a string for embedding in a single-quoted DEC-62 `when` string
 *  literal (grammar §4.1: `\'` and `\\` are the only escapes). */
function escapeWhenString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** G-ACTIONS §7.3 — derives a `ContextActionEntry.key` request's `when`
 *  (DEC-62 form) from its `ContextSelector`. Every arm is narrower than
 *  `always` by construction, so the result is always a well-formed `when`
 *  `conflicts()` (WP-49/WP-52) can compare. This is the key `when` only —
 *  never used for menu-visibility placement `when` (§7.3a, WP-52). Mirrors
 *  `derive_context_action_key_when` in `shell/src-tauri/src/pkg/manifest.rs`;
 *  keep the two in lockstep. */
export function deriveContextActionKeyWhen(selector: ContextSelector): string {
  switch (selector.kind) {
    case 'file':
      return selector.glob
        ? `filesFocus && resource =~ '${escapeWhenString(selector.glob)}'`
        : 'filesFocus';
    case 'artifact':
      return "paneKind == 'artifact'";
    case 'session':
      return 'sessionFocus';
    case 'ngwa-item': {
      const kinds = selector.kinds ?? [];
      if (kinds.length === 0) return 'ngwaItemFocus';
      const clause = kinds
        .map((k) => `ngwaItemKind == '${escapeWhenString(k)}'`)
        .join(' || ');
      return `ngwaItemFocus && (${clause})`;
    }
  }
}

// ── ui.command_palette[].action — typed per G-ACTIONS §12 (G-70) ──────────
// G-MANIFEST-V5 §8 Q3 left `action` untyped "until Phase 6 — D-06 owns the
// action model" (`action: z.unknown()`). G-ACTIONS §12 types it as the same
// package run union as `context_actions[]`. Strict, not tolerant: a sweep of
// `ikenga-pkgs/` (57 manifests) and `ikenga-registry/` (30 catalog entries)
// at the freeze found zero uses of `command_palette`, so there is no
// published payload a strict type could break (G-ACTIONS §12).
export const CommandPaletteEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  /** A DEC-54 key request (G-ACTIONS §12), handled exactly like
   *  `ContextActionEntry.key`: single stroke, grant-if-free, rebindable.
   *  Its derived `when` is always `!inputFocus`. Unlike `key`, this needs no
   *  older-shell caveat for acceptance — pre-WP-51 parsers already accept
   *  any `action` value and simply ignore `shortcut`. */
  shortcut: z.string().optional(),
  action: ContextActionRunSchema,
}).strict();
export type CommandPaletteEntry = z.infer<typeof CommandPaletteEntrySchema>;

// ── ui.widgets[] — project-dashboard widgets (formalised home canvas) ──────
export const WidgetEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  route: z.string(),                    // iframe view rendered in the dashboard grid
  span: z.enum(['small', 'medium', 'wide']).default('medium'),
}).strict();
export type WidgetEntry = z.infer<typeof WidgetEntrySchema>;

export const UiBlockSchema = z.object({
  /** v5 hard cutover (G-MANIFEST-V5 §4 / DEC-37): the one-release `ui.nav` →
   *  `ui.views` alias window closed with v0.12.0 (the soft-warn release), so
   *  declaring `ui.nav` now fails validation outright. `NavEntrySchema` stays
   *  exported for tooling that reads historical manifests, same as
   *  `SidePaneViewerSchema`. */
  nav: z
    .never({
      message:
        '`ui.nav` was removed in manifest v5 (G-MANIFEST-V5 §4 / DEC-37) — declare `ui.views[]` instead',
    })
    .optional(),
  routes: z.array(UiRouteSchema).default([]),
  command_palette: z.array(CommandPaletteEntrySchema).default([]),
  /** v5 hard-retire (G-MANIFEST-V5 §8 Q1 / DEC-34): `side_pane_viewers` was
   *  removed from the block; declaring it fails validation outright.
   *  `z.never()` carries the same canonical message as the Rust rejection
   *  (skills/commands-bundling precedent). `SidePaneViewerSchema` stays
   *  exported for tooling that reads historical manifests. */
  side_pane_viewers: z
    .never({
      message:
        '`ui.side_pane_viewers` was removed in manifest v5 (G-MANIFEST-V5 §8 Q1) — declare `ui.views[]` or `ui.companion_panels[]` instead',
    })
    .optional(),
  // ── v5 contribution blocks (G-MANIFEST-V5 §2; all optional-with-default) ──
  views: z.array(ViewEntrySchema).default([]),
  explorer_sections: z.array(ExplorerSectionEntrySchema).default([]),
  companion_panels: z.array(CompanionPanelEntrySchema).default([]),
  context_actions: z.array(ContextActionEntrySchema).default([]),
  widgets: z.array(WidgetEntrySchema).default([]),
  /** Per-directive CSP overrides for the iframe content. */
  csp: z.record(z.array(z.string())).optional(),
  /** Per-directive Permission-Policy values. */
  permissions: z.record(z.array(z.string())).optional(),
  session: ManifestUiSessionSchema.optional(),
})
.superRefine((ui, ctx) => {
  // G-MANIFEST-V5 §2b / DEC-34 Q2: a `ViewEntry.route` must reference a path
  // declared in the same manifest's `ui.routes[]`. Companion-panel and widget
  // routes are deliberately NOT reference-checked (§2b scopes the rule to
  // views only).
  const routePaths = new Set(ui.routes.map((r) => r.path));
  ui.views.forEach((view, i) => {
    if (!routePaths.has(view.route)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['views', i, 'route'],
        message: `ui.views[${i}].route "${view.route}" does not match any declared ui.routes[] path`,
      });
    }
  });
})
.default({});
export type UiBlock = z.infer<typeof UiBlockSchema>;

export const SettingsFieldSchema = z.object({
  key: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'secret']),
  label: z.string(),
  default: z.unknown().optional(),
  description: z.string().optional(),
  env: z.string().optional(),
});
export const SettingsBlockSchema = z.object({
  schema: z.array(SettingsFieldSchema).default([]),
});

export const IykeRouteSchema = z.object({
  method: z.enum(['GET', 'POST']),
  /** Must start with `/pkg/<id>/`. */
  path: z.string(),
  /** `sidecar:<name> <sub>` | `event:<name>` */
  handler: z.string(),
});
export const IykeBlockSchema = z.object({
  routes: z.array(IykeRouteSchema).default([]),
  events: z.array(z.string()).default([]),
});

export const CronEntrySchema = z.object({
  id: z.string(),
  /** 6-field cron expression: sec min hour day month dow */
  expr: z.string(),
  handler: z.string(),
  env_from_settings: z.array(z.string()).default([]),
});

export const SqliteCapabilityObjectSchema = z.object({
  /** Logical DB name. Currently only `"ikenga.local"` is supported.
   *  Defaults to `"ikenga.local"` when omitted. */
  db: z.string().default('ikenga.local'),
});

/** Local SQLite capability (api ≥ 2). Threads the logical db name into the
 *  iframe host context so the pkg can call `db_query` without hard-coding it.
 *  Accepts boolean `true` (defaults `db` to `"ikenga.local"`), `false` (disabled),
 *  or an object `{ db?: string }`.
 *  Mirrors `SqliteCapability` in `shell/src-tauri/src/pkg/manifest.rs`. */
export const SqliteCapabilitySchema = z.union([
  z.boolean().transform((v) => (v ? { db: 'ikenga.local' } : undefined)),
  SqliteCapabilityObjectSchema,
]);
export type SqliteCapability = z.infer<typeof SqliteCapabilityObjectSchema>;

/** Supabase capability. Mirrors `SupabaseCapability` in
 *  `shell/src-tauri/src/pkg/manifest.rs`. */
export const SupabaseCapabilitySchema = z.object({
  /** When true, mint fails if the Supabase vault keys are missing; when
   *  false/omitted, missing keys surface as `supabase: null` in host context. */
  required: z.boolean().default(false),
});
export type SupabaseCapability = z.infer<typeof SupabaseCapabilitySchema>;

/** Native child-webview capability. Mirrors `WebviewCapability` in
 *  `shell/src-tauri/src/pkg/manifest.rs`. */
export const WebviewCapabilitySchema = z.object({
  /** Whether this pkg may create child webviews via the kernel. Required for
   *  any `ui.routes[]` entry with `kind = "webview"` to mount. */
  child_webviews: z.boolean().default(false),
  /** Named cookie/data partitions; empty = the implicit "default" partition. */
  partitions: z.array(z.string()).default([]),
  /** Browser engines this pkg may open panes with. `"webkit"` is the in-shell
   *  child-webview; `"chrome"` is Managed mode (installed Chrome over CDP, its
   *  own OS window). Defaults to `["webkit"]` so existing manifests are
   *  unchanged. Mirrors `engines` in `WebviewCapability` (manifest.rs). */
  engines: z.array(BrowserEngineSchema).default(['webkit']),
  /** Origins this pkg's webviews may load. **Absent is permissive** (with a
   *  host-side warning) so pre-v4 manifests keep mounting; `[]` is an explicit
   *  deny-all; entries match exactly, as `*`, or as a `https://*.example.com`
   *  subdomain glob. Mirrors `allowed_origins` in `manifest.rs` — absent and
   *  empty are deliberately distinct, so this must stay `.optional()`, never
   *  `.default([])`. */
  allowed_origins: z.array(z.string()).optional(),
});
export type WebviewCapability = z.infer<typeof WebviewCapabilitySchema>;

/** Agent-ops host-bridge capability (api ≥ 2). Opt-in to the privileged
 *  `host.agentOps.*` verbs (run-now / enable-disable / list-jobs) the shell
 *  exposes for the agent-ops observability pkg — these reach the always-on
 *  cron daemon's localhost trigger endpoint and read the daemon's config +
 *  state files, hops an iframe cannot make itself. Presence of the block is
 *  the gate (mirrors the `capabilities.sqlite` opt-in). Mirrors
 *  `AgentOpsCapability` in `shell/src-tauri/src/pkg/manifest.rs`. */
export const AgentOpsCapabilitySchema = z.object({});
export type AgentOpsCapability = z.infer<typeof AgentOpsCapabilitySchema>;

/** host.fetch capability (ADR-017, TRUSTED-only). Host-mediated HTTP proxy;
 *  the shell makes the request and attaches auth from Stronghold — the key
 *  never enters the iframe. URL allowlist = `permissions.net`. Mirrors
 *  `HttpCapability` in `shell/src-tauri/src/pkg/manifest.rs`. */
export const HttpCapabilitySchema = z
  .object({
    /** Name of a `capabilities.secrets` declaration whose resolved value the
     *  shell attaches as the auth header. Omit = unauthenticated proxy. */
    auth_secret: z.string().optional(),
    /** Header name for the auth secret. Default "Authorization". */
    auth_header: z.string().default('Authorization'),
  })
  .strict();
export type HttpCapability = z.infer<typeof HttpCapabilitySchema>;

/** One named-secret declaration. `vault_key` is resolved host-side and never
 *  reaches the iframe; the iframe sees only `hostContext.secrets[name]`.
 *  Mirrors `NamedSecret` in `shell/src-tauri/src/pkg/manifest.rs`. */
export const NamedSecretSchema = z
  .object({
    name: z.string(),
    /** Vault key (must be within permissions["vault.keys"]). Host-only. */
    vault_key: z.string(),
    /** When true, mount fails if the key is missing (Supabase `required`). */
    required: z.boolean().default(false),
    /** Optional value-format hint: "jwt" | "bearer" | "raw". String, not enum. */
    format: z.string().optional(),
  })
  .strict();
export type NamedSecret = z.infer<typeof NamedSecretSchema>;

/** Named-secret injection capability (ADR-017, TRUSTED-only). Generalizes the
 *  Supabase hostContext handshake. Mirrors `SecretsCapability` in
 *  `shell/src-tauri/src/pkg/manifest.rs`. */
export const SecretsCapabilitySchema = z
  .object({
    declarations: z.array(NamedSecretSchema).default([]),
  })
  .strict();
export type SecretsCapability = z.infer<typeof SecretsCapabilitySchema>;

/** Scoped Tauri invoke passthrough (ADR-017, TRUSTED-only). Presence gates
 *  `host.invoke`; `commands` is the named-command allowlist matched (glob) by
 *  `permissions_check::check_shell_execute` against the `host.invoke` command.
 *
 *  D-06: the allowlist is `invoke`'s OWN field, NOT `permissions["shell.execute"]`.
 *  Reusing `shell.execute` would trip `requires_trust` → the pkg only ever reaches
 *  user-`Granted`, never `AutoTrusted`, so `is_trusted_for_elevated()` is false and
 *  `host.invoke` would always deny. Keeping the allowlist here lets a signed/builtin
 *  pkg declare invokable commands while leaving `shell.execute` empty → AutoTrusted →
 *  elevated. POLICY: named commands only, never `*` (not a general shell).
 *  Mirrors `InvokeCapability` in `shell/src-tauri/src/pkg/manifest.rs`. */
export const InvokeCapabilitySchema = z
  .object({
    commands: z.array(z.string()).default([]),
  })
  .strict();
export type InvokeCapability = z.infer<typeof InvokeCapabilitySchema>;

export const WindowBlockSchema = z.object({
  label: z.string(),
  url: z.string(),
  size: z.tuple([z.number(), z.number()]).optional(),
  decorations: z.boolean().optional(),
  menu: z.string().optional(),
});

export const QueriesBlockSchema = z.object({
  key_prefixes: z.array(z.string()).default([]),
});

/**
 * UI preview screenshot. `path` is relative to the package's install_path
 * for bundled pkgs; the shell resolves it to a webview-loadable URL on
 * render. Registry pkgs surface absolute https:// URLs through the
 * `screenshots` array on the registry entry (see `./registry.ts`).
 */
export const ScreenshotSchema = z.object({
  path: z.string(),
  caption: z.string().optional(),
});
export type Screenshot = z.infer<typeof ScreenshotSchema>;

/** Forward-dependency source for a `requires[]` entry. Mirrors the Rust
 *  `RequireSource` enum (`pkg/manifest.rs`) and the registry `ProvenanceSource`
 *  set. Optional on an entry — absent means the resolver looks the dep up in the
 *  store registry / catalog. */
export const RequireSourceSchema = z.enum(['git', 'npx', 'catalog', 'local']);
export type RequireSource = z.infer<typeof RequireSourceSchema>;

/**
 * One forward-dependency edge (`requires[]` element, ADR-015 §3 / Ọba WP-11).
 * Names a standalone Ọba primitive a pkg `requires`; the resolver (WP-13/14)
 * installs the closure at install/enable. This is a SEPARATE graph from a
 * skill's `SKILL.md` `depends_on` (the G-04 authoring star, `skill-core`-only):
 * a pkg `requires` MAY reference any primitive, and the publish-time lift
 * (WP-12) compiles `depends_on` into this field. `.strict()` mirrors the Rust
 * `deny_unknown_fields` on `RequiresEntry`. Source of truth: the Rust struct in
 * `shell/src-tauri/src/pkg/manifest.rs` — keep in lockstep.
 */
export const RequiresEntrySchema = z
  .object({
    /** Primitive kind: skill | agent | command | hook | mcp. Kept a string so a
     *  future kind doesn't break old manifests. */
    kind: z.string(),
    /** Primitive name (e.g. `skill-core`, `@ikenga/studio-beat-detect`). */
    name: z.string(),
    /** Optional fetch source. */
    source: RequireSourceSchema.optional(),
    /** Optional git tag/branch or version pin. The shape leaves room for an
     *  explicit semver range later without another schema break. */
    ref: z.string().optional(),
  })
  .strict();
export type RequiresEntry = z.infer<typeof RequiresEntrySchema>;

export const ManifestAuthBridgeSchema = z.object({
  strategy: z.enum(['api-key', 'cdp', 'none']),
});
export type ManifestAuthBridge = z.infer<typeof ManifestAuthBridgeSchema>;

// ── workflows[] — workflow declarations a pkg contributes (DEC-41, Round 27) ─
export const WorkflowStepSchema = z
  .object({
    id: z.string(), // unique within this workflow's steps[]
    title: z.string(),
    /** Bridge address of the handler (DEC-41). Written `/iyke/pkg/<pkg_id>/<cmd>`:
     *  the `/iyke` prefix is a namespace marker, never sent on the wire — it
     *  names the bridge and disambiguates from the identically-spelled pane
     *  route `/pkg/<id><path>`; the runner strips it and invokes
     *  `POST {bridge}/pkg/<pkg_id>/<cmd>` — the path the pkg registered in
     *  `iyke.routes[]` and the `/pkg/*` dispatcher serves. `<pkg_id>` must equal
     *  this manifest's `id` (a pkg can only register routes under its own
     *  namespace — `IykeRoutesRegistry::validate_path`), so a foreign id is
     *  unresolvable; the stripped path must appear in `iyke.routes[]` with
     *  `method: "POST"`.
     *  `<cmd>` segments are restricted to lowercase-dash — a deliberate
     *  constraint: `iyke.routes[].path` itself is unconstrained, but only
     *  routes spelled with these segments are workflow-addressable. */
    handler: z
      .string()
      .regex(
        /^\/iyke\/pkg\/[a-z0-9]+(\.[a-z0-9-]+)+\/[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/,
        'must be /iyke/pkg/<pkg_id>/<cmd>',
      ),
    /** JSON Schema object describing the inputs the handler accepts — carried
     *  verbatim and opaque to the parser (the runner validates invocations
     *  against it). A `z.record`, not a schema DSL: §6's no-new-authoring-format
     *  rule applies to step inputs too. */
    inputs: z.record(z.unknown()).default({}),
    /** Names of the outputs the step emits — artifacts/keys downstream steps
     *  and the Automations listing can reference. A flat name list, not a type
     *  system; array (not single string) because a step can emit several. */
    produces: z.array(z.string()).default([]),
    /** Ids of sibling steps in THIS workflow that must complete first — maps to
     *  §6 `depends-on` edges. `parallel`/`triggers` are not manifest-declared:
     *  parallelism is implicit in the DAG, and `triggers` belongs to the
     *  imported graphs that reference these steps. */
    depends_on: z.array(z.string()).default([]),
  })
  .strict();

export const WorkflowEntrySchema = z
  .object({
    id: z.string(), // pkg-local; imported graph id `${pkg_id}:${id}`
    title: z.string(),
    steps: z.array(WorkflowStepSchema).min(1),
  })
  .strict();

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowEntry = z.infer<typeof WorkflowEntrySchema>;

// ---------- Manifest ----------

export const ManifestSchema = z.object({
  /** Reverse-DNS, e.g. `com.ikenga.studio`. */
  id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, 'must be reverse-DNS'),
  name: z.string(),
  version: z.string(),
  /** Numeric string — host accepts versions in [MIN, CURRENT]. */
  ikenga_api: z.string().regex(/^\d+$/),

  auth_bridge: ManifestAuthBridgeSchema.optional(),

  /** Hint, not enforced: "skill" | "embedded" | "windowed" | "engine". */
  kind: z.string().optional(),
  author: AuthorSchema.optional(),
  /** Rust target triples; empty = host-agnostic. */
  targets: z.array(z.string()).default([]),

  // Capability blocks (all optional — kernel walks present blocks)
  // NOTE (WP-17, ADR-015 decision 4): the `skills`/`commands`/`agents`
  // asset-bundling fields were HARD-RETIRED (lockstep with the Rust
  // `Manifest`). A pkg no longer embeds Claude-config assets; it only
  // `requires` standalone Ọba primitives. The Rust parser enforces
  // `deny_unknown_fields` (so declaring any of them fails kernel validation);
  // the Zod schema dropped the fields from the Manifest type. The shell builtin
  // `com.ikenga.iyke` places its skill/commands by convention from on-disk
  // folders, not via a manifest field.
  mcp: z.array(McpServerSchema).default([]),
  sidecars: z.array(SidecarSpecSchema).default([]),
  permissions: PermissionsSchema,
  migrations: z.string().optional(),
  settings: SettingsBlockSchema.optional(),
  ui: UiBlockSchema,
  iyke: IykeBlockSchema.optional(),
  cron: z.array(CronEntrySchema).default([]),
  window: WindowBlockSchema.optional(),
  queries: QueriesBlockSchema.optional(),
  workflows: z.array(WorkflowEntrySchema).default([]),

  /** Optional capabilities the host resolves and injects at iframe-mount
   *  time via the AppBridge `hostContext` handshake. Mirrors the Rust
   *  `CapabilitiesBlock` in `shell/src-tauri/src/pkg/manifest.rs`. */
  capabilities: z.object({
    supabase: SupabaseCapabilitySchema.optional(),
    sqlite: SqliteCapabilitySchema.optional(),
    webview: WebviewCapabilitySchema.optional(),
    agentOps: AgentOpsCapabilitySchema.optional(),
    /** host.fetch proxy (ADR-017). Inert unless the pkg is trusted. */
    http: HttpCapabilitySchema.optional(),
    /** Named-secret injection (ADR-017). Inert unless trusted. */
    secrets: SecretsCapabilitySchema.optional(),
    /** host.invoke passthrough (ADR-017). Inert unless trusted. */
    invoke: InvokeCapabilitySchema.optional(),
  }).optional(),

  /**
   * Engine-adapter manifest block. Present iff this pkg is an engine-*
   * adapter. Declares the agent id, display name, capability snapshot,
   * and onboarding hints surfaced by the first-run wizard.
   * See `@ikenga/contract/engine` for the source-of-truth schema.
   */
  engine: EngineProvidesSchema.optional(),

  /**
   * Optional UI preview screenshots surfaced by the package manager and the
   * install sheet. `path` is relative to the package's install_path; the
   * shell mints a webview-loadable URL for it on render. Packages without
   * UI (engines, MCP-only servers) typically leave this empty.
   */
  screenshots: z.array(ScreenshotSchema).default([]),

  /**
   * Forward dependency declarations (ADR-015 §3 / Ọba WP-11). Each entry names a
   * standalone primitive this pkg `requires`; the Ọba resolver installs the
   * closure at install/enable. A SEPARATE graph from a skill's `depends_on` (the
   * G-04 authoring star). Empty by default so pre-Phase-4 manifests are
   * unaffected. Mirrors `requires: Vec<RequiresEntry>` on the Rust `Manifest`
   * (`pkg/manifest.rs`) — keep in lockstep (`deny_unknown_fields`).
   */
  requires: z.array(RequiresEntrySchema).default([]),

  /** Optional ed25519 signature over the normalized manifest JSON (sort keys,
   *  strip `signature` before signing). Format `"ed25519:<base64>"`. Present
   *  on notarized registry pkgs; verified at install against the publisher key
   *  the signed registry index named. Absent → pkg isn't trusted (no elevated
   *  caps). Mirrors `signature: Option<String>` on the Rust `Manifest`. */
  signature: z.string().optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;
/** Alias retained for symmetry with the Rust side / external consumers. */
export const PkgManifestSchema = ManifestSchema;
export type PkgManifest = Manifest;

// ---------- Helpers ----------

/** Convert a reverse-DNS id to a slug: `com.ikenga.studio` → `com-ikenga-studio`. */
export function pkgSlug(id: string): string {
  return id.replaceAll('.', '-');
}

/** Sidecar names must start with `pa-<pkg-slug>-`. */
export function expectedSidecarPrefix(id: string): string {
  return `pa-${pkgSlug(id)}-`;
}

export function isCompatible(api: string): boolean {
  const n = Number.parseInt(api, 10);
  if (Number.isNaN(n)) return false;
  return n >= IKENGA_API_MIN_SUPPORTED && n <= IKENGA_API_VERSION;
}
