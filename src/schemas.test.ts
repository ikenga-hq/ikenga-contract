import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { IKENGA_API_VERSION, IKENGA_API_MIN_SUPPORTED, ManifestSchema } from './manifest.js';
import { RegistryEntrySchema } from './registry.js';
// The generator is a plain script; it reads the compiled output in `dist/`,
// so `pnpm build` must run before this test (CI does).
// @ts-expect-error -- no type declarations for the .mjs script
import { buildSchemas, serializeSchema } from '../scripts/generate-schemas.mjs';

type Built = { relPath: string; json: Record<string, any> };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built: Built[] = buildSchemas();

function find(relPath: string): Record<string, any> {
  const hit = built.find((b) => b.relPath === relPath);
  assert.ok(hit, `buildSchemas() has no ${relPath}`);
  return hit.json;
}

// Staleness: the committed files are the output of the generator. When this
// fails, run `pnpm build && pnpm generate:schemas` and commit the result.
for (const { relPath, json } of built) {
  test(`schemas/${relPath} matches the generator output`, () => {
    const committed = readFileSync(path.join(root, 'schemas', relPath), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(
      committed,
      serializeSchema(json),
      `schemas/${relPath} is stale: run "pnpm build && pnpm generate:schemas"`,
    );
  });
}

test('every schema has a registry.ikenga.dev $id that matches its path', () => {
  for (const { relPath, json } of built) {
    assert.equal(json.$id, `https://registry.ikenga.dev/schemas/${relPath}`, relPath);
  }
});

// ── Manifest JSON Schema ────────────────────────────────────────────────────

const manifestPath = `manifest/v${IKENGA_API_VERSION}.json`;

function manifestRoot(): Record<string, any> {
  const doc = find(manifestPath);
  assert.equal(doc.$ref, '#/definitions/IkengaManifest');
  return doc.definitions.IkengaManifest;
}

test('manifest schema is draft-07 with the versioned $id', () => {
  const doc = find(manifestPath);
  assert.equal(doc.$schema, 'http://json-schema.org/draft-07/schema#');
  assert.equal(doc.$id, `https://registry.ikenga.dev/schemas/manifest/v${IKENGA_API_VERSION}.json`);
});

test('manifest schema records the API level and its support window', () => {
  const x = find(manifestPath)['x-ikenga'];
  assert.equal(x.ikenga_api, IKENGA_API_VERSION);
  assert.equal(x.min_supported, IKENGA_API_MIN_SUPPORTED);
  assert.ok(Array.isArray(x.rules) && x.rules.length >= 1);
  for (const rule of x.rules) assert.equal(typeof rule, 'string');
});

test('manifest schema rejects unknown top-level keys and requires the four core fields', () => {
  const m = manifestRoot();
  assert.equal(m.type, 'object');
  assert.equal(m.additionalProperties, false);
  assert.deepEqual(m.required, ['id', 'name', 'version', 'ikenga_api']);
});

test('manifest schema does not list the retired asset-bundling fields', () => {
  const props = manifestRoot().properties;
  for (const retired of ['skills', 'commands', 'agents']) {
    assert.equal(retired in props, false, `${retired} must be absent`);
  }
});

test('manifest schema rejects the removed ui.nav and ui.side_pane_viewers keys', () => {
  const ui = manifestRoot().properties.ui;
  assert.ok(ui, 'ui block is present');
  assert.deepEqual(ui.properties.nav, { not: {} });
  assert.deepEqual(ui.properties.side_pane_viewers, { not: {} });
});

test('manifest schema has the seven capability keys and ten permission keys', () => {
  const props = manifestRoot().properties;
  assert.deepEqual(
    Object.keys(props.capabilities.properties).sort(),
    ['agentOps', 'http', 'invoke', 'secrets', 'sqlite', 'supabase', 'webview'],
  );
  assert.equal(Object.keys(props.permissions.properties).length, 10);
});

test('manifest schema accepts the sqlite: true shorthand authors write', () => {
  const sqlite = manifestRoot().properties.capabilities.properties.sqlite;
  const text = JSON.stringify(sqlite);
  assert.match(text, /"type":"boolean"/);
  // And the Zod source agrees, so the schema is not looser than the parser.
  const parsed = ManifestSchema.safeParse({
    id: 'com.example.app',
    name: 'Example',
    version: '0.0.1',
    ikenga_api: '5',
    permissions: {},
    capabilities: { sqlite: true },
  });
  assert.equal(parsed.success, true);
});

// ── Registry index: derived kind ────────────────────────────────────────────

test('registry index schema carries the optional derived kind', () => {
  const doc = find('registry/index-v1.json');
  const entry = doc.definitions.IkengaRegistryIndex.properties.pkgs.items;
  assert.ok(entry.properties.ngwaKind, 'ngwaKind is declared');
  assert.equal(entry.required.includes('ngwaKind'), false, 'ngwaKind stays optional');
});

test('RegistryEntrySchema accepts a row with and without ngwaKind, and rejects an unknown kind', () => {
  const row = { name: '@ikenga/mcp-browser', latest: '0.3.1', detail: 'pkgs/mcp-browser.json', kind: 'skill' };
  assert.equal(RegistryEntrySchema.safeParse(row).success, true);
  assert.equal(RegistryEntrySchema.safeParse({ ...row, ngwaKind: 'tool' }).success, true);
  assert.equal(RegistryEntrySchema.safeParse({ ...row, ngwaKind: 'gadget' }).success, false);
});
