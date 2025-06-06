# Synthesizer Flow

Synthesizer Flow 致力于构建模块化合成器。可以通过菜单来添加不同的音频模块，然后用接口相互连接，可以制造想要的任何声音。可以用虚拟midi键盘模块，连接到振荡器，再用调制器来控制振荡器波形，并把信号输出到调音台和扬声器模块，实现音乐生成！还可以用音序器来自动化播放音乐，通过时序器模块来控制拍子和歌曲进度，音序器根据时序来自动输出midi！

## TODO:

import OpenAI from "openai";

const openai = new OpenAI(
{
// 若没有配置环境变量，请用百炼API Key将下行替换为：apiKey: "sk-xxx",
apiKey: process.env.DASHSCOPE_API_KEY,
baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
}
);

async function main() {
const completion = await openai.chat.completions.create({
model: "qwen-plus", //此处以qwen-plus为例，可按需更换模型名称。模型列表：https://help.aliyun.com/zh/model-studio/getting-started/models
messages: [
{ role: "system", content: "You are a helpful assistant." },
{ role: "user", content: "你是谁？" }
],
});
console.log(JSON.stringify(completion))
}

main();

qwen-turbo-2025-04-28

sk-54056568f07c478abb540d18ea2fe6e5
