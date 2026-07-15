import nextEnv from '@next/env';
import { Client } from 'pg';

const { loadEnvConfig } = nextEnv;

const SEED_TIMESTAMP = Date.UTC(2026, 6, 15, 0, 0, 0);
const SEED_NAME = 'official-examples';
const SEED_VERSION = 1;

const exampleProjects = [
  {
    id: 'preset-signal-math-lab-v1',
    name: '信号数学实验室',
    description: '用两个数字输入、计算器和示波器理解 NUMBER 信号的连接与运算。',
    metadata: {
      seed: SEED_NAME,
      seedVersion: SEED_VERSION,
      difficulty: 'beginner',
      tags: ['logic', 'number', 'tutorial'],
    },
    data: {
      version: '1.0',
      timestamp: SEED_TIMESTAMP,
      nodes: [
        {
          id: 'math-input-a',
          position: { x: 80, y: 100 },
          data: {
            type: 'numberinput',
            label: '输入 A',
            parameters: { value: 120 },
          },
        },
        {
          id: 'math-input-b',
          position: { x: 80, y: 330 },
          data: {
            type: 'numberinput',
            label: '输入 B',
            parameters: { value: 24 },
          },
        },
        {
          id: 'math-calculator',
          position: { x: 390, y: 200 },
          data: {
            type: 'calculator',
            label: '加法器',
            parameters: { operation: '+', status: 'Ready' },
          },
        },
        {
          id: 'math-scope',
          position: { x: 700, y: 200 },
          data: {
            type: 'oscilloscope',
            label: '结果示波器',
            parameters: {},
          },
        },
      ],
      edges: [
        {
          source: 'math-input-a',
          target: 'math-calculator',
          sourceHandle: 'output',
          targetHandle: 'a',
        },
        {
          source: 'math-input-b',
          target: 'math-calculator',
          sourceHandle: 'output',
          targetHandle: 'b',
        },
        {
          source: 'math-calculator',
          target: 'math-scope',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ],
      metadata: { example: true, seed: SEED_NAME },
    },
  },
  {
    id: 'preset-space-oscillator-v1',
    name: '空间振荡器',
    description: '从振荡器出发，依次经过延迟和混响后连接到立体声输出。',
    metadata: {
      seed: SEED_NAME,
      seedVersion: SEED_VERSION,
      difficulty: 'beginner',
      tags: ['audio', 'effects', 'tutorial'],
    },
    data: {
      version: '1.0',
      timestamp: SEED_TIMESTAMP,
      nodes: [
        {
          id: 'space-oscillator',
          position: { x: 70, y: 170 },
          data: {
            type: 'simpleoscillator',
            label: '温暖振荡器',
            parameters: {
              gain: 0.35,
              freq: 220,
              waveform: 'triangle',
              freqModDepth: 2,
              gainModDepth: 0.5,
            },
          },
        },
        {
          id: 'space-delay',
          position: { x: 390, y: 120 },
          data: {
            type: 'delay',
            label: '短回声',
            parameters: { delayTime: 0.28, feedback: 0.36, wet: 0.35 },
          },
        },
        {
          id: 'space-reverb',
          position: { x: 700, y: 120 },
          data: {
            type: 'reverb',
            label: '空间混响',
            parameters: { decay: 3.2, wet: 0.42, preDelay: 0.04 },
          },
        },
        {
          id: 'space-speaker',
          position: { x: 1010, y: 170 },
          data: {
            type: 'speaker',
            label: '立体声输出',
            parameters: { level: -18, balance: 0 },
          },
        },
      ],
      edges: [
        {
          source: 'space-oscillator',
          target: 'space-delay',
          sourceHandle: 'audioout',
          targetHandle: 'input',
        },
        {
          source: 'space-delay',
          target: 'space-reverb',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
        {
          source: 'space-reverb',
          target: 'space-speaker',
          sourceHandle: 'output',
          targetHandle: 'audioInLeft',
        },
        {
          source: 'space-reverb',
          target: 'space-speaker',
          sourceHandle: 'output',
          targetHandle: 'audioInRight',
        },
      ],
      metadata: { example: true, seed: SEED_NAME },
    },
  },
];

function validateExamples(projectsToValidate) {
  const ids = new Set();

  for (const project of projectsToValidate) {
    if (!project.id || ids.has(project.id)) {
      throw new Error(`示例工程 ID 无效或重复：${project.id}`);
    }
    ids.add(project.id);

    if (
      !project.name ||
      !project.description ||
      project.metadata.seed !== SEED_NAME
    ) {
      throw new Error(`示例工程元数据不完整：${project.id}`);
    }

    const { data } = project;
    if (data.version !== '1.0' || !Number.isSafeInteger(data.timestamp)) {
      throw new Error(`示例工程画布版本无效：${project.id}`);
    }

    const nodeIds = new Set(data.nodes.map((node) => node.id));
    if (nodeIds.size !== data.nodes.length) {
      throw new Error(`示例工程包含重复节点：${project.id}`);
    }

    for (const edge of data.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new Error(`示例工程连接端点不存在：${project.id}`);
      }
      if (!edge.sourceHandle || !edge.targetHandle) {
        throw new Error(`示例工程连接缺少端口：${project.id}`);
      }
    }
  }
}

function formatTarget(connectionString) {
  const url = new URL(connectionString);
  return `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
}

async function assertCompatibleProjectSchema(client) {
  const result = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'projects'
        and column_name = any($1::text[])
    `,
    [['archived_at', 'description', 'metadata', 'revision', 'schema_version']]
  );
  const existingColumns = new Set(result.rows.map((row) => row.column_name));
  const missingColumns = [
    'archived_at',
    'description',
    'metadata',
    'revision',
    'schema_version',
  ].filter((column) => !existingColumns.has(column));

  if (missingColumns.length > 0) {
    throw new Error(
      `数据库尚未完成项目结构迁移，缺少字段：${missingColumns.join(', ')}。请先运行 npm run drizzle:migrate`
    );
  }
}

async function getExistingProjects(client) {
  const result = await client.query(
    'select id, name, metadata, is_preset, archived_at from projects where id = any($1::text[]) order by id',
    [exampleProjects.map((project) => project.id)]
  );
  return new Map(result.rows.map((row) => [row.id, row]));
}

async function upsertExamples(client) {
  let changed = 0;

  await client.query('begin');
  try {
    for (const project of exampleProjects) {
      const result = await client.query(
        `
          insert into projects (
            id, name, description, data, metadata, schema_version, revision,
            is_preset, archived_at, created_at, updated_at
          ) values ($1, $2, $3, $4::jsonb, $5::jsonb, 1, 1, true, null, now(), now())
          on conflict (id) do update set
            name = excluded.name,
            description = excluded.description,
            data = excluded.data,
            metadata = excluded.metadata,
            schema_version = excluded.schema_version,
            revision = projects.revision + 1,
            is_preset = true,
            archived_at = null,
            updated_at = now()
          where
            projects.name is distinct from excluded.name or
            projects.description is distinct from excluded.description or
            projects.data is distinct from excluded.data or
            projects.metadata is distinct from excluded.metadata or
            projects.schema_version is distinct from excluded.schema_version or
            projects.is_preset is distinct from true or
            projects.archived_at is not null
          returning id
        `,
        [
          project.id,
          project.name,
          project.description,
          JSON.stringify(project.data),
          JSON.stringify(project.metadata),
        ]
      );
      changed += result.rowCount ?? 0;
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }

  return changed;
}

async function main() {
  validateExamples(exampleProjects);

  const args = new Set(process.argv.slice(2));
  const validateOnly = args.has('--validate');
  const apply = args.has('--apply');
  const unknownArgs = [...args].filter(
    (arg) => arg !== '--validate' && arg !== '--apply'
  );

  if (unknownArgs.length > 0 || (validateOnly && apply)) {
    throw new Error(
      '用法：node scripts/seed-example-projects.mjs [--validate | --apply]'
    );
  }

  if (validateOnly) {
    console.log(`示例工程定义有效：${exampleProjects.length} 个`);
    return;
  }

  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 未配置');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await assertCompatibleProjectSchema(client);
    const existing = await getExistingProjects(client);

    console.log(`目标数据库：${formatTarget(process.env.DATABASE_URL)}`);
    for (const project of exampleProjects) {
      const current = existing.get(project.id);
      console.log(
        `${current ? '更新' : '新增'}：${project.name} (${project.id})`
      );
    }

    if (!apply) {
      console.log('当前为预览模式；确认目标环境后追加 --apply 才会写入。');
      return;
    }

    const changed = await upsertExamples(client);
    console.log(`示例工程同步完成：${changed} 个项目发生变化。`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    `示例工程同步失败：${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
