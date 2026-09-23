import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKFLOW_EDGE_KINDS,
  WORKFLOW_NODE_KINDS,
  WorkflowEdgeSchema,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
} from './workflow-graph.js';

test('WorkflowNodeSchema: parses valid node and rejects unknown fields (.strict)', () => {
  const node = WorkflowNodeSchema.parse({
    id: 'step-1',
    kind: 'step',
    label: 'Run build',
    run: {
      kind: 'command',
      ref: '/iyke/pkg/com.ikenga.studio/build',
    },
    source_ref: 'manifest.json#/workflows/0/steps/0',
  });
  assert.equal(node.id, 'step-1');
  assert.equal(node.kind, 'step');
  assert.equal(node.run?.kind, 'command');
  assert.equal(node.run?.ref, '/iyke/pkg/com.ikenga.studio/build');

  // Structural node with run: null
  const phaseNode = WorkflowNodeSchema.parse({
    id: 'phase-1',
    kind: 'phase',
    label: 'Wave 9a',
    run: null,
  });
  assert.equal(phaseNode.run, null);

  // Unknown field rejects
  assert.equal(
    WorkflowNodeSchema.safeParse({
      id: 'step-2',
      kind: 'step',
      label: 'Extra',
      run: null,
      unknown_field: true,
    }).success,
    false,
  );
});

test('WorkflowEdgeSchema: parses edge kinds and rejects unknown fields (.strict)', () => {
  for (const kind of WORKFLOW_EDGE_KINDS) {
    const edge = WorkflowEdgeSchema.parse({
      from: 'node-a',
      to: 'node-b',
      kind,
    });
    assert.equal(edge.kind, kind);
  }

  assert.equal(
    WorkflowEdgeSchema.safeParse({
      from: 'node-a',
      to: 'node-b',
      kind: 'bogus',
    }).success,
    false,
  );
});

test('WorkflowGraphSchema: parses complete graph per G-MANIFEST-V5 §6', () => {
  const graph = WorkflowGraphSchema.parse({
    id: 'com.ikenga.studio:build-pipeline',
    title: 'Studio Build Pipeline',
    scope: { kind: 'personal' },
    source: 'groundwork',
    source_path: 'plans/shell-ux-rearchitecture/09-orchestration.md',
    nodes: [
      {
        id: 'phase-1',
        kind: 'phase',
        label: 'Wave 1',
        run: null,
      },
      {
        id: 'step-1',
        kind: 'step',
        label: 'Step 1',
        run: {
          kind: 'command',
          ref: '/iyke/pkg/com.ikenga.studio/build',
        },
      },
    ],
    edges: [
      {
        from: 'phase-1',
        to: 'step-1',
        kind: 'depends-on',
      },
    ],
    updated_at_ms: 1727000000000,
  });

  assert.equal(graph.id, 'com.ikenga.studio:build-pipeline');
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.nodes[0]?.kind, 'phase');
});

test('WorkflowGraphSchema: project scope is accepted', () => {
  const graph = WorkflowGraphSchema.parse({
    id: 'proj-wf',
    title: 'Project Workflow',
    scope: { kind: 'project', project_id: 'proj-123' },
    source: 'claude-workflow',
    source_path: null,
    nodes: [],
    edges: [],
    updated_at_ms: null,
  });

  assert.equal(graph.scope.kind, 'project');
  if (graph.scope.kind === 'project') {
    assert.equal(graph.scope.project_id, 'proj-123');
  }
});
