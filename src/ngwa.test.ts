import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NGWA_KINDS,
  NGWA_SOURCES,
  NGWA_STATES,
  NgwaItemSchema,
  NgwaOriginSchema,
  NgwaPermsSummarySchema,
  NgwaPlacementSchema,
  NgwaRefSchema,
  NgwaRuntimeSchema,
  NgwaScopeSchema,
  NgwaSnapshotSchema,
  NgwaTrustSchema,
  NgwaUsageSchema,
} from './ngwa.js';

// ─── WP-13 — G-NGWA-ITEM (drafts/ngwa-item.md §2, frozen Round 11) ──────────

const ORIGIN = {
  source: 'registry',
  url: 'https://registry.ikenga.dev/index.json',
  ref: null,
  resolved_version: '0.4.2',
  publisher: 'ikenga-hq',
  managed: true,
  auto_update: false,
  installed_at_ms: 1_726_000_000_000,
  updated_at_ms: 1_726_900_000_000,
};

const PERMS = {
  shell_execute: ['git *'],
  fs_write_outside_sandbox: ['~/.claude/**'],
  net: ['https://api.royalti.io/**'],
  vault_keys: ['supabase.anon'],
};

const TRUST = {
  state: 'granted',
  signed: true,
  auto_trusted: false,
  review_pending: false,
  perms: PERMS,
  last_granted_at_ms: 1_726_900_000_000,
};

const RUNTIME = {
  state: 'running',
  pid: 44_112,
  uptime_s: 903,
  restarts: 1,
  last_err: null,
  last_crash_ms: null,
};

const PLACEMENT = {
  engine: 'claude',
  scope: { kind: 'project', project_id: 'C--Users-x-royalti-co' },
  path: '/Users/x/royalti-co/.claude/skills/groundwork',
  mechanism: 'symlink-dir',
  present: true,
  link_target: '/Users/x/.ikenga/oba/skills/groundwork',
  in_store: true,
  managed_by: 'oba',
  overridden_by: null,
  format: 'md-yaml',
  status: 'active',
};

const USAGE = {
  source: 'transcript',
  last_used_ms: 1_726_950_000_000,
  count_7d: 12,
  count_30d: 72,
  tokens_30d: 1_240_991,
  window_start_ms: 1_724_000_000_000,
};

const REF = {
  kind: 'skill',
  name: 'skill-core',
  item_id: 'skill:personal:skill-core',
  source: 'catalog',
  ref: null,
};

const ITEM = {
  id: 'com.ikenga.studio',
  kind: 'app',
  name: 'studio',
  display_name: 'Studio',
  description: 'Beat-detection workbench.',
  version: '0.4.2',
  latest_version: '0.5.0',
  scope: { kind: 'personal' },
  origin: ORIGIN,
  state: 'enabled',
  runtime: RUNTIME,
  trust: TRUST,
  placements: [PLACEMENT],
  usage: USAGE,
  requires: [REF],
  required_by: [],
  owner_pkg_id: null,
  install_path: '/Users/x/.ikenga/pkgs/com.ikenga.studio',
  engines: ['claude'],
};

const SOURCE_HEALTH = { ok: true, error: null, count: 3 };

const SNAPSHOT = {
  items: [ITEM],
  as_of_ms: 1_726_951_000_000,
  sources: {
    kernel: SOURCE_HEALTH,
    oba: SOURCE_HEALTH,
    engine_config: SOURCE_HEALTH,
    engine_assets: { ok: false, error: 'registry snapshot unavailable', count: 0 },
    trust: SOURCE_HEALTH,
    usage: SOURCE_HEALTH,
  },
};

/** Every object key anywhere in a parsed value must be snake_case (§2: the
 *  producer is a Rust command serializing with serde defaults and no renames). */
function assertSnakeCaseKeys(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertSnakeCaseKeys(v, `${path}[${i}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    assert.match(k, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, `key ${path}.${k} is not snake_case`);
    assertSnakeCaseKeys(v, `${path}.${k}`);
  }
}

const keys = (o: object) => Object.keys(o).sort();

// ── (a) every field in §2 is present, and keys are snake_case ──────────────

test('Ngwa: every field name in draft §2 is present on a parsed fixture', () => {
  const item = NgwaItemSchema.parse(ITEM);

  assert.deepEqual(keys(item), keys({
    id: 0, kind: 0, name: 0, display_name: 0, description: 0, version: 0,
    latest_version: 0, scope: 0, origin: 0, state: 0, runtime: 0, trust: 0,
    placements: 0, usage: 0, requires: 0, required_by: 0, owner_pkg_id: 0,
    install_path: 0, engines: 0,
  }));

  assert.deepEqual(keys(NgwaOriginSchema.parse(ORIGIN)), keys({
    source: 0, url: 0, ref: 0, resolved_version: 0, publisher: 0, managed: 0,
    auto_update: 0, installed_at_ms: 0, updated_at_ms: 0,
  }));

  assert.deepEqual(keys(NgwaRuntimeSchema.parse(RUNTIME)), keys({
    state: 0, pid: 0, uptime_s: 0, restarts: 0, last_err: 0, last_crash_ms: 0,
  }));

  assert.deepEqual(keys(NgwaTrustSchema.parse(TRUST)), keys({
    state: 0, signed: 0, auto_trusted: 0, review_pending: 0, perms: 0,
    last_granted_at_ms: 0,
  }));

  assert.deepEqual(keys(NgwaPermsSummarySchema.parse(PERMS)), keys({
    shell_execute: 0, fs_write_outside_sandbox: 0, net: 0, vault_keys: 0,
  }));

  assert.deepEqual(keys(NgwaPlacementSchema.parse(PLACEMENT)), keys({
    engine: 0, scope: 0, path: 0, mechanism: 0, present: 0, link_target: 0,
    in_store: 0, managed_by: 0, overridden_by: 0, format: 0, status: 0,
  }));

  assert.deepEqual(keys(NgwaUsageSchema.parse(USAGE)), keys({
    source: 0, last_used_ms: 0, count_7d: 0, count_30d: 0, tokens_30d: 0,
    window_start_ms: 0,
  }));

  assert.deepEqual(keys(NgwaRefSchema.parse(REF)), keys({
    kind: 0, name: 0, item_id: 0, source: 0, ref: 0,
  }));

  const snap = NgwaSnapshotSchema.parse(SNAPSHOT);
  assert.deepEqual(keys(snap), ['as_of_ms', 'items', 'sources']);
  assert.deepEqual(keys(snap.sources), [
    'engine_assets', 'engine_config', 'kernel', 'oba', 'trust', 'usage',
  ]);
  assert.deepEqual(keys(snap.sources.kernel), ['count', 'error', 'ok']);

  // …and the SOURCE fixture is snake_case throughout. Asserting this on the
  // PARSED value would be vacuous: Zod strips unknown keys, so a camelCase key
  // could never survive to be seen. Audited and corrected, Round 13.
  assertSnakeCaseKeys(SNAPSHOT);
});

// ── Round 13 — the real drift guard ────────────────────────────────────────
//
// The parity assertions above catch a field REMOVED from a schema (the parsed
// key set shrinks). They cannot catch a field the producer ADDS, because Zod
// strips unknown keys before any assertion can see them. These two tests cover
// that direction: the first pins the strip as documented behaviour, the second
// is the guard WP-14's Rust producer is checked against.

test('Ngwa: unknown keys are STRIPPED, not preserved (documents the default)', () => {
  const parsed = NgwaPlacementSchema.parse({
    ...PLACEMENT,
    linkTarget: 'camelCase twin of link_target',
    EXTRA_unknown: 1,
  }) as Record<string, unknown>;

  assert.equal('linkTarget' in parsed, false);
  assert.equal('EXTRA_unknown' in parsed, false);
  assert.equal(parsed.link_target, PLACEMENT.link_target);
});

test('Ngwa: a .strict() variant REJECTS an unknown key (the producer-drift guard)', () => {
  // DEC-26: the shipped schemas stay permissive so a snapshot never fails to
  // parse in the field. Drift is caught here, and in WP-14's own parity test
  // against a real `ngwa_snapshot` payload.
  assert.equal(NgwaPlacementSchema.strict().safeParse(PLACEMENT).success, true);

  for (const stray of ['linkTarget', 'inStore', 'managedBy', 'whatever']) {
    const res = NgwaPlacementSchema.strict().safeParse({ ...PLACEMENT, [stray]: 'x' });
    assert.equal(res.success, false, `strict parse should reject ${stray}`);
  }

  assert.equal(NgwaItemSchema.strict().safeParse(ITEM).success, true);
  assert.equal(
    NgwaItemSchema.strict().safeParse({ ...ITEM, displayName: 'camel twin' }).success,
    false,
  );
  assert.equal(
    NgwaOriginSchema.strict().safeParse({ ...ORIGIN, resolvedVersion: '1.0.0' }).success,
    false,
  );
});

test('Ngwa: the three frozen enum lists match §2 exactly', () => {
  assert.deepEqual([...NGWA_KINDS], [
    'app', 'engine', 'tool', 'sidecar',
    'skill', 'agent', 'command', 'hook',
    'bundle', 'schedule', 'workflow',
  ]);
  assert.deepEqual([...NGWA_SOURCES], [
    'builtin', 'registry', 'git', 'npx', 'local', 'dev', 'catalog',
  ]);
  assert.deepEqual([...NGWA_STATES], [
    'enabled', 'disabled', 'available', 'update', 'orphaned', 'broken',
  ]);
});

// ── (b) invalid kind is rejected ───────────────────────────────────────────

test('Ngwa: an invalid kind is rejected', () => {
  // `project` and `artifact` appear in the older ngwa-surface.html mock but are
  // deliberately NOT in the union (§4) — neither has a producer.
  assert.throws(() => NgwaItemSchema.parse({ ...ITEM, kind: 'project' }));
  assert.throws(() => NgwaItemSchema.parse({ ...ITEM, kind: 'artifact' }));
  assert.throws(() => NgwaItemSchema.parse({ ...ITEM, kind: 'APP' }));
  // …while every frozen kind is accepted.
  for (const k of NGWA_KINDS) {
    assert.equal(NgwaItemSchema.parse({ ...ITEM, kind: k }).kind, k);
  }
});

// ── (c) invalid origin.source is rejected ──────────────────────────────────

test('Ngwa: an invalid origin.source is rejected', () => {
  assert.throws(() =>
    NgwaItemSchema.parse({ ...ITEM, origin: { ...ORIGIN, source: 'ftp' } }),
  );
  assert.throws(() => NgwaOriginSchema.parse({ ...ORIGIN, source: 'marketplace' }));
  assert.throws(() => NgwaOriginSchema.parse({ ...ORIGIN, source: null }));
  for (const s of NGWA_SOURCES) {
    assert.equal(NgwaOriginSchema.parse({ ...ORIGIN, source: s }).source, s);
  }
});

// ── (d) usage: null vs a measured zero ─────────────────────────────────────

test('Ngwa: usage null parses and is distinguishable from a zeroed NgwaUsage', () => {
  const unmeasured = NgwaItemSchema.parse({ ...ITEM, usage: null });
  assert.equal(unmeasured.usage, null);

  const zeroed = NgwaItemSchema.parse({
    ...ITEM,
    usage: {
      source: 'transcript',
      last_used_ms: null,
      count_7d: 0,
      count_30d: 0,
      tokens_30d: 0,
      window_start_ms: 1_724_000_000_000,
    },
  });
  assert.notEqual(zeroed.usage, null);
  assert.equal(zeroed.usage?.count_7d, 0);
  assert.equal(zeroed.usage?.count_30d, 0);

  // The whole point of the nullable: "never measured" must not collapse into a
  // measured zero (frame-workbench-v4.html:2679 — unmeasured reads "—", not 0).
  assert.notDeepEqual(unmeasured.usage, zeroed.usage);
  assert.equal(unmeasured.usage ?? 'dash', 'dash');
  assert.notEqual(zeroed.usage ?? 'dash', 'dash');

  // `usage` is required on the item — absent is not the same as null.
  const { usage: _omit, ...withoutUsage } = ITEM;
  assert.throws(() => NgwaItemSchema.parse(withoutUsage));
});

// ── Scope: the two-arm discriminated union ─────────────────────────────────

test('Ngwa: NgwaScope is a two-arm union discriminated on kind', () => {
  assert.deepEqual(NgwaScopeSchema.parse({ kind: 'personal' }), { kind: 'personal' });
  assert.deepEqual(NgwaScopeSchema.parse({ kind: 'project', project_id: 'p1' }), {
    kind: 'project',
    project_id: 'p1',
  });
  // project_id is required on the project arm, and absent from the personal one.
  assert.throws(() => NgwaScopeSchema.parse({ kind: 'project' }));
  assert.throws(() => NgwaScopeSchema.parse({ kind: 'workspace' }));
});

// ── Nullability and openness the draft calls out explicitly ────────────────

test('Ngwa: runtime is null for items with no supervisor child', () => {
  const skill = NgwaItemSchema.parse({ ...ITEM, kind: 'skill', runtime: null });
  assert.equal(skill.runtime, null);
});

test('Ngwa: Ọba primitives carry trust not_applicable with perms null (§5)', () => {
  const item = NgwaItemSchema.parse({
    ...ITEM,
    kind: 'skill',
    trust: {
      state: 'not_applicable',
      signed: false,
      auto_trusted: false,
      review_pending: false,
      perms: null,
      last_granted_at_ms: null,
    },
  });
  assert.equal(item.trust.state, 'not_applicable');
  assert.equal(item.trust.perms, null);
});

test('Ngwa: NgwaRef.kind stays open, mirroring RequiresEntry.kind', () => {
  // §2: `NgwaKind | string` — a future primitive kind must not break a snapshot.
  assert.equal(NgwaRefSchema.parse({ ...REF, kind: 'mcp' }).kind, 'mcp');
  assert.equal(NgwaRefSchema.parse({ ...REF, kind: 'bundle' }).kind, 'bundle');
  // …but NgwaRef.source is the closed NgwaSource union, nullable.
  assert.equal(NgwaRefSchema.parse({ ...REF, source: null }).source, null);
  assert.throws(() => NgwaRefSchema.parse({ ...REF, source: 'ftp' }));
});

test('Ngwa: an item with no placements is not an error (a pkg app has none)', () => {
  const app = NgwaItemSchema.parse({ ...ITEM, placements: [], engines: [] });
  assert.deepEqual(app.placements, []);
});

test('Ngwa: placement present:false on an enabled item parses (the orphan case)', () => {
  const orphan = NgwaItemSchema.parse({
    ...ITEM,
    state: 'enabled',
    placements: [{ ...PLACEMENT, present: false, link_target: null, format: null }],
  });
  assert.equal(orphan.placements[0]?.present, false);
  assert.equal(orphan.placements[0]?.format, null);
});
