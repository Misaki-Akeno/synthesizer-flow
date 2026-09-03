'use server';

import { db } from '@/db/client';
import { projects, usersToProjects } from '@/db/schema';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth/rbac';
import { withAuth } from '@/lib/auth/withAuth';
import { auth } from '@/lib/auth/auth';
import { validateSerializedCanvas } from '@/core/types/SerializationValidator';
import {
  BUILT_IN_PRESETS,
  getBuiltInPresetById,
} from '@/data/built-in-presets.mjs';

const PROJECT_WRITE_ROLES = new Set(['owner', 'editor']);
const PROJECT_DELETE_ROLES = new Set(['owner']);
const MAX_PROJECT_NAME_LENGTH = 120;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2_000;
const MAX_PROJECT_DATA_BYTES = 5_000_000;
const MAX_PROJECT_METADATA_BYTES = 100_000;
const PROJECT_SCHEMA_VERSION = 1;
const PROJECT_DATABASE_MIGRATION_REQUIRED =
  'PROJECT_DATABASE_MIGRATION_REQUIRED';
const BUNDLED_PRESET_DATE = new Date(Date.UTC(2026, 6, 15));

interface SaveProjectOptions {
  projectId?: string;
  isPreset?: boolean;
  description?: string;
  expectedRevision?: number;
  metadata?: Record<string, unknown>;
}

interface PresetListItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  isPreset: boolean;
  metadata: unknown;
  schemaVersion: number;
  revision: number;
}

type BuiltInPresetsResult =
  | { success: true; data: PresetListItem[]; warning?: string }
  | { success: false; error: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toBundledPresetProject(
  preset: (typeof BUILT_IN_PRESETS)[number],
  includeData = false
) {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    ...(includeData ? { data: preset.data } : {}),
    isPreset: true,
    metadata: preset.metadata,
    schemaVersion: 1,
    revision: 1,
    createdAt: BUNDLED_PRESET_DATE,
    updatedAt: BUNDLED_PRESET_DATE,
  };
}

/**
 * Drizzle 会把 PostgreSQL 错误包在 cause 链中。缺少表或字段通常意味着
 * 应用代码已经更新，但目标数据库尚未执行配套迁移。
 */
function getProjectDatabaseError(error: unknown, fallback: string): string {
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== 'object') {
      break;
    }

    const databaseError = current as { code?: unknown; cause?: unknown };
    if (databaseError.code === '42703' || databaseError.code === '42P01') {
      return PROJECT_DATABASE_MIGRATION_REQUIRED;
    }

    current = databaseError.cause;
  }

  return fallback;
}

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
        metadata: projects.metadata,
        schemaVersion: projects.schemaVersion,
        revision: projects.revision,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(usersToProjects)
      .innerJoin(projects, eq(usersToProjects.projectId, projects.id))
      .where(
        and(
          eq(usersToProjects.userId, session.user.id),
          isNull(projects.archivedAt)
        )
      )
      .orderBy(desc(projects.updatedAt));

    return { success: true, data: userProjects };
  } catch (error) {
    console.error('Failed to fetch user projects:', error);
    return {
      success: false,
      error: getProjectDatabaseError(error, 'Failed to fetch projects'),
    };
  }
});

/**
 * 获取单个项目的完整详情
 */
export async function getProjectById(projectId: string) {
  if (typeof projectId !== 'string') {
    return { success: false, error: 'Project not found' };
  }
  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId) {
    return { success: false, error: 'Project not found' };
  }

  const bundledPreset = getBuiltInPresetById(trimmedProjectId);
  if (bundledPreset) {
    return {
      success: true,
      data: toBundledPresetProject(bundledPreset, true),
    };
  }

  try {
    const session = await auth();
    const link = session?.user?.id
      ? await db
          .select()
          .from(usersToProjects)
          .where(
            and(
              eq(usersToProjects.userId, session.user.id),
              eq(usersToProjects.projectId, trimmedProjectId)
            )
          )
          .limit(1)
      : [];

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        data: projects.data,
        isPreset: projects.isPreset,
        metadata: projects.metadata,
        schemaVersion: projects.schemaVersion,
        revision: projects.revision,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(
        and(eq(projects.id, trimmedProjectId), isNull(projects.archivedAt))
      )
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
    return {
      success: false,
      error: getProjectDatabaseError(error, 'Failed to fetch project'),
    };
  }
}

/**
 * 获取系统内置预设项目
 */
export async function getBuiltInPresets(): Promise<BuiltInPresetsResult> {
  try {
    const presets = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        isPreset: projects.isPreset,
        metadata: projects.metadata,
        schemaVersion: projects.schemaVersion,
        revision: projects.revision,
      })
      .from(projects)
      .where(and(eq(projects.isPreset, true), isNull(projects.archivedAt)))
      .orderBy(desc(projects.updatedAt));

    const remoteIds = new Set(presets.map((preset) => preset.id));
    const bundledFallbacks = BUILT_IN_PRESETS.filter(
      (preset) => !remoteIds.has(preset.id)
    ).map((preset) => toBundledPresetProject(preset));
    return { success: true, data: [...presets, ...bundledFallbacks] };
  } catch (error) {
    console.error('Failed to fetch presets:', error);
    const bundledFallbacks = BUILT_IN_PRESETS.map((preset) =>
      toBundledPresetProject(preset)
    );
    return {
      success: true,
      data: bundledFallbacks,
      warning: getProjectDatabaseError(error, 'Failed to fetch presets'),
    };
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
    options: SaveProjectOptions = {}
  ) => {
    const safeOptions = isPlainRecord(options)
      ? (options as SaveProjectOptions)
      : {};
    const {
      projectId,
      isPreset = false,
      description,
      expectedRevision,
      metadata = {},
    } = safeOptions;
    if (typeof name !== 'string') {
      return { success: false, error: 'Project name is required' };
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Project name is required' };
    }
    if (trimmedName.length > MAX_PROJECT_NAME_LENGTH) {
      return { success: false, error: 'Project name is too long' };
    }
    if (
      description !== undefined &&
      (typeof description !== 'string' ||
        description.length > MAX_PROJECT_DESCRIPTION_LENGTH)
    ) {
      return { success: false, error: 'Invalid project description' };
    }

    let serializedData: string;
    try {
      serializedData = JSON.stringify(data);
    } catch {
      return { success: false, error: 'Invalid project data' };
    }
    if (Buffer.byteLength(serializedData, 'utf8') > MAX_PROJECT_DATA_BYTES) {
      return { success: false, error: 'Project data is too large' };
    }

    if (projectId !== undefined && typeof projectId !== 'string') {
      return { success: false, error: 'Invalid project id' };
    }
    const trimmedProjectId = projectId?.trim();
    if (projectId !== undefined && !trimmedProjectId) {
      return { success: false, error: 'Invalid project id' };
    }
    if (trimmedProjectId && trimmedProjectId.length > 255) {
      return { success: false, error: 'Invalid project id' };
    }
    if (typeof isPreset !== 'boolean') {
      return { success: false, error: 'Invalid preset flag' };
    }
    if (
      expectedRevision !== undefined &&
      (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    ) {
      return { success: false, error: 'Invalid project revision' };
    }
    if (!isPlainRecord(metadata)) {
      return { success: false, error: 'Invalid project metadata' };
    }
    let serializedMetadata: string;
    try {
      serializedMetadata = JSON.stringify(metadata);
    } catch {
      return { success: false, error: 'Invalid project metadata' };
    }
    if (
      Buffer.byteLength(serializedMetadata, 'utf8') > MAX_PROJECT_METADATA_BYTES
    ) {
      return { success: false, error: 'Project metadata is too large' };
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
            .where(
              and(eq(projects.id, finalProjectId), isNull(projects.archivedAt))
            )
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
        const updateConditions = [
          eq(projects.id, finalProjectId),
          isNull(projects.archivedAt),
        ];
        if (expectedRevision !== undefined) {
          updateConditions.push(eq(projects.revision, expectedRevision));
        }

        const [updatedProject] = await db
          .update(projects)
          .set({
            name: trimmedName,
            description,
            data,
            metadata,
            schemaVersion: PROJECT_SCHEMA_VERSION,
            revision: sql`${projects.revision} + 1`,
            isPreset,
            updatedAt: new Date(),
          })
          .where(and(...updateConditions))
          .returning({ revision: projects.revision });

        if (!updatedProject) {
          return {
            success: false,
            error:
              expectedRevision === undefined
                ? 'Project not found or access denied'
                : 'Project was modified elsewhere. Reload and try again.',
          };
        }

        revalidatePath('/');
        return {
          success: true,
          projectId: finalProjectId,
          revision: updatedProject.revision,
        };
      } else {
        const newProjectId = finalProjectId || nanoid(10);
        finalProjectId = newProjectId;
        const now = new Date();
        await db.transaction(async (tx) => {
          await tx.insert(projects).values({
            id: newProjectId,
            name: trimmedName,
            description,
            data,
            metadata,
            schemaVersion: PROJECT_SCHEMA_VERSION,
            revision: 1,
            isPreset,
            createdAt: now,
            updatedAt: now,
          });

          if (!isPreset) {
            await tx.insert(usersToProjects).values({
              userId: session.user.id,
              projectId: newProjectId,
              role: 'owner',
              createdAt: now,
              updatedAt: now,
            });
          }
        });
      }

      revalidatePath('/');
      return { success: true, projectId: finalProjectId, revision: 1 };
    } catch (error) {
      console.error('Failed to save project:', error);
      return {
        success: false,
        error: getProjectDatabaseError(error, 'Failed to save project'),
      };
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

  if (typeof projectId !== 'string') {
    return { success: false, error: 'Project not found or access denied' };
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

    // 默认采用软归档，避免未来加入回收站或审计能力时再次改变数据模型。
    await db
      .update(projects)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
        revision: sql`${projects.revision} + 1`,
      })
      .where(
        and(eq(projects.id, trimmedProjectId), isNull(projects.archivedAt))
      );

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete project:', error);
    return {
      success: false,
      error: getProjectDatabaseError(error, 'Failed to delete project'),
    };
  }
}
