'use server';

import { Agent } from './core/Agent';
import { ChatMessage, GraphStateSnapshot } from './core/types';
import { AISettings } from '@/store/settings-store';

export async function* chatWithAgent(
  messages: ChatMessage[],
  settings: AISettings,
  initialState: GraphStateSnapshot,
  useTools: boolean,
  threadId?: string,
  action?: 'approve' | 'reject'
) {
  const agent = Agent.getInstance();
  const generator = agent.streamMessage(messages, settings, initialState, useTools, threadId, action);

  for await (const part of generator) {
    // Ensure the return value is serializable
    yield JSON.parse(JSON.stringify(part));
  }
}
