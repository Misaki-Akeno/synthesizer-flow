import type {
  AgentEvalActual,
  AgentEvalCriterionResult,
  GoldenCase,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPartialMatch(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((value, index) => isPartialMatch(actual[index], value))
    );
  }

  if (isRecord(expected)) {
    return (
      isRecord(actual) &&
      Object.entries(expected).every(([key, value]) =>
        isPartialMatch(actual[key], value)
      )
    );
  }

  return Object.is(actual, expected);
}

function isOrderedSubsequence(actual: string[], expected: string[]): boolean {
  let expectedIndex = 0;
  for (const name of actual) {
    if (name === expected[expectedIndex]) {
      expectedIndex += 1;
    }
  }
  return expectedIndex === expected.length;
}

function addCriterion(
  results: AgentEvalCriterionResult[],
  id: string,
  passed: boolean,
  expected: unknown,
  actual: unknown
): void {
  results.push({ id, passed, expected, actual });
}

export function scoreGoldenCase(
  goldenCase: GoldenCase,
  actual: AgentEvalActual
): { score: number; criteria: AgentEvalCriterionResult[] } {
  const criteria: AgentEvalCriterionResult[] = [];
  const expected = goldenCase.expected;

  if (expected.tools) {
    const actualNames = actual.toolCalls.map((toolCall) => toolCall.name);
    const expectedNames = expected.tools.names;
    const namesPassed =
      expected.tools.mode === 'exact'
        ? isPartialMatch(actualNames, expectedNames)
        : expected.tools.mode === 'ordered'
          ? isOrderedSubsequence(actualNames, expectedNames)
          : expectedNames.every((name) => actualNames.includes(name));
    addCriterion(
      criteria,
      'tools.names',
      namesPassed,
      { mode: expected.tools.mode, names: expectedNames },
      actualNames
    );

    expected.tools.arguments?.forEach((argumentExpectation, index) => {
      const candidates = actual.toolCalls.filter(
        (toolCall) => toolCall.name === argumentExpectation.name
      );
      addCriterion(
        criteria,
        `tools.arguments.${index}`,
        candidates.some((candidate) =>
          isPartialMatch(candidate.arguments, argumentExpectation.includes)
        ),
        argumentExpectation,
        candidates.map((candidate) => candidate.arguments)
      );
    });
  }

  if (expected.operations) {
    const operationPassed =
      expected.operations.mode === 'exact'
        ? expected.operations.items.length === actual.operations.length &&
          expected.operations.items.every((item, index) =>
            isPartialMatch(actual.operations[index], item)
          )
        : expected.operations.items.every((item) =>
            actual.operations.some((operation) =>
              isPartialMatch(operation, item)
            )
          );
    addCriterion(
      criteria,
      'operations',
      operationPassed,
      expected.operations,
      actual.operations
    );
  }

  if (expected.approvalRequired !== undefined) {
    addCriterion(
      criteria,
      'approvalRequired',
      actual.approvalRequired === expected.approvalRequired,
      expected.approvalRequired,
      actual.approvalRequired
    );
  }

  if (expected.response?.containsAll) {
    const normalized = actual.response.toLocaleLowerCase('zh-CN');
    const expectedTerms = expected.response.containsAll;
    addCriterion(
      criteria,
      'response.containsAll',
      expectedTerms.every((term) =>
        normalized.includes(term.toLocaleLowerCase('zh-CN'))
      ),
      expectedTerms,
      actual.response
    );
  }

  if (expected.response?.excludes) {
    const normalized = actual.response.toLocaleLowerCase('zh-CN');
    const excludedTerms = expected.response.excludes;
    addCriterion(
      criteria,
      'response.excludes',
      excludedTerms.every(
        (term) => !normalized.includes(term.toLocaleLowerCase('zh-CN'))
      ),
      excludedTerms,
      actual.response
    );
  }

  if (expected.response?.minLength !== undefined) {
    addCriterion(
      criteria,
      'response.minLength',
      actual.response.length >= expected.response.minLength,
      expected.response.minLength,
      actual.response.length
    );
  }

  return {
    score:
      criteria.length === 0
        ? 0
        : criteria.filter((criterion) => criterion.passed).length /
          criteria.length,
    criteria,
  };
}
