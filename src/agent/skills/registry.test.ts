import { describe, expect, it } from 'vitest';
import { moduleMetadataMap } from '@/core/modules';
import { MODULE_GUIDES } from './module-guides';
import { listAgentSkills, loadAgentSkill } from './registry';

describe('Agent Skills registry', () => {
  it('exposes one discoverable Skill for every registered module', () => {
    const skills = listAgentSkills();

    expect(skills).toHaveLength(15);
    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'module:advancedoscillator',
          kind: 'module',
        }),
        expect.objectContaining({ id: 'module:reverb' }),
        expect.objectContaining({ id: 'module:speaker' }),
      ])
    );
  });

  it('keeps curated guidance in sync with the registered module catalog', () => {
    expect(Object.keys(MODULE_GUIDES).sort()).toEqual(
      Object.keys(moduleMetadataMap).sort()
    );
  });

  it('supports lightweight discovery by description, tag, and category', () => {
    expect(listAgentSkills({ query: '空间' }).map((skill) => skill.id)).toEqual(
      ['module:reverb']
    );
    expect(listAgentSkills({ query: 'mpe' }).map((skill) => skill.id)).toEqual(
      expect.arrayContaining(['module:advancedoscillator', 'module:midiinput'])
    );
    expect(
      listAgentSkills({ category: '输出' }).map((skill) => skill.id)
    ).toEqual(['module:speaker']);
  });

  it('loads a guide backed by the real module parameter and port schema', () => {
    const skill = loadAgentSkill('module:numberinput');

    expect(skill).toMatchObject({
      id: 'module:numberinput',
      moduleType: 'numberinput',
      guidance: {
        useWhen: expect.any(Array),
        setup: expect.any(Array),
        cautions: expect.any(Array),
      },
      parameters: [
        {
          key: 'value',
          label: '数值',
          type: 'number',
          defaultValue: 120,
          min: 0,
          max: 999,
          step: 1,
        },
      ],
      ports: {
        inputs: [],
        outputs: [{ key: 'output', type: 'number' }],
      },
    });
  });

  it('rejects unknown or unsupported Skill ids', () => {
    expect(loadAgentSkill('module:not-real')).toBeNull();
    expect(loadAgentSkill('workflow:not-real')).toBeNull();
  });
});
