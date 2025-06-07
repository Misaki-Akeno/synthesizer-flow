/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { tools } from '@/lib/llm/tools';
import { executeToolCall } from '@/lib/llm/toolsExecutor';
import { createServerLogger } from '@/lib/serverLogger';

// 创建服务端日志记录器，避免在服务端使用toast
const logger = createServerLogger('LLM-API');

export async function POST(req: NextRequest) {
  try {
    // 解析请求体中的消息
    const body = await req.json();
    const { messages, apiKey, apiEndpoint, useTools = true } = body;

    // 尝试获取API密钥，优先使用请求中的密钥，然后才是环境变量
    const effectiveApiKey = apiKey || process.env.DASHSCOPE_API_KEY || '';

    // 判断API密钥是否存在且不是空字符串
    if (!effectiveApiKey || effectiveApiKey.trim() === '') {
      logger.error('缺少有效的API密钥');
      return NextResponse.json(
        {
          error:
            '未提供有效的API密钥，请在设置中配置API密钥或者设置环境变量DASHSCOPE_API_KEY',
        },
        { status: 500 }
      );
    }

    // 创建OpenAI客户端实例，使用请求中提供的参数
    const openai = new OpenAI({
      apiKey: effectiveApiKey,
      baseURL:
        apiEndpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: '请提供有效的消息数组' },
        { status: 400 }
      );
    }

    // 从请求体中获取模型名称，如果没有则使用默认值
    const { modelName } = body;
    const model = modelName || 'qwen-turbo-2025-04-28';

    // 准备请求参数，根据useTools决定是否启用工具
    const completionParams: any = {
      model, // 使用请求的模型或默认模型
      messages: messages,
      temperature: 0.7, // 可调整生成文本的随机性
    };

    // 如果启用工具，添加tools配置
    if (useTools) {
      completionParams.tools = tools;
      completionParams.tool_choice = 'auto'; // 允许模型决定是否使用工具
    }

    // 调用OpenAI客户端发送请求
    const completion = await openai.chat.completions.create(completionParams);

    // 提取响应消息
    const responseMessage = completion.choices[0].message;

    // 检查是否有工具调用
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      logger.info('检测到工具调用，执行工具...');

      // 执行工具调用
      const toolCalls = responseMessage.tool_calls;
      const toolResults = [];

      for (const toolCall of toolCalls) {
        const result = await executeToolCall(toolCall);
        toolResults.push({
          toolCallId: toolCall.id,
          result,
        });
      }

      // 构建新的消息数组，包含工具调用结果
      const updatedMessages = [
        ...messages,
        responseMessage, // 添加助手的响应（包含工具调用）
        ...toolResults.map((result) => ({
          role: 'tool',
          content: result.result,
          tool_call_id: result.toolCallId,
        })),
      ];

      // 再次调用模型，传入工具执行结果
      const secondCompletion = await openai.chat.completions.create({
        model,
        messages: updatedMessages as any, // TypeScript类型问题，暂时使用any
        temperature: 0.7,
      });

      const finalResponse = secondCompletion.choices[0].message;

      // 返回带有工具调用和最终响应的完整结果
      return NextResponse.json({
        message: finalResponse,
        toolCalls: toolCalls,
        toolResults: toolResults,
        hasToolUse: true,
      });
    }

    // 如果没有工具调用，直接返回响应
    return NextResponse.json({ message: responseMessage, hasToolUse: false });
  } catch (error) {
    logger.error('LLM API调用失败', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      {
        error: '处理请求时出错',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
