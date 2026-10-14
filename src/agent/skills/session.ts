import { listAgentSkills, loadAgentSkill } from './registry';
import type {
  AgentSkill,
  AgentSkillListOptions,
  AgentSkillSummary,
} from './types';

/**
 * 单次 Agent 请求中的 Skill 工作集。
 * 记录已加载指南，让后续工具可以验证 Agent 是否完成了必要的按需学习。
 */
export class AgentSkillSession {
  private readonly loadedSkills = new Map<string, AgentSkill>();

  public list(options: AgentSkillListOptions = {}): AgentSkillSummary[] {
    return listAgentSkills(options);
  }

  public load(skillId: string): AgentSkill | null {
    const skill = loadAgentSkill(skillId);
    if (skill) {
      this.loadedSkills.set(skill.id, skill);
    }
    return skill;
  }

  public has(skillId: string): boolean {
    return this.loadedSkills.has(skillId.trim().toLowerCase());
  }

  public hasModuleGuide(moduleType: string): boolean {
    return this.has(`module:${moduleType.trim().toLowerCase()}`);
  }

  public getLoadedSkillIds(): string[] {
    return Array.from(this.loadedSkills.keys());
  }

  /** 从 checkpoint 恢复已加载的 Skill；未知或已删除的 Skill 会被忽略。 */
  public restore(skillIds: readonly string[] | undefined): void {
    skillIds?.forEach((skillId) => this.load(skillId));
  }
}
