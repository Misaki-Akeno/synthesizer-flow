'use server';

import { db } from '@/db/client';
import { checkpoints, NewCheckpoint } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { ChatMessage, GraphStateSnapshot } from './core/types';
import { nanoid } from 'nanoid';

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { AISettings } from '@/store/settings';

async function generateTitle(messages: ChatMessage[], settings?: AISettings): Promise<string> {
    if (!settings || !settings.apiKey || messages.length === 0) {
        return "Saved Chat";
    }

    try {
        const model = new ChatOpenAI({
            apiKey: settings.apiKey,
            configuration: { baseURL: settings.apiEndpoint },
            modelName: settings.modelName,
            temperature: 0,
        });

        const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n').slice(-2000); // Limit context
        const response = await model.invoke([
            new HumanMessage(`Summarize the following conversation into a short title (max 10 chars, no quotes). If it's empty, return "New Chat".\n\n${conversation}`)
        ]);

        const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        let generatedTitle = content.trim();
        // Remove quotes if present
        generatedTitle = generatedTitle.replace(/^"|"$/g, '');

        if (!generatedTitle) {
            return "New Chat";
        }
        return generatedTitle;
    } catch (e) {
        console.error('Title generation failed:', e);
        // Fallback to "New Chat" instead of long date string if generation fails
        return "New Chat";
    }
}

export async function saveCheckpoint(
    userId: string,
    title: string,
    messages: ChatMessage[],
    graphState: GraphStateSnapshot,
    aiSettings?: AISettings
) {
    try {
        let finalTitle = title;
        if (!finalTitle) {
            finalTitle = await generateTitle(messages, aiSettings);
        }

        const newCheckpoint: NewCheckpoint = {
            id: nanoid(),
            userId,
            title: finalTitle,
            messages: JSON.parse(JSON.stringify(messages)), // Ensure serializable
            graphState: JSON.parse(JSON.stringify(graphState)), // Ensure serializable
        };

        await db.insert(checkpoints).values(newCheckpoint);
        revalidatePath('/'); // Revalidate to refresh lists if needed
        return { success: true, id: newCheckpoint.id };
    } catch (error) {
        console.error('Failed to save checkpoint:', error);
        return { success: false, error: 'Failed to save checkpoint' };
    }
}

export async function getCheckpoints(userId: string) {
    try {
        const results = await db
            .select()
            .from(checkpoints)
            .where(eq(checkpoints.userId, userId))
            .orderBy(desc(checkpoints.createdAt));
        return { success: true, data: results };
    } catch (error) {
        console.error('Failed to get checkpoints:', error);
        return { success: false, error: 'Failed to get checkpoints' };
    }
}

export async function deleteCheckpoint(id: string, userId: string) {
    try {
        await db
            .delete(checkpoints)
            .where(eq(checkpoints.id, id) && eq(checkpoints.userId, userId)); // Ensure ownership
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete checkpoint:', error);
        return { success: false, error: 'Failed to delete checkpoint' };
    }
}

export async function updateCheckpointTitle(id: string, userId: string, title: string) {
    try {
        await db
            .update(checkpoints)
            .set({ title })
            .where(eq(checkpoints.id, id) && eq(checkpoints.userId, userId));
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to update checkpoint title:', error);
        return { success: false, error: 'Failed to update checkpoint title' };
    }
}
