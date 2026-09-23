import { z } from 'zod';
import { NgwaScopeSchema } from './ngwa.js';

export const WORKFLOW_NODE_KINDS = [
  'phase',
  'step',
  'agent',
  'skill',
  'command',
  'tool',
  'gate',
  'schedule',
] as const;
export const WORKFLOW_EDGE_KINDS = ['depends-on', 'parallel', 'triggers'] as const;

export const WorkflowNodeSchema = z
  .object({
    id: z.string(),
    kind: z.enum(WORKFLOW_NODE_KINDS),
    label: z.string(),
    /** How it runs. Null for structural nodes (phase, gate-as-marker). */
    run: z
      .object({
        kind: z.enum(['dispatch', 'command', 'skill', 'agent', 'tool', 'schedule']),
        /** Target reference: skill name | agent type | MCP tool id | shell command.
         *  Per DEC-41 / G-37: when `kind` is `'command'`, `ref` may carry a `/iyke/` bridge
         *  address (`/iyke/pkg/<pkg_id>/<cmd>`) invoking an iyke-routed package handler. */
        ref: z.string().optional(),
        engine_id: z.string().optional(),
      })
      .nullable(),
    source_ref: z.string().optional(), // provenance: file path + anchor in the source format
  })
  .strict();

export const WorkflowEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    kind: z.enum(WORKFLOW_EDGE_KINDS),
  })
  .strict();

export const WorkflowGraphSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    scope: NgwaScopeSchema, // re-export from ./ngwa
    source: z.enum(['groundwork', 'claude-workflow', 'plugin', 'hooks', 'cron', 'agent-ops', 'manual']),
    source_path: z.string().nullable(),
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
    updated_at_ms: z.number().nullable(),
  })
  .strict();

export type WorkflowNodeKind = (typeof WORKFLOW_NODE_KINDS)[number];
export type WorkflowEdgeKind = (typeof WORKFLOW_EDGE_KINDS)[number];
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;
