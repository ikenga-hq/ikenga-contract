import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  CompanionPanelEntrySchema,
  ContextActionEntrySchema,
  ContextActionRunSchema,
  ContextSelectorSchema,
  ExplorerSectionDataSchema,
  ExplorerSectionEntrySchema,
  HttpCapabilitySchema,
  IKENGA_API_VERSION,
  InvokeCapabilitySchema,
  isCompatible,
  ManifestSchema,
  NamedSecretSchema,
  RequiresEntrySchema,
  RequireSourceSchema,
  SecretsCapabilitySchema,
  ViewEntrySchema,
  WidgetEntrySchema,
  WorkflowEntrySchema,
  WorkflowStepSchema,
} from './manifest.js';

// ─── WP-11 — `requires` field (ADR-015 §3) ──────────────────────────────────

const BASE = {
  id: 'com.ikenga.studio',
  name: 'Studio',
  version: '0.1.0',
  ikenga_api: '1',
};

test('RequiresEntry: full shape parses', () => {
  const e = RequiresEntrySchema.parse({
    kind: 'skill',
    name: '@ikenga/studio-beat-detect',
    source: 'npx',
    ref: 'v1.2.0',
  });
  assert.equal(e.kind, 'skill');
  assert.equal(e.source, 'npx');
  assert.equal(e.ref, 'v1.2.0');
});

test('RequiresEntry: source + ref optional', () => {
  const e = RequiresEntrySchema.parse({ kind: 'skill', name: 'skill-core' });
  assert.equal(e.source, undefined);
  assert.equal(e.ref, undefined);
});

test('RequiresEntry: rejects unknown field (.strict mirrors Rust deny_unknown_fields)', () => {
  assert.throws(() =>
    RequiresEntrySchema.parse({ kind: 'skill', name: 'skill-core', bogus: true }),
  );
});

test('RequiresEntry: kind bundle is accepted (WP-18 G-BUNDLE)', () => {
  // WP-18 locked design decision 4: `RequiresEntrySchema.kind` is `z.string()`
  // (a free string, not a closed enum), so a `requires` entry may reference a
  // bundle — `{kind:"bundle", name}` parses and carries the kind through. This
  // is the contract-side half of the G-BUNDLE "requires kind:bundle parses" DoD.
  const e = RequiresEntrySchema.parse({ kind: 'bundle', name: 'studio-archetypes' });
  assert.equal(e.kind, 'bundle');
  assert.equal(e.name, 'studio-archetypes');
});

test('RequiresEntry: rejects an out-of-set source', () => {
  assert.throws(() =>
    RequiresEntrySchema.parse({ kind: 'skill', name: 'x', source: 'ftp' }),
  );
});

test('RequireSource: only git|npx|catalog|local', () => {
  for (const s of ['git', 'npx', 'catalog', 'local']) {
    assert.equal(RequireSourceSchema.parse(s), s);
  }
  assert.throws(() => RequireSourceSchema.parse('http'));
});

test('Manifest: requires parses and round-trips', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    requires: [
      { kind: 'skill', name: '@ikenga/studio-archetypes', source: 'npx' },
      { kind: 'skill', name: 'skill-core', source: 'git', ref: 'v1.0.0' },
      { kind: 'skill', name: '@ikenga/studio-doctor' },
    ],
  });
  assert.equal(m.requires.length, 3);
  assert.equal(m.requires[0].name, '@ikenga/studio-archetypes');
  assert.equal(m.requires[2].source, undefined);
});

test('Manifest: requires defaults to [] when absent (pre-Phase-4 manifest)', () => {
  const m = ManifestSchema.parse({ ...BASE });
  assert.deepEqual(m.requires, []);
});

// ─── WP-01 — trusted-cap tier (ADR-017): http / secrets / invoke + signature ─

test('IKENGA_API_VERSION is 5 (WP-27 Manifest v5)', () => {
  assert.equal(IKENGA_API_VERSION, 5);
});

test('HttpCapability: auth_header defaults to Authorization; auth_secret optional', () => {
  const h = HttpCapabilitySchema.parse({});
  assert.equal(h.auth_header, 'Authorization');
  assert.equal(h.auth_secret, undefined);
});

test('HttpCapability: .strict rejects unknown field (mirrors Rust deny_unknown_fields)', () => {
  assert.throws(() => HttpCapabilitySchema.parse({ bogus: true }));
});

test('NamedSecret: full shape parses; required defaults false', () => {
  const s = NamedSecretSchema.parse({ name: 'twenty', vault_key: 'TWENTY_API_KEY' });
  assert.equal(s.required, false);
  const r = NamedSecretSchema.parse({
    name: 'k',
    vault_key: 'K',
    required: true,
    format: 'bearer',
  });
  assert.equal(r.required, true);
  assert.equal(r.format, 'bearer');
});

test('NamedSecret: .strict rejects unknown field', () => {
  assert.throws(() =>
    NamedSecretSchema.parse({ name: 'k', vault_key: 'K', bogus: true }),
  );
});

test('SecretsCapability: declarations default to []', () => {
  const s = SecretsCapabilitySchema.parse({});
  assert.deepEqual(s.declarations, []);
});

test('InvokeCapability: empty object parses; commands defaults to [] (presence gate)', () => {
  assert.deepEqual(InvokeCapabilitySchema.parse({}), { commands: [] });
});

test('InvokeCapability (D-06): commands allowlist parses + survives', () => {
  const i = InvokeCapabilitySchema.parse({ commands: ['pa_actions_commit', 'pa_actions_reject'] });
  assert.deepEqual(i.commands, ['pa_actions_commit', 'pa_actions_reject']);
});

test('InvokeCapability: .strict rejects unknown field (mirrors Rust deny_unknown_fields)', () => {
  assert.throws(() => InvokeCapabilitySchema.parse({ commands: [], bogus: true }));
});

test('Manifest: fully-populated trusted-cap manifest round-trips (G-MANIFEST DoD)', () => {
  // The contract-side half of the round-trip parse-fixture: a manifest carrying
  // ALL FOUR new fields — top-level `signature`, `capabilities.http` (with
  // auth_secret + custom header), `capabilities.secrets` (with a declaration),
  // and the presence-gate `capabilities.invoke` — parses and the values survive.
  const m = ManifestSchema.parse({
    ...BASE,
    ikenga_api: '3',
    signature: 'ed25519:Zm9vYmFyYmF6',
    permissions: { net: ['https://api.twenty.com/'], 'vault.keys': ['TWENTY_API_KEY'] },
    capabilities: {
      http: { auth_secret: 'twenty', auth_header: 'X-Api-Key' },
      secrets: {
        declarations: [
          { name: 'twenty', vault_key: 'TWENTY_API_KEY', required: true, format: 'bearer' },
        ],
      },
      invoke: { commands: ['pa_actions_commit'] },
    },
  });
  assert.equal(m.signature, 'ed25519:Zm9vYmFyYmF6');
  assert.equal(m.capabilities?.http?.auth_secret, 'twenty');
  assert.equal(m.capabilities?.http?.auth_header, 'X-Api-Key');
  assert.equal(m.capabilities?.secrets?.declarations.length, 1);
  assert.equal(m.capabilities?.secrets?.declarations[0].vault_key, 'TWENTY_API_KEY');
  assert.equal(m.capabilities?.secrets?.declarations[0].required, true);
  assert.ok(m.capabilities?.invoke !== undefined);
  // D-06: the invoke command allowlist survives the round-trip.
  assert.deepEqual(m.capabilities?.invoke?.commands, ['pa_actions_commit']);
});

test('Manifest: api=1 manifest without new fields parses (back-compat)', () => {
  const m = ManifestSchema.parse({ ...BASE });
  assert.equal(m.signature, undefined);
  assert.equal(m.capabilities, undefined);
});

test('Manifest: webview capability and partition route parses', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    ui: {
      routes: [
        { path: '/test', kind: 'webview', source: 'https://example.com', partition: 'test-part' }
      ]
    },
    capabilities: {
      webview: {
        child_webviews: true,
        allowed_origins: ['https://example.com']
      }
    }
  });
  assert.equal(m.ui.routes[0].kind, 'webview');
  assert.equal(m.ui.routes[0].partition, 'test-part');
  assert.deepEqual(m.capabilities?.webview?.allowed_origins, ['https://example.com']);
});

test('Manifest: retired bundling fields are no longer part of the type (WP-17)', () => {
  // ADR-015 decision 4: `skills`/`commands`/`agents` were hard-retired from the
  // schema (lockstep with the Rust `deny_unknown_fields` Manifest, which REJECTS
  // them — the authoritative loader). ManifestSchema is non-strict, so a stray
  // legacy key is stripped rather than rejected here; assert it does not survive
  // onto the parsed object.
  const m = ManifestSchema.parse({ ...BASE, skills: 'skills', commands: 'commands' }) as Record<
    string,
    unknown
  >;
  assert.equal(m.skills, undefined);
  assert.equal(m.commands, undefined);
});

test('Manifest: allowed_origins absent stays absent (not coerced to [])', () => {
  // G-28 — absent must be distinguishable from an explicit deny-all lockdown.
  // A `.default([])` here would silently turn every pre-v4 manifest into one.
  const m = ManifestSchema.parse({
    id: 'com.test.webview',
    name: 'T',
    version: '1.0.0',
    ikenga_api: '4',
    author: { name: 'T' },
    ui: { routes: [{ path: '/', kind: 'webview', source: 'https://example.com' }] },
    capabilities: { webview: { child_webviews: true, partitions: ['default'] } },
  });
  assert.equal(m.capabilities?.webview?.allowed_origins, undefined);
});

test('Manifest: allowed_origins empty array survives as an explicit lockdown', () => {
  const m = ManifestSchema.parse({
    id: 'com.test.webview',
    name: 'T',
    version: '1.0.0',
    ikenga_api: '4',
    author: { name: 'T' },
    ui: { routes: [{ path: '/', kind: 'webview', source: 'https://example.com' }] },
    capabilities: { webview: { child_webviews: true, partitions: ['default'], allowed_origins: [] } },
  });
  assert.deepEqual(m.capabilities?.webview?.allowed_origins, []);
});

test('Manifest: capabilities.sqlite accepts boolean true', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    capabilities: { sqlite: true },
  });
  assert.deepEqual(m.capabilities?.sqlite, { db: 'ikenga.local' });
});

test('Manifest: capabilities.sqlite accepts boolean false as disabled', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    capabilities: { sqlite: false },
  });
  assert.equal(m.capabilities?.sqlite, undefined);
});

test('Manifest: capabilities.sqlite accepts object config', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    capabilities: { sqlite: { db: 'custom.db' } },
  });
  assert.deepEqual(m.capabilities?.sqlite, { db: 'custom.db' });
});

// ─── WP-27 — manifest v5 contribution blocks (G-MANIFEST-V5, frozen §2) ─────

test('isCompatible: window is [1, 5] after the v5 bump', () => {
  assert.equal(isCompatible('1'), true);
  assert.equal(isCompatible('4'), true);
  assert.equal(isCompatible('5'), true);
  assert.equal(isCompatible('6'), false);
  assert.equal(isCompatible('0'), false);
  assert.equal(isCompatible('abc'), false);
});

test('ViewEntry: full shape parses; pin_on_install defaults false', () => {
  const v = ViewEntrySchema.parse({
    id: 'grid',
    title: 'Grid',
    icon: 'layout-grid',
    route: '/grid',
    pin_on_install: true,
  });
  assert.equal(v.pin_on_install, true);
  const minimal = ViewEntrySchema.parse({ id: 'd', title: 'D', route: '/d' });
  assert.equal(minimal.pin_on_install, false);
  assert.equal(minimal.icon, undefined);
});

test('ViewEntry: .strict rejects unknown field (mirrors Rust deny_unknown_fields)', () => {
  assert.throws(() =>
    ViewEntrySchema.parse({ id: 'x', title: 'X', route: '/x', label: 'nope' }),
  );
});

test('ExplorerSectionEntry: full shape parses; order optional int', () => {
  const e = ExplorerSectionEntrySchema.parse({
    id: 'open-tasks',
    title: 'Open Tasks',
    icon: 'check-circle',
    order: 10,
    data_route: '/pkg/com.ikenga.x/sections/open-tasks',
  });
  assert.equal(e.order, 10);
  const minimal = ExplorerSectionEntrySchema.parse({
    id: 's',
    title: 'S',
    data_route: '/pkg/com.ikenga.x/s',
  });
  assert.equal(minimal.order, undefined);
  assert.equal(minimal.icon, undefined);
});

test('ExplorerSectionEntry: missing data_route fails; .strict rejects extras; non-int order fails', () => {
  assert.throws(() =>
    ExplorerSectionEntrySchema.parse({ id: 's', title: 'S' }),
  );
  assert.throws(() =>
    ExplorerSectionEntrySchema.parse({ id: 's', title: 'S', data_route: '/p', bogus: 1 }),
  );
  assert.throws(() =>
    ExplorerSectionEntrySchema.parse({ id: 's', title: 'S', data_route: '/p', order: 1.5 }),
  );
});

test('ExplorerSectionData: rows default []; full wire shape parses', () => {
  const empty = ExplorerSectionDataSchema.parse({});
  assert.deepEqual(empty.rows, []);
  const d = ExplorerSectionDataSchema.parse({
    rows: [
      {
        id: 'r1',
        label: 'Row 1',
        badge: { count: 3, tooltip: 'three' },
        open: 'pkg://com.ikenga.x/detail',
      },
      { id: 'r2', label: 'Row 2' },
    ],
    as_of_ms: 1727000000000,
  });
  assert.equal(d.rows.length, 2);
  assert.equal(d.rows[0]?.badge?.count, 3);
  assert.equal(d.as_of_ms, 1727000000000);
});

test('ExplorerSectionData: .strict rejects unknown top-level field', () => {
  assert.throws(() => ExplorerSectionDataSchema.parse({ rows: [], bogus: true }));
});

test('CompanionPanelEntry: full shape parses; session_scoped defaults false', () => {
  const p = CompanionPanelEntrySchema.parse({
    id: 'state',
    title: 'State',
    icon: 'activity',
    route: '/state',
    session_scoped: true,
  });
  assert.equal(p.session_scoped, true);
  const minimal = CompanionPanelEntrySchema.parse({ id: 's', title: 'S', route: '/s' });
  assert.equal(minimal.session_scoped, false);
});

test('CompanionPanelEntry: missing route fails; .strict rejects extras', () => {
  assert.throws(() =>
    CompanionPanelEntrySchema.parse({ id: 's', title: 'S' }),
  );
  assert.throws(() =>
    CompanionPanelEntrySchema.parse({ id: 's', title: 'S', route: '/s', bogus: 1 }),
  );
});

test('ContextSelector: all four kinds parse; unknown kind fails', () => {
  assert.equal(ContextSelectorSchema.parse({ kind: 'file' }).kind, 'file');
  assert.equal(
    ContextSelectorSchema.parse({ kind: 'file', glob: '*.md' }).glob,
    '*.md',
  );
  assert.equal(ContextSelectorSchema.parse({ kind: 'artifact' }).kind, 'artifact');
  assert.equal(ContextSelectorSchema.parse({ kind: 'session' }).kind, 'session');
  const n = ContextSelectorSchema.parse({ kind: 'ngwa-item', kinds: ['task'] });
  assert.equal(n.kind, 'ngwa-item');
  assert.throws(() => ContextSelectorSchema.parse({ kind: 'project' }));
});

test('ContextActionRun: dispatch + view variants parse; unknown kind fails', () => {
  const d = ContextActionRunSchema.parse({
    kind: 'dispatch',
    prompt: 'Review {{file.path}}',
    target: 'chi',
  });
  assert.equal(d.kind, 'dispatch');
  const dMinimal = ContextActionRunSchema.parse({ kind: 'dispatch', prompt: 'p' });
  assert.equal(dMinimal.target, undefined);
  const v = ContextActionRunSchema.parse({ kind: 'view', route: '/review' });
  assert.equal(v.kind, 'view');
  assert.throws(() =>
    ContextActionRunSchema.parse({ kind: 'shell', command: 'x' }),
  );
});

test('ContextActionEntry: full shape parses; missing when/run fails; .strict rejects extras', () => {
  const a = ContextActionEntrySchema.parse({
    id: 'hand-to-chi',
    label: 'Hand to Chi',
    when: { kind: 'file', glob: '*.md' },
    run: { kind: 'dispatch', prompt: 'Handle {{file.path}}' },
  });
  assert.equal(a.id, 'hand-to-chi');
  assert.throws(() =>
    ContextActionEntrySchema.parse({
      id: 'x',
      label: 'X',
      run: { kind: 'view', route: '/x' },
    }),
  );
  assert.throws(() =>
    ContextActionEntrySchema.parse({
      id: 'x',
      label: 'X',
      when: { kind: 'session' },
      run: { kind: 'view', route: '/x' },
      bogus: true,
    }),
  );
});

test('WidgetEntry: span defaults medium; small|medium|wide parse; other spans fail', () => {
  const w = WidgetEntrySchema.parse({ id: 'w', title: 'W', route: '/w' });
  assert.equal(w.span, 'medium');
  for (const span of ['small', 'medium', 'wide'] as const) {
    assert.equal(
      WidgetEntrySchema.parse({ id: 'w', title: 'W', route: '/w', span }).span,
      span,
    );
  }
  assert.throws(() =>
    WidgetEntrySchema.parse({ id: 'w', title: 'W', route: '/w', span: 'large' }),
  );
  assert.throws(() =>
    WidgetEntrySchema.parse({ id: 'w', title: 'W', route: '/w', bogus: 1 }),
  );
});

test('Manifest v5: ui gains all five contribution blocks with [] defaults', () => {
  const m = ManifestSchema.parse({ ...BASE, ikenga_api: '5' });
  assert.deepEqual(m.ui.views, []);
  assert.deepEqual(m.ui.explorer_sections, []);
  assert.deepEqual(m.ui.companion_panels, []);
  assert.deepEqual(m.ui.context_actions, []);
  assert.deepEqual(m.ui.widgets, []);
});

test('Manifest v5: ui.side_pane_viewers fails to parse (DEC-34 Q1 hard-retire)', () => {
  assert.throws(() =>
    ManifestSchema.parse({
      ...BASE,
      ui: {
        routes: [{ path: '/v', kind: 'iframe', source: 'v.html' }],
        side_pane_viewers: [{ id: 'v', label: 'V', route: '/v' }],
      },
    }),
    /was removed in manifest v5 \(G-MANIFEST-V5 §8 Q1\)/,
  );
  // Even an empty array is a declaration — the field itself is retired.
  assert.throws(() =>
    ManifestSchema.parse({ ...BASE, ui: { side_pane_viewers: [] } }),
  );
});

test('Manifest v5: views[].route not in ui.routes[] fails via superRefine, naming the path', () => {
  const r = ManifestSchema.safeParse({
    ...BASE,
    ui: {
      routes: [{ path: '/grid', kind: 'iframe', source: 'grid.html' }],
      views: [
        { id: 'grid', title: 'Grid', route: '/grid' },
        { id: 'missing', title: 'Missing', route: '/not-declared' },
      ],
    },
  });
  assert.equal(r.success, false);
  if (!r.success) {
    const issue = r.error.issues.find((i) => i.code === 'custom');
    assert.ok(issue, 'expected a custom (superRefine) issue');
    assert.deepEqual(issue.path, ['ui', 'views', 1, 'route']);
    assert.ok(issue.message.includes('/not-declared'));
  }
});

test('Manifest v5: views[] referencing every declared route parses (§2b)', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    ui: {
      routes: [
        { path: '/a', kind: 'iframe', source: 'a.html' },
        { path: '/b', kind: 'iframe', source: 'b.html' },
      ],
      views: [
        { id: 'a', title: 'A', route: '/a', pin_on_install: true },
        { id: 'b', title: 'B', route: '/b' },
      ],
    },
  });
  assert.equal(m.ui.views.length, 2);
  assert.equal(m.ui.views[0]?.pin_on_install, true);
});

test('Manifest v5: companion-panel and widget routes are NOT reference-checked (§2b scopes to views)', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    ui: {
      routes: [],
      companion_panels: [{ id: 'p', title: 'P', route: '/unlisted' }],
      widgets: [{ id: 'w', title: 'W', route: '/also-unlisted' }],
    },
  });
  assert.equal(m.ui.companion_panels.length, 1);
  assert.equal(m.ui.widgets.length, 1);
});

test('Manifest v5 alias: ui.nav-only manifest parses; nav kept, views default []', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    ikenga_api: '1',
    ui: {
      routes: [{ path: '/home', kind: 'iframe', source: 'home.html' }],
      nav: [{ id: 'home', label: 'Home', icon: 'home', route: '/home' }],
    },
  });
  assert.equal(m.ui.nav.length, 1);
  assert.equal(m.ui.nav[0]?.label, 'Home');
  assert.deepEqual(m.ui.views, []);
});

test('Manifest v5 alias: nav + views both declared still parses (§4 — nav ignored shell-side)', () => {
  const m = ManifestSchema.parse({
    ...BASE,
    ui: {
      routes: [{ path: '/grid', kind: 'iframe', source: 'grid.html' }],
      nav: [{ id: 'legacy', label: 'Legacy', route: '/grid' }],
      views: [{ id: 'grid', title: 'Grid', route: '/grid' }],
    },
  });
  assert.equal(m.ui.nav.length, 1);
  assert.equal(m.ui.views.length, 1);
});

// ─── WP-27 — manifest-v5 fixture sweep (PRODUCES: src/__fixtures__/manifest-v5) ─
// Verdict-by-folder contract consumed by WP-28's Rust parity test:
//   valid/ parses · invalid/ fails · alias/ parses (shell applies the §4 mapping).

const V5_FIXTURES = new URL('./__fixtures__/manifest-v5/', import.meta.url);

function fixtureNames(dir: 'valid' | 'invalid' | 'alias'): string[] {
  return readdirSync(new URL(`${dir}/`, V5_FIXTURES))
    .filter((f) => f.endsWith('.json'))
    .sort();
}

function readFixture(dir: 'valid' | 'invalid' | 'alias', name: string): unknown {
  return JSON.parse(readFileSync(new URL(`${dir}/${name}`, V5_FIXTURES), 'utf8'));
}

test('manifest-v5 fixtures: every valid/* parses', () => {
  const names = fixtureNames('valid');
  assert.ok(names.length > 0, 'expected at least one valid fixture');
  for (const name of names) {
    const r = ManifestSchema.safeParse(readFixture('valid', name));
    assert.ok(
      r.success,
      `valid/${name} should parse: ${r.success ? '' : JSON.stringify(r.error.issues)}`,
    );
  }
});

test('manifest-v5 fixtures: every invalid/* fails to parse', () => {
  const names = fixtureNames('invalid');
  assert.ok(names.length > 0, 'expected at least one invalid fixture');
  for (const name of names) {
    const r = ManifestSchema.safeParse(readFixture('invalid', name));
    assert.equal(r.success, false, `invalid/${name} should fail to parse`);
  }
});

test('manifest-v5 fixtures: every alias/* parses (nav→views is shell-side, §4)', () => {
  const names = fixtureNames('alias');
  assert.ok(names.length > 0, 'expected at least one alias fixture');
  for (const name of names) {
    const r = ManifestSchema.safeParse(readFixture('alias', name));
    assert.ok(
      r.success,
      `alias/${name} should parse: ${r.success ? '' : JSON.stringify(r.error.issues)}`,
    );
  }
});

test('manifest-v5 fixtures: alias/nav-only keeps nav populated for the shell-side mapping', () => {
  const m = ManifestSchema.parse(readFixture('alias', 'nav-only.json'));
  assert.equal(m.ui.nav.length, 2);
  assert.equal(m.ui.nav[0]?.route, '/home');
  assert.deepEqual(m.ui.views, []);
});

// ─── WP-31 — workflows[] manifest field (DEC-41) ────────────────────────────

test('WorkflowStepSchema: valid step parses with defaults', () => {
  const step = WorkflowStepSchema.parse({
    id: 'build',
    title: 'Build Package',
    handler: '/iyke/pkg/com.ikenga.build/compile',
  });
  assert.equal(step.id, 'build');
  assert.equal(step.title, 'Build Package');
  assert.equal(step.handler, '/iyke/pkg/com.ikenga.build/compile');
  assert.deepEqual(step.inputs, {});
  assert.deepEqual(step.produces, []);
  assert.deepEqual(step.depends_on, []);
});

test('WorkflowStepSchema: validates handler route regex (DEC-41)', () => {
  // Valid handler routes
  assert.ok(
    WorkflowStepSchema.safeParse({
      id: 'step1',
      title: 'Step 1',
      handler: '/iyke/pkg/com.ikenga.build/run',
    }).success,
  );
  assert.ok(
    WorkflowStepSchema.safeParse({
      id: 'step2',
      title: 'Step 2',
      handler: '/iyke/pkg/com.ikenga.studio/sub-cmd/nested',
    }).success,
  );

  // Invalid: missing /iyke prefix
  assert.equal(
    WorkflowStepSchema.safeParse({
      id: 'step1',
      title: 'Step 1',
      handler: '/pkg/com.ikenga.build/run',
    }).success,
    false,
  );

  // Invalid: uppercase characters in handler
  assert.equal(
    WorkflowStepSchema.safeParse({
      id: 'step1',
      title: 'Step 1',
      handler: '/iyke/pkg/com.ikenga.Build/Run',
    }).success,
    false,
  );

  // Invalid: extra unknown fields rejected (.strict)
  assert.equal(
    WorkflowStepSchema.safeParse({
      id: 'step1',
      title: 'Step 1',
      handler: '/iyke/pkg/com.ikenga.build/run',
      extra: true,
    }).success,
    false,
  );
});

test('WorkflowEntrySchema: parses workflow with steps and requires min 1 step', () => {
  const entry = WorkflowEntrySchema.parse({
    id: 'ci',
    title: 'CI Pipeline',
    steps: [
      {
        id: 'test',
        title: 'Run Tests',
        handler: '/iyke/pkg/com.ikenga.test/unit',
        produces: ['coverage.json'],
      },
      {
        id: 'deploy',
        title: 'Deploy',
        handler: '/iyke/pkg/com.ikenga.deploy/stage',
        depends_on: ['test'],
      },
    ],
  });
  assert.equal(entry.id, 'ci');
  assert.equal(entry.steps.length, 2);

  // Rejects empty steps
  assert.equal(
    WorkflowEntrySchema.safeParse({
      id: 'empty',
      title: 'Empty Workflow',
      steps: [],
    }).success,
    false,
  );
});

test('Manifest: workflows[] defaults to [] when omitted and round-trips when declared', () => {
  const m1 = ManifestSchema.parse({ ...BASE, ikenga_api: '5' });
  assert.deepEqual(m1.workflows, []);

  const m2 = ManifestSchema.parse({
    ...BASE,
    ikenga_api: '5',
    workflows: [
      {
        id: 'build-and-test',
        title: 'Build and Test',
        steps: [
          {
            id: 'build',
            title: 'Build',
            handler: '/iyke/pkg/com.ikenga.studio/build',
          },
        ],
      },
    ],
  });
  assert.equal(m2.workflows.length, 1);
  assert.equal(m2.workflows[0]?.id, 'build-and-test');
  assert.equal(m2.workflows[0]?.steps[0]?.handler, '/iyke/pkg/com.ikenga.studio/build');
});

