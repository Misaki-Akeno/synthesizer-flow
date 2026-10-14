import { moduleMetadataMap } from '@/core/modules';
import {
  moduleDefinitionRegistry,
  type ModuleDefinition,
} from '@/core/graph/ModuleDefinitionRegistry';
import { getModuleGuide } from './module-guides';
import type {
  AgentSkill,
  AgentSkillListOptions,
  AgentSkillSummary,
  ModuleSkill,
} from './types';

const MODULE_SKILL_PREFIX = 'module:';

function createModuleSkillSummary(type: string): AgentSkillSummary {
  const metadata = moduleMetadataMap[type];
  const guide = getModuleGuide(type);
  return {
    id: `${MODULE_SKILL_PREFIX}${type}`,
    kind: 'module',
    title: metadata.label,
    description: metadata.description,
    category: metadata.category,
    tags: Array.from(new Set([type, metadata.category, ...guide.tags])),
  };
}

function matchesSearch(
  skill: AgentSkillSummary,
  options: AgentSkillListOptions
): boolean {
  const category = options.category?.trim().toLowerCase();
  if (category && skill.category.toLowerCase() !== category) {
    return false;
  }

  const query = options.query?.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [
    skill.id,
    skill.title,
    skill.description,
    skill.category,
    ...skill.tags,
  ].some((value) => value.toLowerCase().includes(query));
}

export function listAgentSkills(
  options: AgentSkillListOptions = {}
): AgentSkillSummary[] {
  return Object.keys(moduleMetadataMap)
    .map(createModuleSkillSummary)
    .filter((skill) => matchesSearch(skill, options))
    .sort((a, b) =>
      `${a.category}:${a.title}`.localeCompare(
        `${b.category}:${b.title}`,
        'zh-CN'
      )
    );
}

function readModuleSkill(
  type: string,
  definition: ModuleDefinition
): ModuleSkill {
  const summary = createModuleSkillSummary(type);
  const guide = getModuleGuide(type);
  const parameters = Object.entries(definition.defaultParameters).map(
    ([key, defaultValue]) => {
      const meta = definition.parameterMeta[key];
      const uiOptions = meta.uiOptions ?? {};
      return {
        key,
        label: typeof uiOptions.label === 'string' ? uiOptions.label : key,
        description:
          typeof uiOptions.describe === 'string'
            ? uiOptions.describe
            : undefined,
        type: meta.type,
        defaultValue,
        min: meta.min,
        max: meta.max,
        step: meta.step,
        options: meta.options,
        group:
          typeof uiOptions.group === 'string' ? uiOptions.group : undefined,
      };
    }
  );

  return {
    ...summary,
    kind: 'module',
    moduleType: type,
    guidance: {
      useWhen: guide.useWhen,
      setup: guide.setup,
      cautions: guide.cautions,
    },
    parameters,
    ports: {
      inputs: Object.entries(definition.inputPortTypes).map(
        ([key, portType]) => ({
          key,
          type: portType,
        })
      ),
      outputs: Object.entries(definition.outputPortTypes).map(
        ([key, portType]) => ({ key, type: portType })
      ),
    },
  };
}

export function loadAgentSkill(skillId: string): AgentSkill | null {
  const normalizedId = skillId.trim().toLowerCase();
  if (!normalizedId.startsWith(MODULE_SKILL_PREFIX)) {
    return null;
  }

  const type = normalizedId.slice(MODULE_SKILL_PREFIX.length);
  const metadata = moduleMetadataMap[type];
  const definition = moduleDefinitionRegistry.resolve(type);
  if (!definition || !metadata) {
    return null;
  }
  return readModuleSkill(type, definition);
}
