'use server';

import { Agent } from './core/Agent';
import { ChatMessage, GraphStateSnapshot } from './core/types';
import { AISettings } from '@/store/settings';

export async function chatWithAgent(
  messages: ChatMessage[],
  settings: AISettings,
  initialState: GraphStateSnapshot,
  useTools: boolean,
  threadId?: string,
  action?: 'approve' | 'reject'
) {
  const agent = Agent.getInstance();
  // Ensure the return value is serializable
  const response = await agent.sendMessage(messages, settings, initialState, useTools, threadId, action);
  return JSON.parse(JSON.stringify(response));
}
