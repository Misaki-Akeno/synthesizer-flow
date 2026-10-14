import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function listModuleSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listModuleSources(fullPath);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
      ? [fullPath]
      : [];
  });
}

describe('module classes on the server', () => {
  // Agent 的 skill_list/skill_load 在服务端读取模块类的静态 metadata。
  // 'use client' 会让 Next.js 在服务端把模块替换为客户端引用代理，
  // 导致 metadata 为 undefined；vitest 不处理该指令，所以只能静态检查。
  it('does not mark module class files with use client', () => {
    const modulesDir = __dirname;
    const offenders = listModuleSources(modulesDir)
      .filter((file) =>
        /^\s*['"]use client['"]/.test(readFileSync(file, 'utf8'))
      )
      .map((file) => relative(modulesDir, file));

    expect(offenders).toEqual([]);
  });
});
