/** 比较持久化画布内容；导出时间不代表用户编辑。 */
export function canvasFingerprint(jsonData: string): string | null {
  try {
    const parsed = JSON.parse(jsonData) as Record<string, unknown>;
    delete parsed.timestamp;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}
