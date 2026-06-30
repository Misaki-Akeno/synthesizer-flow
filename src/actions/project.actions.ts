'use server';

import { db } from '@/db/client';
import { projects, usersToProjects } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth/rbac';
import { withAuth } from '@/lib/auth/withAuth';
import { auth } from '@/lib/auth/auth';
import { validateSerializedCanvas } from '@/core/types/SerializationValidator';

const PROJECT_WRITE_ROLES = new Set(['owner', 'editor']);
const PROJECT_DELETE_ROLES = new Set(['owner']);

/**
 * 获取当前用户的项目列表（仅元数据，不含大字段 data）
 */
export const getUserProjects = withAuth(async (session) => {
  try {
    const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
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
});

/**
 * 获取单个项目的完整详情
 */
export const getProjectById = withAuth(async (session, projectId: string) => {
  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId) {
    return { success: false, error: 'Project not found' };
  }

  try {
    const link = await db
      .select()
      .from(usersToProjects)
      .where(
        and(
          eq(usersToProjects.userId, session.user.id),
          eq(usersToProjects.projectId, trimmedProjectId)
        )
      )
      .limit(1);

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        data: projects.data,
        isPreset: projects.isPreset,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.id, trimmedProjectId))
      .limit(1);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    if (link.length === 0 && !project.isPreset) {
      return { success: false, error: 'Project not found or access denied' };
    }

    return { success: true, data: project };
  } catch (error) {
    console.error('Failed to fetch project:', error);
    return { success: false, error: 'Failed to fetch project' };
  }
});

/**
 * 获取系统内置预设项目
 */
export async function getBuiltInPresets() {
  try {
    const presets = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
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
 */
export const saveProject = withAuth(
  async (
    session,
    name: string,
    data: unknown,
    projectId?: string,
    isPreset: boolean = false,
    description?: string
  ) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Project name is required' };
    }

    const trimmedProjectId = projectId?.trim();
    if (projectId !== undefined && !trimmedProjectId) {
      return { success: false, error: 'Invalid project id' };
    }

    // 如果尝试保存为系统预设，必须是管理员
    if (isPreset && !isAdmin(session)) {
      return { success: false, error: 'Forbidden: Admin only' };
    }

    const validationResult = validateSerializedCanvas(data);
    if (!validationResult.success) {
      return { success: false, error: 'Invalid project data' };
    }

    try {
      let finalProjectId = trimmedProjectId;
      let isUpdate = false;

      if (finalProjectId) {
        if (isPreset) {
          const existing = await db
            .select()
            .from(projects)
            .where(eq(projects.id, finalProjectId))
            .limit(1);
          if (existing.length > 0) {
            if (!existing[0].isPreset) {
              return {
                success: false,
                error: 'Project not found or access denied',
              };
            }
            isUpdate = true;
          }
        } else {
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

          if (link.length > 0 && PROJECT_WRITE_ROLES.has(link[0].role)) {
            isUpdate = true;
          } else {
            return {
              success: false,
              error: 'Project not found or access denied',
            };
          }
        }
      }

      if (isUpdate && finalProjectId) {
        await db
          .update(projects)
          .set({
            name: trimmedName,
            description,
            data,
            isPreset,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, finalProjectId));
      } else {
        finalProjectId = finalProjectId || nanoid(10);
        await db.insert(projects).values({
          id: finalProjectId,
          name: trimmedName,
          description,
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
);

/**
 * 删除项目
 */
export async function deleteProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId) {
    return { success: false, error: 'Project not found or access denied' };
  }

  try {
    const link = await db
      .select()
      .from(usersToProjects)
      .where(
        and(
          eq(usersToProjects.userId, session.user.id),
          eq(usersToProjects.projectId, trimmedProjectId)
        )
      )
      .limit(1);

    if (link.length > 0 && !PROJECT_DELETE_ROLES.has(link[0].role)) {
      return { success: false, error: 'Project not found or access denied' };
    }

    if (link.length === 0) {
      if (isAdmin(session)) {
        const project = await db
          .select()
          .from(projects)
          .where(eq(projects.id, trimmedProjectId))
          .limit(1);
        if (!(project.length > 0 && project[0].isPreset)) {
          return {
            success: false,
            error: 'Project not found or access denied',
          };
        }
      } else {
        return { success: false, error: 'Project not found or access denied' };
      }
    }

    // projects 表被 usersToProjects 引用，但 projects 删除时
    // usersToProjects 的外键设置了 onDelete: cascade，所以关联关系会自动删除
    await db.delete(projects).where(eq(projects.id, trimmedProjectId));

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete project:', error);
    return { success: false, error: 'Failed to delete project' };
  }
}
