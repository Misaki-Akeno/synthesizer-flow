import type { ParameterType, PortType } from '@/core/base/ModuleBase';

export type AgentSkillKind = 'module' | 'workflow';

export interface AgentSkillSummary {
  id: string;
  kind: AgentSkillKind;
  title: string;
  description: string;
  category: string;
  tags: string[];
}

export interface ModuleSkillParameter {
  key: string;
  label: string;
  description?: string;
  type: ParameterType;
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group?: string;
}

export interface ModuleSkillPort {
  key: string;
  type: PortType;
}

export interface ModuleSkill extends AgentSkillSummary {
  kind: 'module';
  moduleType: string;
  guidance: {
    useWhen: string[];
    setup: string[];
    cautions: string[];
  };
  parameters: ModuleSkillParameter[];
  ports: {
    inputs: ModuleSkillPort[];
    outputs: ModuleSkillPort[];
  };
}

export type AgentSkill = ModuleSkill;

export interface AgentSkillListOptions {
  query?: string;
  category?: string;
}
