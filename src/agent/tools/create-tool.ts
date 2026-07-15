import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { AgentTool } from './types';

type DynamicStructuredToolConstructor = new (input: {
  name: string;
  description: string;
  schema: z.ZodType;
  func: (input: unknown) => Promise<string>;
}) => AgentTool;

// 轻量化 LangChain 工具构造类型，避免把深层泛型扩散到业务代码。
const TypedDynamicStructuredTool =
  DynamicStructuredTool as unknown as DynamicStructuredToolConstructor;

export function createStructuredTool<TSchema extends z.ZodType>(input: {
  name: string;
  description: string;
  schema: TSchema;
  func: (args: z.infer<TSchema>) => Promise<unknown> | unknown;
}): AgentTool {
  return new TypedDynamicStructuredTool({
    name: input.name,
    description: input.description,
    schema: input.schema,
    func: async (args: unknown) =>
      JSON.stringify(await input.func(input.schema.parse(args))),
  });
}
