import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_MODEL_ID,
  MODEL_CATALOG,
  MODEL_TIER_ALIASES,
  ModelCatalogFileSchema,
  ModelCatalogSchema,
  buildModelCatalogFile,
  defaultModelFor,
  estimateCostUsd,
  findModel,
} from './models.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('MODEL_CATALOG parses against its schema', () => {
  ModelCatalogSchema.parse(MODEL_CATALOG);
});

test('role defaults: Sonnet 5.5 for chi and pane, Opus 5.5 for plan', () => {
  assert.equal(defaultModelFor('chi').id, 'claude-sonnet-5-5');
  assert.equal(defaultModelFor('pane').id, 'claude-sonnet-5-5');
  assert.equal(defaultModelFor('plan').id, 'claude-opus-5-5');
  assert.equal(DEFAULT_MODEL_ID, defaultModelFor('pane').id);
});

test('Fable 5.1 is in the catalog but is no role default', () => {
  const fable = findModel('claude-fable-5-1');
  assert.ok(fable);
  assert.equal(fable.defaultFor, undefined);
});

test('groundwork tier aliases map to rows', () => {
  assert.equal(MODEL_TIER_ALIASES.opus.id, 'claude-opus-5-5');
  assert.equal(MODEL_TIER_ALIASES.sonnet.id, 'claude-sonnet-5-5');
  assert.equal(MODEL_TIER_ALIASES.haiku.id, 'claude-haiku-4-5');
  assert.equal(MODEL_TIER_ALIASES.fable.id, 'claude-fable-5-1');
  assert.equal(findModel('sonnet')?.id, 'claude-sonnet-5-5');
  assert.equal(findModel('claude-sonnet-4-6'), undefined);
});

test('every price is verified and dated', () => {
  for (const row of MODEL_CATALOG) {
    for (const [k, v] of Object.entries(row.pricing)) {
      assert.equal(typeof v, 'number', `${row.id}.${k} is unverified`);
    }
    assert.match(row.pricingVerifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.source.length > 0);
  }
});

test('verified prices (pricing page, 2026-10-04)', () => {
  const p = (id: string) => findModel(id)!.pricing;
  assert.deepEqual(p('claude-opus-5-5'), { inPerMtok: 4, outPerMtok: 20, cacheReadPerMtok: 0.2, cacheWritePerMtok: 5 });
  assert.deepEqual(p('claude-sonnet-5-5'), { inPerMtok: 2, outPerMtok: 10, cacheReadPerMtok: 0.2, cacheWritePerMtok: 2.5 });
  assert.deepEqual(p('claude-haiku-4-5'), { inPerMtok: 1, outPerMtok: 5, cacheReadPerMtok: 0.1, cacheWritePerMtok: 1.25 });
  assert.deepEqual(p('claude-fable-5-1'), { inPerMtok: 10, outPerMtok: 50, cacheReadPerMtok: 0.25, cacheWritePerMtok: 12.5 });
});

test('the catalog schema rejects duplicate role defaults and missing roles', () => {
  const dup = MODEL_CATALOG.map((r) => ({ ...r, defaultFor: ['plan' as const] }));
  assert.equal(ModelCatalogSchema.safeParse(dup).success, false);
  const none = MODEL_CATALOG.map(({ defaultFor: _d, ...r }) => r);
  assert.equal(ModelCatalogSchema.safeParse(none).success, false);
});

test('estimateCostUsd prices each token class', () => {
  const cost = estimateCostUsd('claude-sonnet-5-5', {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheReadTokens: 1_000_000,
    cacheWriteTokens: 1_000_000,
  });
  assert.equal(cost, 2 + 10 + 0.2 + 2.5);
  assert.equal(estimateCostUsd('sonnet', { outputTokens: 500_000 }), 5);
  assert.equal(estimateCostUsd('claude-sonnet-4-6', { inputTokens: 1 }), null);
});

test('schemas/models.json is the catalog and validates', () => {
  const committed = JSON.parse(readFileSync(path.join(root, 'schemas', 'models.json'), 'utf8'));
  const doc = ModelCatalogFileSchema.parse(committed);
  assert.deepEqual(doc, buildModelCatalogFile());
  assert.equal(doc.defaultModel, 'claude-sonnet-5-5');
  assert.deepEqual(doc.roles, { chi: 'claude-sonnet-5-5', pane: 'claude-sonnet-5-5', plan: 'claude-opus-5-5' });
});
