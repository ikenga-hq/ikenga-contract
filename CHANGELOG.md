# @ikenga/contract

## 0.21.0

### Minor Changes

- 778d267: Add an optional `ui.context_actions[].key` (a package key request, DEC-54 / G-PKG-KEY) and type `ui.command_palette[].action` as the package run union (`dispatch` | `view`, previously `z.unknown()`) per G-ACTIONS §7 and §12 (`plans/shell-ux-rearchitecture/drafts/actions-schema.md`, frozen Round 39). Both additions are additive on manifest api 5 — no version bump — but `ContextActionEntrySchema` is `.strict()`, so a manifest declaring `key` is rejected by every contract/shell parser that predates this change, whatever `ikenga_api` it declares. Also exports `deriveContextActionKeyWhen`, the pure `ContextSelector` → derived key `when` function from G-ACTIONS §7.3 (mirrored in `shell/src-tauri/src/pkg/manifest.rs` as `derive_context_action_key_when`).
- 4f3a502: Remove the `ui.nav` → `ui.views` alias (DEC-37 hard cutover). The alias had a
  one-release lifetime (G-MANIFEST-V5 §4) and v0.12.0 of the shell was the
  soft-warn release, so `ui.nav` is now rejected outright with the canonical
  message naming `ui.views[]` as the replacement.

  **BREAKING for manifests still on `ui.nav`** — including api=1..4 manifests;
  the api version does not exempt them. `NavEntrySchema` stays exported for
  tooling that reads historical manifests.

### Patch Changes

- 4807cf2: Add manifest-v5 fixtures for `workflows[]` (valid/workflows-basic,
  valid/workflows-multi, invalid/workflows-bad-handler) so the shell's
  `manifest_v5_parity` workflow test stops relying on its local stand-in.
  Test fixtures only; no runtime change.

## 0.20.0

### Minor Changes

- c162628: Add `workflows[]` manifest contribution field schema per DEC-41 (§10) and `WorkflowGraph` interchange view-model schema per G-MANIFEST-V5 §6.

### Patch Changes

- 0937ee2: `ui.side_pane_viewers` now rejects with the same canonical message as the shell's Rust parser (G-MANIFEST-V5 §8 Q1 / DEC-34), instead of Zod's generic `never` text.

## 0.19.0

### Minor Changes

- 83bae01: Manifest v5 (G-MANIFEST-V5, frozen 2026-09-22): add the `ui.views[]`,
  `ui.explorer_sections[]` (+ the `ExplorerSectionData` wire shape),
  `ui.companion_panels[]`, `ui.context_actions[]`, and `ui.widgets[]`
  contribution blocks; mark `ui.nav` a deprecated one-release alias;
  hard-retire `ui.side_pane_viewers` (declaring it now fails validation);
  enforce `views[].route` ⊆ `ui.routes[]` paths via superRefine.
  `IKENGA_API_VERSION` 4 → 5; the support window stays `[1, CURRENT]`, so
  api=1..4 manifests parse unchanged. Ships the `src/__fixtures__/manifest-v5/`
  fixture set (valid / invalid / alias) for the shell-side Rust↔Zod parity test.

## 0.18.1

### Patch Changes

- e6a619a: Correct `CONTRACT_PACKAGE_VERSION`, which had drifted to `0.5.0` while the
  package shipped `0.18.0`. Any consumer doing a runtime contract-version check
  was reading a stale constant.

## 0.18.0

### Minor Changes

- 412e0e4: Add the `NgwaItem` contract (`./ngwa` subpath, also re-exported from the root
  barrel). Frozen gate G-NGWA-ITEM: `NGWA_KINDS`/`NgwaKind`, `NgwaScope` (a
  two-arm union discriminated on `kind`), `NGWA_SOURCES`/`NgwaSource`,
  `NgwaOrigin`, `NGWA_STATES`/`NgwaState`, `NgwaRuntime`, `NgwaTrust`,
  `NgwaPermsSummary`, `NgwaPlacement`, `NgwaUsage`, `NgwaRef`, `NgwaItem` and the
  `NgwaSnapshot` envelope with per-source health — each as a Zod schema plus its
  inferred type.

  `NgwaItem` is the unified "installed thing" row joining the pkg kernel, the Ọba
  Claude-asset store, the engine-config scan, the `engine_assets` registry and
  trust, which no single command joins today. Keys are `snake_case` to match the
  Rust producer's serde defaults. Additive only — no existing export changes.

## 0.17.1

### Patch Changes

- 4dbcbe9: Manifest schema: `capabilities.sqlite` now accepts a boolean as well as an object. Zod-side mirror of the shell's Rust manifest relaxation (#179), so a pkg declaring `"sqlite": true` validates identically in both parsers.

## 0.17.0

### Minor Changes

- 918bb4a: Mirror `permissions.notify` in the manifest schema

  The shell gained a `host.notify` verb gated on `permissions.notify` containing
  `"send"` (ikenga WP-26). The Rust `Permissions` struct has no
  `deny_unknown_fields`, so the shell accepts the field regardless — but a pkg
  author validating a manifest against this Zod schema got no authoring support
  for a permission the shell honours. That is the drift that produces a manifest
  which validates in one place and not the other.

  Shipped in `be2c837`, which merged without a changeset and so would never have
  been versioned.

## 0.16.0

### Minor Changes

- 9103d28: feat(manifest): v4 — session, events, auth_bridge, route partition, allowed_origins (#27)

## 0.15.0

### Minor Changes

- 4e5dc9f: Add the `repo.changed` push contract at `@ikenga/contract/app-bridge`
  (`REPO_CHANGED_METHOD`, `RepoChangedParams` + `RepoChangedParamsSchema`,
  `RepoChangedEnvelope` + `RepoChangedEnvelopeSchema`, `readRepoChangedParams`,
  `isRepoChangedNotification`, `HOST_NOTIFICATION_MAX_PER_SEC`).

  This types the notification a pkg's **long-lived MCP server** emits via
  `server.sendLoggingMessage` so its iframe learns a git repo moved on disk
  without polling. The shell's existing relay carries it: the Rust supervisor
  matches `notifications/message`, rate-caps per pkg, and emits the
  `pkg-mcp-notification` Tauri event (`shell/src-tauri/src/pkg/lifecycle.rs`),
  which `pkg-iframe-host.tsx` Step 3b forwards verbatim onto the iframe's
  AppBridge wire. No new shell plumbing.

  Note there is no sidecar push path: `manifest.sidecars[]` entries are not
  supervised and `host.pkgSidecarCall` spawns a fresh one-shot process per call.
  The rate cap is a **tumbling** one-second window, so a burst straddling two
  windows can deliver up to 2x the cap in one arbitrary second.

  New file, additive only.

## 0.14.1

### Patch Changes

- d25b94a: `SettingsFieldSchema` accepts an optional `env` string, so a manifest that names
  an environment variable on a `settings` secret validates instead of being
  rejected. This is the TypeScript mirror of the shell's `manifest.rs`
  `SettingsField` change (F-9): the shell resolves the secret from its Stronghold
  vault and injects it into the pkg's sidecar and MCP process environment under
  the declared name. Without this field on the Zod side, contract consumers
  validating the same manifest the shell accepts would fail.

## 0.14.0

### Minor Changes

- f9e1b4f: Add `OperatorIdentity` hostContext extension (`operator` field on `IkengaHostContextExtensions`) — optional; absence means unknown operator and consumers must fail safe (e.g. `ux_mode: 'confirm'`).

## 0.13.0

### Minor Changes

- 17375fd: Publish the skill-action frontmatter contract: a new `./action-frontmatter`
  export with Zod schemas for `ActionFrontmatter` and its sub-schemas
  (`DomainEnum`, `UxModeEnum`, `RunBinding`, `Trigger`, `CapabilityEnum`,
  `SetupSpec`). This is the source-of-truth shape for an Atelier skill _action_'s
  YAML frontmatter (the block between the leading `---` fences of an
  `actions/*.md` file). Mirrors the Rust loader in `royalti-io/ikenga`
  (`src-tauri/src/pkg/skill_actions.rs`) — same lockstep convention as
  manifest.ts ↔ manifest.rs. Conformance-tested against every installed Atelier
  action file. Additive; no existing export changes.
- 4d7bc7d: PermissionsSchema gains `engine` (string[] of engine scopes, e.g. "invoke") —
  previously undeclarable, so the shell's engine:invoke gate on
  host.sendToActiveSession could never pass for any pkg. Mirrors the shell
  manifest.rs Permissions.engine field (lockstep).

## 0.12.0

### Minor Changes

- 0d67fd0: Add optional social/media fields to `DraftItem` (`channelId`, `firstComment`, `media`) plus `SocialMedia` and `ThreadPost` types, in lockstep with the send-worker's media-capable Buffer adapter (royalti-co social-outbound-unification). All fields are optional, so non-Buffer channels and existing consumers are unaffected.
- fff5fec: Add the multi-window `G-WINDOW-MODEL` contract: a new `./window` export with Zod
  schemas for `WindowDescriptor` (label / kind / surface_set / project_id /
  layout_key) and the cross-window event envelope (`WindowEventEnvelope`,
  `WindowEventTarget`, `WINDOW_TOPICS`, `WINDOW_TARGETED_CHANNELS`). Mirrors the
  Rust structs in `royalti-io/ikenga` (`src-tauri/src/window/`) — round-trip tested
  against shared canonical fixtures on both sides. Additive; no existing export
  changes.

## 0.11.0

### Minor Changes

- 63f35d7: Add a `BrowserEngine` discriminant (`"webkit" | "chrome"`) to the browser surface for Managed-mode Chrome. `BrowserOpenInput`, `BrowserOpenResult`, and `BrowserListEntry` gain an `engine` field (defaults to `"webkit"`), and `WebviewCapability` gains an `engines` array (defaults to `["webkit"]`). Purely additive — existing manifests and callers are unchanged. Mirrors the lockstep change in `WebviewCapability` (shell `manifest.rs`).

## 0.10.0

### Minor Changes

- 6c7aa08: Adds three major capability areas since v0.9.1. (1) **Trusted-capability manifest tier (ADR-017):** new `HttpCapabilitySchema`, `SecretsCapabilitySchema` (with `NamedSecretSchema`), and `InvokeCapabilitySchema` (with a named-command `commands` allowlist per D-06) let signed/builtin pkgs declare host-mediated HTTP proxying, Stronghold-resolved secret injection, and scoped Tauri-command passthrough; a top-level optional `signature` field is added to the manifest and `IKENGA_API_VERSION` is bumped to 3 (api=1/2 manifests parse unchanged). (2) **Approve-gate draft contract (`./pa-actions`):** new export path with `DraftItem`, `ApproveGateMeta`, `PausedDraft`, `SendResult` types, the `fromDraftItem` view-model derivation function, and `draftPreview` helper; extended in WP-02 with `recipientsList`, `bodyFormat`, `replyTo`, `scheduledChip` on `DraftItem` and a `'failed'` status on `PausedDraft` for post-send-worker error surfacing. (3) **Canvas a11y (`./canvas`):** opt-in `keyboardPan` and `ariaLabel` props on `CanvasProps`, arrow-key pan + +/- zoom in `use-pan-zoom`, and `role="img"` + roving tabindex on placed widgets in the `Canvas` primitive — all additive and backwards-compatible with existing consumers.

## 0.9.1

### Patch Changes

- ba10200: Adopt Changesets for versioning + release. Contributors now run `npx changeset`
  with each change to declare the bump (patch/minor/major); the version and
  CHANGELOG are derived from those entries and published by CI on merge of the
  "Version Packages" PR, replacing the previous tag-triggered publish flow.
