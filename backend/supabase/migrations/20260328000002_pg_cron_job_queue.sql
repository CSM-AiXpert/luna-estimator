-- pg_cron setup for file processing queue
-- Enables automatic dispatching of queued file processing jobs

-- Note: pg_cron extension must already be enabled in Supabase
-- (it was enabled when the database was provisioned)

-- Create the dispatch function
CREATE OR REPLACE FUNCTION dispatch_processing_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  job_record RECORD;
  extractor_url TEXT;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_key := current_setting('app.settings.supabase_service_key', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'app.settings not configured — cannot dispatch jobs';
    RETURN;
  END;

  -- Pick one pending job (oldest first)
  SELECT id, job_type INTO job_record
  FROM processing_jobs
  WHERE status = 'queued'
  ORDER BY created_at ASC LIMIT 1;

  IF job_record IS NULL THEN RETURN; END IF;

  -- Map job_type to edge function URL
  CASE job_record.job_type
    WHEN 'extract-pdf'          THEN extractor_url := '/functions/v1/extract-pdf';
    WHEN 'extract-csv'          THEN extractor_url := '/functions/v1/extract-csv';
    WHEN 'extract-dxf'          THEN extractor_url := '/functions/v1/extract-dxf';
    WHEN 'extract-polycam'      THEN extractor_url := '/functions/v1/extract-polycam';
    WHEN 'extract-measurements' THEN extractor_url := '/functions/v1/extract-measurements';
    ELSE
      UPDATE processing_jobs
      SET status = 'failed', error_message = 'Unknown job_type: ' || COALESCE(job_record.job_type, 'NULL')
      WHERE id = job_record.id;
      RETURN;
  END CASE;

  -- Call the extractor edge function via HTTP POST
  PERFORM net.http_post(
    url := supabase_url || extractor_url,
    body := (json_build_object('job_id', job_record.id))::text,
    headers := json_build_array(
      json_build_object('name', 'Content-Type', 'value', 'application/json'),
      json_build_object('name', 'apikey', 'value', service_key)
    )
  );

  RAISE NOTICE 'Dispatched job % to %', job_record.id, extractor_url;
END;
$func$;

-- Schedule: run every minute to pick up new queued jobs
-- cron.schedule returns void; errors are caught and logged
DO $$
BEGIN
  -- Try to unschedule existing job (ignore if not found)
  PERFORM cron.unschedule('process-queued-jobs');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No existing cron job to remove: %', SQLERRM;
END;
$$;

SELECT cron.schedule(
  'process-queued-jobs',   -- job name (unique per project)
  '* * * * *',             -- every minute
  'SELECT dispatch_processing_job()'
);
