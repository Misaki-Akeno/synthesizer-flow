import { ParameterValue } from './event';

/**
 * Parameter types supported by the synthesizer
 */
export enum ParameterType {
  Float = 'float',
  Enum = 'enum',
}

/**
 * Base interface for all parameter types
 */
export interface ParameterBase {
  id: string;
  name: string;
  type: ParameterType;
  unit?: string;
  description?: string;
  value: ParameterValue;
  defaultValue?: ParameterValue;
  modulationAmount?: number;
  modulationSource?: string | null;
}

/**
 * Float parameter type
 */
export interface FloatParameter extends ParameterBase {
  type: ParameterType.Float;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
}

/**
 * Enum parameter type
 */
export interface EnumParameter extends ParameterBase {
  type: ParameterType.Enum;
  value: string | number;
  defaultValue: string | number;
  options: Array<{
    label: string;
    value: string | number;
  }>;
}

/**
 * Union type of all parameter types
 */
export type Parameter = FloatParameter | EnumParameter;
