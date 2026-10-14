import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import type { AgentExecutionContext } from '../core/types';

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  execution: Annotation<AgentExecutionContext | undefined>({
    reducer: (_current, next) => next,
    default: () => undefined,
  }),
});
