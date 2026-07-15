import { moduleClassMap, moduleMetadataMap } from '@/core/modules';
import type { ModuleBase } from '@/core/base/ModuleBase';
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

function readModuleSkill(type: string, instance: ModuleBase): ModuleSkill {
  const summary = createModuleSkillSummary(type);
  const guide = getModuleGuide(type);
  const parameters = Object.entries(instance.parameters).map(
    ([key, subject]) => {
      const meta = instance.getParameterMeta(key);
      const uiOptions = meta.uiOptions ?? {};
      return {
        key,
        label: typeof uiOptions.label === 'string' ? uiOptions.label : key,
        description:
          typeof uiOptions.describe === 'string'
            ? uiOptions.describe
            : undefined,
        type: meta.type,
        defaultValue: subject.getValue(),
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
      inputs: Object.entries(instance.inputPortTypes).map(
        ([key, portType]) => ({
          key,
          type: portType,
        })
      ),
      outputs: Object.entries(instance.outputPortTypes).map(
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
  const ModuleClass = moduleClassMap[type];
  const metadata = moduleMetadataMap[type];
  if (!ModuleClass || !metadata) {
    return null;
  }

  const instance = new ModuleClass(`skill-preview-${type}`, metadata.label);
  try {
    return readModuleSkill(type, instance);
  } finally {
    instance.dispose();
  }
}
