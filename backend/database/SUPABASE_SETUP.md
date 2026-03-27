# Supabase Setup Guide — Luna Drywall & Paint Estimator

## Overview

This document covers everything needed to set up Supabase for the Luna Drywall & Paint full-stack estimator application.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click **New Project**
3. Fill in project details:
   - **Name:** `luna-estimator` (or your preferred name)
   - **Database Password:** Generate a strong password — save it somewhere safe
   - **Region:** Choose the region closest to your users (e.g., `East Coast (US)`)
4. Click **Create new project**
5. Wait 2-3 minutes for the project to provision

---

## 2. Get Your Project Credentials

Once your project is created:

1. Go to **Settings → API** in the Supabase dashboard
2. Copy the following values:

| Variable | Where to Find |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** field (e.g., `https://xxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **anon/public** key under "Project API keys" |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** key under "Project API keys" |

> ⚠️ **Security Note:** The `SUPABASE_SERVICE_ROLE_KEY` has full database access. Never expose it to the client-side (Next.js frontend). Only use it in server-side contexts (Edge Functions, API routes).

---

## 3. Set Up Environment Variables

Create a `.env.local` file in the **root of your Next.js project** (not the `backend/` folder):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=your-gemini-api-key

# GoHighLevel (GHL) Integration
GHL_PRIVATE_INTEGRATION_TOKEN=your-ghl-private-integration-token
GHL_LOCATION_ID=your-ghl-location-id
GHL_PIPELINE_ID=your-ghl-pipeline-id
GHL_WEBHOOK_SECRET=your-ghl-webhook-secret

# App
NEXT_PUBLIC_APP_URL=https://lunadrywallandpaint.com
```

The `.env.local.example` file in the `backend/` directory mirrors this for reference.

---

## 4. Run the Database Schema

### Option A: Run via Supabase Dashboard (Recommended for Initial Setup)

1. Go to **SQL Editor** in your Supabase dashboard
2. Create a **New Query**
3. Copy the contents of `backend/database/schema.sql` into the editor
4. Click **Run**

### Option B: Run via Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Push the schema
supabase db push --db-url postgres://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres
```

### Option C: Run via psql

```bash
psql "postgresql://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres" -f backend/database/schema.sql
```

---

## 5. Configure Storage Buckets

Run the following SQL in the **SQL Editor** to create the required storage buckets:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('room-photos',      'room-photos',       false, 52428800,  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('project-files',    'project-files',     false, 104857600, ARRAY['application/pdf', 'model/gltf+json', 'model/gltf-binary', 'application/octet-stream', 'application/zip']),
  ('generated-pdfs',   'generated-pdfs',    false, 20971520,  ARRAY['application/pdf']),
  ('visualizer-outputs','visualizer-outputs',false, 52428800,  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
```

---

## 6. Set Up Row Level Security (RLS)

The RLS policies are already included in `schema.sql`. They enforce:

- **Organization-level isolation** — users can only access data from their own organization
- **Role-based access** — `owner`, `admin`, `member`, and `viewer` roles have different permissions
- **Storage access** — storage paths are prefixed with `organizations/{org_id}/` to enforce isolation

To verify RLS is enabled on all tables, run:

```sql
-- Check RLS status on all tables
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All user-data tables should show `rowsecurity = true`.

---

## 7. Set Up GHL Integration (GoHighLevel)

### Private Integration Setup

1. In GoHighLevel, go to **Settings → Integrations → Private Integrations**
2. Create a new Private Integration
3. Copy the **API Token**
4. Set `GHL_PRIVATE_INTEGRATION_TOKEN` in your `.env.local`

### Get Your Location ID

1. In GHL, go to **Settings → Business Info**
2. Copy your **Location ID**
3. Set `GHL_LOCATION_ID` in your `.env.local`

### Get Your Pipeline ID

1. In GHL, go to **Opportunities → Pipelines**
2. Create or select a pipeline
3. Copy the **Pipeline ID** from the URL
4. Set `GHL_PIPELINE_ID` in your `.env.local`

### Set Up Inbound Webhook

1. In GHL, go to **Settings → Webhooks**
2. Create a new webhook for opportunity/contact events
3. Set the endpoint to: `https://lunadrywallandpaint.com/api/webhooks/ghl`
4. Copy the **Webhook Secret**
5. Set `GHL_WEBHOOK_SECRET` in your `.env.local`

---

## 8. Deploy Edge Functions

```bash
# Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy all Edge Functions
supabase functions deploy --project-ref your-project-ref

# Deploy a specific function
supabase functions deploy process-file --project-ref your-project-ref
```

Set secrets for Edge Functions:

```bash
supabase secrets set OPENAI_API_KEY=sk-... --project-ref your-project-ref
supabase secrets set GEMINI_API_KEY=your-gemini-api-key --project-ref your-project-ref
supabase secrets set GHL_PRIVATE_INTEGRATION_TOKEN=your-token --project-ref your-project-ref
supabase secrets set GHL_LOCATION_ID=your-location-id --project-ref your-project-ref
supabase secrets set GHL_PIPELINE_ID=your-pipeline-id --project-ref your-project-ref
supabase secrets set GHL_WEBHOOK_SECRET=your-webhook-secret --project-ref your-project-ref
```

---

## 9. Verify Your Setup

Run the following query in the SQL Editor to verify all tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see 16 tables matching the schema.

---

## 10. Troubleshooting

### "Relation does not exist" errors
- Make sure you've run the full `schema.sql` script
- Check you're connected to the correct Supabase project

### RLS policy denied access
- Verify the user is logged in and has a valid `organization_id`
- Check the browser console for auth token errors
- Ensure the user's `organization_id` matches the data they're trying to access

### Storage upload failures
- Verify the bucket exists: `SELECT * FROM storage.buckets;`
- Check RLS policies on `storage.objects`
- Ensure the storage path includes the org prefix

### Edge Function invocation failures
- Check Edge Function logs in the Supabase dashboard under **Edge Functions → Logs**
- Verify secrets are set: `supabase secrets list --project-ref your-project-ref`
- Ensure the function name matches exactly (case-sensitive)

---

## Project Structure

```
luna-estimator/
├── backend/
│   ├── database/
│   │   ├── SUPABASE_SETUP.md      ← You are here
│   │   └── schema.sql             ← Full DB schema with RLS
│   └── supabase/
│       └── functions/
│           ├── process-file/      ← File upload router
│           ├── extract-pdf/       ← PDF dimension extraction
│           ├── extract-polycam/    ← 3D scan parsing
│           ├── ai-visualizer/      ← Paint color visualizer
│           ├── ghl-webhook/        ← Inbound GHL webhooks
│           └── sync-to-ghl/       ← Outbound GHL sync
└── .env.local                     ← Environment variables
```
