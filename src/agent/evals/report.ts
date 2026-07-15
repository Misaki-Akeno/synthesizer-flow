import type { AgentBenchReport } from './types';

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatBenchReport(report: AgentBenchReport): string {
  const lines = [
    '',
    `Agent Golden Bench: ${report.passed ? 'PASS' : 'FAIL'}`,
    `Target: ${report.target}`,
    `Golden Set: ${report.goldenSet}`,
    `Cases: ${report.summary.passedCases}/${report.summary.totalCases} (${percent(report.summary.casePassRate)})`,
    `Average score: ${percent(report.summary.averageScore)}`,
    `Latency: avg ${report.summary.averageLatencyMs.toFixed(0)}ms / p95 ${report.summary.p95LatencyMs.toFixed(0)}ms`,
    '',
  ];

  report.cases.forEach((result) => {
    lines.push(
      `${result.passed ? 'PASS' : 'FAIL'} ${result.id} — score ${percent(result.averageScore)}, stability ${percent(result.samplePassRate)}`
    );
    result.samples.forEach((sample) => {
      if (sample.error) {
        lines.push(`  sample ${sample.sampleIndex + 1}: ERROR ${sample.error}`);
        return;
      }
      sample.criteria
        .filter((criterion) => !criterion.passed)
        .forEach((criterion) => {
          lines.push(`  sample ${sample.sampleIndex + 1}: ${criterion.id}`);
        });
    });
  });

  return lines.join('\n');
}
