import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env.functions' })

const projectUrl = process.env.SUPABASE_URL
const syncCronSecret = process.env.SYNC_CRON_SECRET

if (!projectUrl) {
  throw new Error('SUPABASE_URL is required in .env.local to schedule OHF automation jobs.')
}

if (!syncCronSecret) {
  throw new Error('SYNC_CRON_SECRET is required in .env.functions to schedule OHF automation jobs.')
}

const functionUrl = `${projectUrl.replace(/\/+$/, '')}/functions/v1/sync-etoro-portfolio`
const reviewFunctionUrl = `${projectUrl.replace(/\/+$/, '')}/functions/v1/generate-daily-review`

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

const scheduleConfigs = [
  {
    jobName: 'ohf-hourly-sync-on-the-hour-utc',
    cron: '0 * * * *',
    scheduleKey: 'hourly-on-the-hour-utc',
    url: functionUrl,
    body: {
      trigger: 'scheduled_hourly_sync',
      scheduleKey: 'hourly-on-the-hour-utc',
    },
  },
  {
    jobName: 'ohf-daily-review-2130-utc',
    cron: '30 21 * * 1-5',
    scheduleKey: 'daily-review-2130-utc',
    url: reviewFunctionUrl,
    body: {
      trigger: 'scheduled_daily_review',
      scheduleKey: 'daily-review-2130-utc',
    },
  },
] as const

const knownJobNames = [
  'ohf-market-close-sync-2005-utc',
  'ohf-market-close-sync-2105-utc',
  'ohf-hourly-sync-05-past-utc',
  'ohf-hourly-sync-on-the-hour-utc',
  'ohf-daily-review-2130-utc',
] as const

const unscheduleSql = `
select cron.unschedule(jobid)
from cron.job
where jobname in (${knownJobNames.map((jobName) => sqlString(jobName)).join(', ')});
`

const scheduleSql = scheduleConfigs
  .map(
    (config) => `
select cron.schedule(
  ${sqlString(config.jobName)},
  ${sqlString(config.cron)},
  $schedule$
    select net.http_post(
      url := ${sqlString(config.url)},
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-cron-secret', ${sqlString(syncCronSecret)}
      ),
      body := ${sqlString(JSON.stringify(config.body))}::jsonb,
      timeout_milliseconds := 15000
    ) as request_id;
  $schedule$
);
`
  )
  .join('\n')

const sql = `
create extension if not exists pg_net;
create extension if not exists pg_cron;

${unscheduleSql}
${scheduleSql}

select jobid, jobname, schedule
from cron.job
where jobname in (${knownJobNames.map((jobName) => sqlString(jobName)).join(', ')})
order by jobname;
`

const tempDirectory = mkdtempSync(join(tmpdir(), 'ohf-hourly-sync-'))
const sqlFilePath = join(tempDirectory, 'schedule-hourly-sync.sql')
writeFileSync(sqlFilePath, sql, 'utf8')

try {
  const result =
    process.platform === 'win32'
      ? execFileSync(
          'cmd.exe',
          ['/c', 'npx', 'supabase', 'db', 'query', '--linked', '--output', 'table', '--file', sqlFilePath],
          {
            cwd: process.cwd(),
            stdio: 'pipe',
            encoding: 'utf8',
          }
        )
      : execFileSync(
          'npx',
          ['supabase', 'db', 'query', '--linked', '--output', 'table', '--file', sqlFilePath],
          {
            cwd: process.cwd(),
            stdio: 'pipe',
            encoding: 'utf8',
          }
        )

  process.stdout.write(result)
} finally {
  rmSync(tempDirectory, { recursive: true, force: true })
}
