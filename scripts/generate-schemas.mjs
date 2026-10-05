#!/usr/bin/env node
// Generates JSON Schema files from Zod sources of truth, plus the generated
// data files (the model catalog JSON).
// Run via: pnpm generate:schemas
//
// `buildSchemas()` is pure (it returns the documents and writes nothing), so
// tests can compare every schema with its committed file. Running this file
// directly writes them under `schemas/`.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ArtifactManifestSchema } from '../dist/artifact.js';
import { RegistryIndexSchema, PkgDetailSchema } from '../dist/registry.js';
import {
  ManifestSchema,
  IKENGA_API_VERSION,
  IKENGA_API_MIN_SUPPORTED,
} from '../dist/manifest.js';
import {
  ModelCatalogFileSchema,
  MODEL_CATALOG_SCHEMA_ID,
  buildModelCatalogFile,
} from '../dist/models.js';

const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), '..');

/**
 * Checks a JSON Schema cannot express, in plain language. Keep this list in
 * step with the `superRefine` calls in `src/manifest.ts`.
 */
const MANIFEST_RULES = [
  'Every ui.views[].route must match a path declared in ui.routes[].',
];

function emit(relPath, schema, name, idUrl, extra) {
  const json = zodToJsonSchema(schema, { name, $refStrategy: 'none' });
  json.$id = idUrl;
  if (extra) Object.assign(json, extra);
  return { relPath, json };
}

/** Returns every schema as `{ relPath, json }`, relative to `schemas/`. */
export function buildSchemas() {
  return [
    emit(
      'artifact/v0.json',
      ArtifactManifestSchema,
      'IkengaArtifactManifest',
      'https://registry.ikenga.dev/schemas/artifact/v0.json',
    ),
    emit(
      'manifest/v' + IKENGA_API_VERSION + '.json',
      ManifestSchema,
      'IkengaManifest',
      'https://registry.ikenga.dev/schemas/manifest/v' + IKENGA_API_VERSION + '.json',
      {
        'x-ikenga': {
          ikenga_api: IKENGA_API_VERSION,
          min_supported: IKENGA_API_MIN_SUPPORTED,
          rules: MANIFEST_RULES,
        },
      },
    ),
    emit(
      'registry/index-v1.json',
      RegistryIndexSchema,
      'IkengaRegistryIndex',
      'https://registry.ikenga.dev/schemas/registry/index-v1.json',
    ),
    emit(
      'registry/pkg-detail-v1.json',
      PkgDetailSchema,
      'IkengaRegistryPkgDetail',
      'https://registry.ikenga.dev/schemas/registry/pkg-detail-v1.json',
    ),
    emit('models/catalog-v1.json', ModelCatalogFileSchema, 'IkengaModelCatalog', MODEL_CATALOG_SCHEMA_ID),
  ];
}

/**
 * Generated data files (not schemas) as `{ relPath, json }`, relative to
 * `schemas/`. `models.json` is the Claude model catalog for readers that can't
 * import TypeScript: the Rust shell and pkg manifests.
 */
export function buildData() {
  return [{ relPath: 'models.json', json: buildModelCatalogFile() }];
}

/** The exact bytes written for one schema: 2-space JSON, final newline. */
export function serializeSchema(json) {
  return JSON.stringify(json, null, 2) + '\n';
}

async function main() {
  for (const { relPath, json } of [...buildSchemas(), ...buildData()]) {
    const out = path.join(root, 'schemas', relPath);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, serializeSchema(json), 'utf8');
    console.log('Wrote', path.relative(root, out));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === here) {
  await main();
}
