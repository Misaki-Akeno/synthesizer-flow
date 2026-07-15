import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadEnvConfig } from '@next/env';
import { describe, expect, it } from 'vitest';
import goldenSetData from './golden-set.json';
import { parseGoldenSet } from './schema';
import { runGoldenBench } from './runner';
import { formatBenchReport } from './report';
import { createLiveAgentEvalTarget } from './live-target';
import { readLiveBenchConfig } from './live-config';

loadEnvConfig(process.cwd());

describe('Agent Golden Set benchmark', () => {
  it(
    'meets the configured quality gate',
    async () => {
      const config = readLiveBenchConfig();
      const goldenSet = parseGoldenSet(goldenSetData);
      const target = createLiveAgentEvalTarget(config.settings);
      const report = await runGoldenBench(goldenSet, target, {
        repetitions: config.repetitions,
      });
      const reportPath = resolve(process.cwd(), config.reportPath);

      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(
        reportPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
      );

      const summary = formatBenchReport(report);
      process.stdout.write(`${summary}\nReport: ${reportPath}\n`);

      expect(report.passed, summary).toBe(true);
    },
    10 * 60 * 1000
  );
});
