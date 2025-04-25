'use client';

/**
 * 序列化数据验证器
 * 使用Zod验证从JSON反序列化的数据结构
 */

import { z } from 'zod';
import { createModuleLogger } from '@/lib/logger';

// 创建模块专用日志记录器
const logger = createModuleLogger('SerializationValidator');

// 序列化节点数据验证模式
export const SerializedNodeSchema = z.object({
  id: z.string().min(1, '节点ID不能为空'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z
    .object({
      type: z.string().min(1, '节点类型不能为空'),
      label: z.string().optional(),
      parameters: z
        .record(z.union([z.number(), z.boolean(), z.string()]))
        .optional(),
    })
    .and(z.record(z.unknown())),
});

// 序列化边数据验证模式
export const SerializedEdgeSchema = z.object({
  source: z.string().min(1, '源节点ID不能为空'),
  target: z.string().min(1, '目标节点ID不能为空'),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

// 序列化模块数据验证模式
export const SerializedModuleSchema = z.object({
  moduleType: z.string().min(1, '模块类型不能为空'),
  id: z.string().min(1, '模块ID不能为空'),
  name: z.string(),
  parameters: z.record(z.unknown()),
  inputPortTypes: z.record(z.string()),
  outputPortTypes: z.record(z.string()),
  customUI: z
    .object({
      type: z.string(),
      props: z.record(z.unknown()),
    })
    .optional(),
  enabled: z.boolean().optional(),
});

// 序列化画布数据验证模式
export const SerializedCanvasSchema = z.object({
  version: z.string().regex(/^\d+\.\d+$/, '版本格式应为X.Y'),
  timestamp: z.number().int().positive(),
  nodes: z.array(SerializedNodeSchema),
  edges: z.array(SerializedEdgeSchema),
  metadata: z.record(z.unknown()).optional(),
});

// 内置预设项目验证模式
export const BuiltInProjectSchema = z.object({
  id: z.string().min(1, '预设ID不能为空'),
  name: z.string().min(1, '预设名称不能为空'),
  canvasData: SerializedCanvasSchema,
});

// 项目配置验证模式
export const ProjectConfigSchema = z.object({
  id: z.string().min(1, '项目ID不能为空'),
  name: z.string().min(1, '项目名称不能为空'),
  description: z.string().optional(),
  created: z.string().datetime(),
  lastModified: z.string().datetime(),
  data: z.string().min(1, '项目数据不能为空'),
  isBuiltIn: z.boolean().optional(),
});

/**
 * 验证序列化的节点数据
 * @param data 待验证的数据
 * @returns 验证结果，包含验证是否通过以及错误信息
 */
export function validateSerializedNode(data: unknown) {
  try {
    SerializedNodeSchema.parse(data);
    return { success: true };
  } catch (error) {
    logger.error('节点数据验证失败', error);
    return {
      success: false,
      error: error instanceof z.ZodError ? error.format() : String(error),
    };
  }
}

/**
 * 验证序列化的边数据
 * @param data 待验证的数据
 * @returns 验证结果，包含验证是否通过以及错误信息
 */
export function validateSerializedEdge(data: unknown) {
  try {
    SerializedEdgeSchema.parse(data);
    return { success: true };
  } catch (error) {
    logger.error('边数据验证失败', error);
    return {
      success: false,
      error: error instanceof z.ZodError ? error.format() : String(error),
    };
  }
}

/**
 * 验证序列化的模块数据
 * @param data 待验证的数据
 * @returns 验证结果，包含验证是否通过以及错误信息
 */
export function validateSerializedModule(data: unknown) {
  try {
    SerializedModuleSchema.parse(data);
    return { success: true };
  } catch (error) {
    logger.error('模块数据验证失败', error);
    return {
      success: false,
      error: error instanceof z.ZodError ? error.format() : String(error),
    };
  }
}

/**
 * 验证序列化的画布数据
 * @param data 待验证的数据
 * @returns 验证结果，包含验证是否通过以及错误信息
 */
export function validateSerializedCanvas(data: unknown) {
  try {
    SerializedCanvasSchema.parse(data);
    return { success: true };
  } catch (error) {
    logger.error('画布数据验证失败', error);
    return {
      success: false,
      error: error instanceof z.ZodError ? error.format() : String(error),
    };
  }
}

/**
 * 验证序列化的项目配置数据
 * @param data 待验证的数据
 * @returns 验证结果，包含验证是否通过以及错误信息
 */
export function validateProjectConfig(data: unknown) {
  try {
    ProjectConfigSchema.parse(data);
    return { success: true };
  } catch (error) {
    logger.error('项目配置数据验证失败', error);
    return {
      success: false,
      error: error instanceof z.ZodError ? error.format() : String(error),
    };
  }
}

/**
 * 验证JSON字符串并解析为指定类型
 * @param jsonString JSON字符串
 * @param validator 验证函数
 * @returns 解析结果，包含是否成功、解析后的数据或错误信息
 */
export function validateAndParseJson<T>(
  jsonString: string,
  validator: (data: unknown) => { success: boolean; error?: unknown }
): { success: boolean; data?: T; error?: unknown } {
  try {
    // 首先尝试解析JSON
    const parsedData = JSON.parse(jsonString) as unknown;

    // 然后验证解析后的数据结构
    const validationResult = validator(parsedData);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error,
      };
    }

    return {
      success: true,
      data: parsedData as T,
    };
  } catch (error) {
    logger.error('JSON解析失败', error);
    return {
      success: false,
      error: String(error),
    };
  }
}
