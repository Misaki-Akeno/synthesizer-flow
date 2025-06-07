import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    // 解析请求体中的消息
    const body = await req.json();
    const { messages, apiKey, apiEndpoint } = body;

    // 尝试获取API密钥，优先使用请求中的密钥，然后才是环境变量
    const effectiveApiKey = apiKey || process.env.DASHSCOPE_API_KEY || '';
    
    // 判断API密钥是否存在且不是空字符串
    if (!effectiveApiKey || effectiveApiKey.trim() === '') {
      console.error('缺少有效的API密钥');
      return NextResponse.json(
        { error: '未提供有效的API密钥，请在设置中配置API密钥或者设置环境变量DASHSCOPE_API_KEY' },
        { status: 500 }
      );
    }
    
    // 创建OpenAI客户端实例，使用请求中提供的参数
    const openai = new OpenAI({
      apiKey: effectiveApiKey,
      baseURL: apiEndpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
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

    // 调用OpenAI客户端发送请求到灵积DashScope的兼容API
    const completion = await openai.chat.completions.create({
      model, // 使用请求的模型或默认模型
      messages: messages,
      temperature: 0.7, // 可调整生成文本的随机性
    });

    // 提取并返回响应
    const responseMessage = completion.choices[0].message;

    return NextResponse.json({ message: responseMessage });
  } catch (error) {
    console.error('LLM API调用失败:', error);
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
