/**
 * Markdown 语义分割器
 * 
 * 基于 Markdown 标题和结构进行文本分割，尽量保持语义完整性。
 */

export interface SplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export class MarkdownSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options: SplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 2000;
    this.chunkOverlap = options.chunkOverlap ?? 200;
  }

  /**
   * 将 Markdown 文本分割成较小的语义块
   */
  splitText(text: string): string[] {
    // 1. 预处理：统一换行符
    const normalizedText = text.replace(/\r\n/g, '\n');
    
    // 2. 识别所有的 header
    // 我们尝试按最高级别的 header 分割，如果不够细再往下级分
    // 这里采用一个简化的策略：
    // 遍历每一行，如果是 Header，往往意味着新话题的开始。
    // 我们累积行，直到超出 chunkSize，或者遇到一个新的 Header 且当前块已经足够大。
    
    const lines = normalizedText.split('\n');
    const chunks: string[] = [];
    let currentChunkLines: string[] = [];
    let currentLength = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLen = line.length + 1; // +1 for newline
      const isHeader = /^#{1,6}\s/.test(line); // 匹配 # Title
      
      // 决策点：是否结束当前块？
      // 条件 1: 当前块加上新行会非常大 (超过 Safe Limit)
      // 条件 2: 遇到 Header，且当前块已经有相当的内容 (避免 Header 之前只有一两行闲聊被单独切分，或者 Header 紧接着子 Header)
      
      const willExceedLimit = currentLength + lineLen > this.chunkSize;
      
      // 如果是一行特别长的代码或文本，超过了 chunkSize，我们不得不强制切分（或者让它单独成块）
      // 这里简化处理：如果单行就超长，就让它独立成块(虽然超标)或者强行截断。
      // 为保持逻辑简单，我们允许单行超标，但在之后尽量切断。
      
      if (willExceedLimit) {
        // 必须切分了
        this.flushChunk(chunks, currentChunkLines);
        currentChunkLines = [line];
        currentLength = lineLen;
      } else if (isHeader && currentLength > this.chunkSize * 0.3) { 
        // 遇到了 Header，且当前积累的内容已经超过 30% chunkSize (比如 >600字)，
        // 那么我们可以认为这是一个较好的分割点，开始新的语义块。
        // 如果当前块太小，我们就不切分，尽量让这个 Header 和上面的内容在一起（或者视作紧密相关）。
        // *但在 RAG 中，通常希望 Header 是块的开始*。
        // 所以策略调整：遇到 Header，只要当前块不是空的，就切分？
        // 这样可以确保 Header 总是位于 Chunk 开头，利于检索。
        
        // 但如果前一段只有一行字，切分就太琐碎了。
        // 折中：遇到 Header，除非前一段很短(<100 chars)，否则切分。
        if (currentLength > 100) {
           this.flushChunk(chunks, currentChunkLines);
           currentChunkLines = [line];
           currentLength = lineLen;
        } else {
           currentChunkLines.push(line);
           currentLength += lineLen;
        }
      } else {
        currentChunkLines.push(line);
        currentLength += lineLen;
      }
    }

    // Flush last chunk
    this.flushChunk(chunks, currentChunkLines);

    return chunks;
  }

  private flushChunk(chunks: string[], lines: string[]) {
    if (lines.length === 0) return;
    chunks.push(lines.join('\n'));
  }
}

// 导出单例或工具函数
export const splitMarkdown = (text: string, options?: SplitterOptions) => {
  const splitter = new MarkdownSplitter(options);
  return splitter.splitText(text);
};
