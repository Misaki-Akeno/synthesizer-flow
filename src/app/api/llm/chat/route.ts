import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// 从环境变量中获取API密钥
const apiKey = process.env.DASHSCOPE_API_KEY || '';

// 创建OpenAI客户端实例并配置为使用阿里云灵积DashScope的兼容模式API
const openai = new OpenAI({
  apiKey,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

export async function POST(req: NextRequest) {
  try {
    // 解析请求体中的消息
    const body = await req.json();
    const { messages } = body;
    if (!apiKey) {
      console.error('缺少DASHSCOPE_API_KEY环境变量');
      return NextResponse.json(
        { error: 'API密钥未配置，请在.env.local文件中设置DASHSCOPE_API_KEY' },
        { status: 500 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: '请提供有效的消息数组' },
        { status: 400 }
      );
    }

    // 调用OpenAI客户端发送请求到灵积DashScope的兼容API
    const completion = await openai.chat.completions.create({
      model: 'qwen-turbo-2025-04-28', // 使用请求的模型
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
