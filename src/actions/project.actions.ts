'use server';

import { auth } from '@/lib/auth/auth';
import { db } from '@/db/client';
import { projects, usersToProjects } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

/**
 * 获取当前用户的项目列表（仅元数据，不含大字段 data）
 */
export async function getUserProjects() {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const userProjects = await db
            .select({
                id: projects.id,
                name: projects.name,
                createdAt: projects.createdAt,
                updatedAt: projects.updatedAt,
            })
            .from(usersToProjects)
            .innerJoin(projects, eq(usersToProjects.projectId, projects.id))
            .where(eq(usersToProjects.userId, session.user.id))
            .orderBy(desc(projects.updatedAt));

        return { success: true, data: userProjects };
    } catch (error) {
        console.error('Failed to fetch user projects:', error);
        return { success: false, error: 'Failed to fetch projects' };
    }
}

/**
 * 获取单个项目的完整详情
 */
export async function getProjectById(projectId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        // 验证用户是否有权访问该项目
        const link = await db
            .select()
            .from(usersToProjects)
            .where(
                and(
                    eq(usersToProjects.userId, session.user.id),
                    eq(usersToProjects.projectId, projectId)
                )
            )
            .limit(1);

        if (link.length === 0) {
            return { success: false, error: 'Project not found or access denied' };
        }

        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

        if (project.length === 0) {
            return { success: false, error: 'Project not found' };
        }

        return { success: true, data: project[0] };
    } catch (error) {
        console.error('Failed to fetch project:', error);
        return { success: false, error: 'Failed to fetch project' };
    }
}

/**
 * 获取系统内置预设项目
 */
export async function getBuiltInPresets() {
    try {
        const presets = await db
            .select({
                id: projects.id,
                name: projects.name,
                // Description 不在 DB 中，暂时返回 null 或空
                // createdAt: projects.createdAt, 
                // updatedAt: projects.updatedAt,
                // 上面的一起取
                createdAt: projects.createdAt,
                updatedAt: projects.updatedAt,
                data: projects.data,
                isPreset: projects.isPreset,
            })
            .from(projects)
            .where(eq(projects.isPreset, true))
            .orderBy(desc(projects.updatedAt));

        return { success: true, data: presets };
    } catch (error) {
        console.error('Failed to fetch presets:', error);
        return { success: false, error: 'Failed to fetch presets' };
    }
}

/**
 * 保存项目（新建或更新）
 * @param name 项目名称
 * @param data 项目数据 (JSON Object)
 * @param projectId (可选) 项目ID，如果提供则更新，否则新建
 * @param isPreset (可选) 是否为系统预设
 */
export async function saveProject(
    name: string,
    data: unknown,
    projectId?: string,
    isPreset: boolean = false
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        let finalProjectId = projectId;
        let isUpdate = false;

        // 如果提供了 ID
        if (finalProjectId) {
            if (isPreset) {
                // 检查是否存在
                const existing = await db.select().from(projects).where(eq(projects.id, finalProjectId)).limit(1);
                if (existing.length > 0) isUpdate = true;
            } else {
                // 检查用户关联
                const link = await db
                    .select()
                    .from(usersToProjects)
                    .where(
                        and(
                            eq(usersToProjects.userId, session.user.id),
                            eq(usersToProjects.projectId, finalProjectId)
                        )
                    )
                    .limit(1);

                if (link.length > 0) {
                    isUpdate = true;
                } else {
                    isUpdate = false;
                    finalProjectId = undefined;
                }
            }
        }

        if (isUpdate && finalProjectId) {
            // Update
            await db
                .update(projects)
                .set({
                    name,
                    data,
                    isPreset,
                    updatedAt: new Date(),
                })
                .where(eq(projects.id, finalProjectId));
        } else {
            // Create
            finalProjectId = finalProjectId || nanoid(10);
            await db.insert(projects).values({
                id: finalProjectId,
                name,
                data,
                isPreset,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            if (!isPreset) {
                await db.insert(usersToProjects).values({
                    userId: session.user.id,
                    projectId: finalProjectId,
                    role: 'owner',
                });
            }
        }

        revalidatePath('/');
        return { success: true, projectId: finalProjectId };
    } catch (error) {
        console.error('Failed to save project:', error);
        return { success: false, error: 'Failed to save project' };
    }
}

/**
 * 删除项目
 */
export async function deleteProjectAction(projectId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        // Check permission
        const link = await db
            .select()
            .from(usersToProjects)
            .where(
                and(
                    eq(usersToProjects.userId, session.user.id),
                    eq(usersToProjects.projectId, projectId)
                )
            )
            .limit(1);

        if (link.length === 0) {
            return { success: false, error: 'Project not found or access denied' };
        }

        // projects 表被 usersToProjects 引用，但 projects 删除时
        // usersToProjects 的外键设置了 onDelete: cascade，所以关联关系会自动删除
        await db.delete(projects).where(eq(projects.id, projectId));

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete project:', error);
        return { success: false, error: 'Failed to delete project' };
    }
}
