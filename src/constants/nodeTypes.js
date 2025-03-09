import {
  InputNode,
  OutputNode,
  DefaultNode,
} from '@/components/flow/nodes/basic/basic-nodes';
import { CustomNode } from '@/components/flow/nodes/basic/basic-nodes';
import Osc from '@/components/flow/nodes/osc';

export const nodeTypes = {
  input: InputNode,
  default: DefaultNode,
  output: OutputNode,
  custom: CustomNode,
  osc: Osc,
};
