import { z } from 'zod';
import type { GoldenSet } from './types';

const parameterValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
]);
const stringRecordSchema = z.record(z.string());

const graphStateSchema = z
  .object({
    nodes: z.array(
      z.object({
        id: z.string().trim().min(1),
        type: z.string().optional(),
        position: z.object({ x: z.number().finite(), y: z.number().finite() }),
        data: z.object({
          type: z.string().trim().min(1),
          label: z.string().optional(),
          parameters: z.record(parameterValueSchema).optional(),
          ports: z
            .object({
              inputs: stringRecordSchema.optional(),
              outputs: stringRecordSchema.optional(),
            })
            .optional(),
        }),
        selected: z.boolean().optional(),
      })
    ),
    edges: z.array(
      z.object({
        id: z.string().optional(),
        source: z.string().trim().min(1),
        target: z.string().trim().min(1),
        sourceHandle: z.string().nullable().optional(),
        targetHandle: z.string().nullable().optional(),
      })
    ),
  })
  .superRefine((state, context) => {
    const nodeIds = new Set<string>();
    state.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', index, 'id'],
          message: `duplicate node id: ${node.id}`,
        });
      }
      nodeIds.add(node.id);
    });

    state.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.source)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', index, 'source'],
          message: `missing source node: ${edge.source}`,
        });
      }
      if (!nodeIds.has(edge.target)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', index, 'target'],
          message: `missing target node: ${edge.target}`,
        });
      }
    });
  });

const expectedSchema = z
  .object({
    tools: z
      .object({
        mode: z.enum(['exact', 'contains', 'ordered']).default('ordered'),
        names: z.array(z.string().trim().min(1)).min(1),
        arguments: z
          .array(
            z.object({
              name: z.string().trim().min(1),
              includes: z.record(z.unknown()),
            })
          )
          .optional(),
      })
      .optional(),
    operations: z
      .object({
        mode: z.enum(['exact', 'contains']).default('contains'),
        items: z
          .array(
            z.object({
              type: z.enum([
                'ADD_MODULE',
                'DELETE_MODULE',
                'UPDATE_MODULE_PARAM',
                'CONNECT_MODULES',
                'DISCONNECT_MODULES',
                'ERROR',
              ]),
              data: z.record(z.unknown()).optional(),
            })
          )
          .min(1),
      })
      .optional(),
    approvalRequired: z.boolean().optional(),
    response: z
      .object({
        containsAll: z.array(z.string().min(1)).optional(),
        excludes: z.array(z.string().min(1)).optional(),
        minLength: z.number().int().min(0).optional(),
      })
      .optional(),
  })
  .refine(
    (expected) =>
      expected.tools !== undefined ||
      expected.operations !== undefined ||
      expected.approvalRequired !== undefined ||
      expected.response !== undefined,
    'expected must define at least one criterion'
  );

export const goldenSetSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1),
    description: z.string().optional(),
    qualityGate: z
      .object({
        minCasePassRate: z.number().min(0).max(1).default(1),
        minAverageScore: z.number().min(0).max(1).default(1),
      })
      .default({ minCasePassRate: 1, minAverageScore: 1 }),
    cases: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(100),
          description: z.string().trim().min(1),
          tags: z.array(z.string().trim().min(1)).default([]),
          messages: z
            .array(
              z.object({
                role: z.enum(['user', 'assistant', 'system']),
                content: z.string(),
              })
            )
            .min(1),
          initialState: graphStateSchema,
          expected: expectedSchema,
          threshold: z.number().min(0).max(1).default(1),
          minSamplePassRate: z.number().min(0).max(1).default(1),
        })
      )
      .min(1),
  })
  .superRefine((goldenSet, context) => {
    const ids = new Set<string>();
    goldenSet.cases.forEach((goldenCase, index) => {
      if (ids.has(goldenCase.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cases', index, 'id'],
          message: `duplicate case id: ${goldenCase.id}`,
        });
      }
      ids.add(goldenCase.id);
    });
  });

export function parseGoldenSet(input: unknown): GoldenSet {
  return goldenSetSchema.parse(input) as GoldenSet;
}
