import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const REQUIRED_PROJECT_COLUMNS = [
  'archived_at',
  'description',
  'metadata',
  'revision',
  'schema_version',
];

async function readExpectedMigrationTimestamp() {
  const journalUrl = new URL(
    '../src/db/migrations/meta/_journal.json',
    import.meta.url
  );
  const journal = JSON.parse(await readFile(journalUrl, 'utf8'));
  const latestEntry = journal.entries?.at(-1);

  if (!latestEntry || !Number.isSafeInteger(latestEntry.when)) {
    throw new Error('无法读取本地 Drizzle 迁移版本');
  }

  return {
    tag: latestEntry.tag,
    timestamp: BigInt(latestEntry.when),
  };
}

async function inspectDatabase(client) {
  // 单个 pg Client 严格顺序查询，避免 pg 9 将并发 query 视为错误。
  const serverResult = await client.query(
    "select current_database() as database, current_setting('server_version') as server_version"
  );
  const migrationTableResult = await client.query(
    "select to_regclass('drizzle.__drizzle_migrations')::text as name"
  );
  const columnsResult = await client.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'projects'"
  );
  const extensionResult = await client.query(
    "select extversion from pg_extension where extname = 'vector' limit 1"
  );
  const statsResult = await client.query(`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from projects) as projects,
      (select count(*)::int from projects where is_preset) as presets,
      (select count(*)::int from projects where archived_at is not null) as archived_projects,
      (select count(*)::int from rag_documents) as rag_documents,
      (select count(*)::int from checkpoints) as checkpoints
  `);

  const migrationTable = migrationTableResult.rows[0]?.name;
  const migrationResult = migrationTable
    ? await client.query(
        'select count(*)::int as count, max(created_at)::text as latest_created_at from drizzle.__drizzle_migrations'
      )
    : { rows: [{ count: 0, latest_created_at: null }] };

  return {
    server: serverResult.rows[0],
    migrationTable,
    migrationCount: migrationResult.rows[0]?.count ?? 0,
    latestMigrationTimestamp:
      migrationResult.rows[0]?.latest_created_at ?? null,
    projectColumns: new Set(columnsResult.rows.map((row) => row.column_name)),
    vectorVersion: extensionResult.rows[0]?.extversion ?? null,
    stats: statsResult.rows[0],
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 未配置');
  }

  const expectedMigration = await readExpectedMigrationTimestamp();
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    const database = await inspectDatabase(client);
    const missingColumns = REQUIRED_PROJECT_COLUMNS.filter(
      (column) => !database.projectColumns.has(column)
    );
    const appliedTimestamp = database.latestMigrationTimestamp
      ? BigInt(database.latestMigrationTimestamp)
      : 0n;
    const migrationBehind = appliedTimestamp < expectedMigration.timestamp;

    console.log(
      `数据库连接正常：${database.server.database} / PostgreSQL ${database.server.server_version}`
    );
    console.log(
      `迁移状态：已记录 ${database.migrationCount} 条，代码最新为 ${expectedMigration.tag}`
    );
    console.log(
      `pgvector：${database.vectorVersion ? `v${database.vectorVersion}` : '未安装'}`
    );
    console.log(
      `数据概览：用户 ${database.stats.users}，项目 ${database.stats.projects}（预设 ${database.stats.presets}，已归档 ${database.stats.archived_projects}），RAG 文档 ${database.stats.rag_documents}，Agent 检查点 ${database.stats.checkpoints}`
    );

    if (migrationBehind || missingColumns.length > 0) {
      if (missingColumns.length > 0) {
        console.error(`缺少 projects 字段：${missingColumns.join(', ')}`);
      }
      console.error(
        '数据库结构落后于当前代码，请在确认备份后运行 npm run drizzle:migrate'
      );
      process.exitCode = 1;
      return;
    }

    console.log('数据库结构与当前代码兼容。');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    `数据库检查失败：${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
