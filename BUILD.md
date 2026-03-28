# Luna Estimator — Build Manifest

## Overview
Full-stack estimator + project intelligence platform for Luna Drywall & Paint.
Connected to CoastaFlow / GoHighLevel CRM.

## Tech Stack
- **Frontend:** Next.js 15 (App Router), TypeScript strict, Tailwind CSS, Radix UI, lucide-react, React Hook Form + Zod, TanStack Query
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions, RLS)
- **AI:** OpenAI + Gemini (Edge Functions, keys via env vars)
- **CRM:** GoHighLevel API v2 (bi-directional, abstracted)
- **File formats:** PDF, PNG/JPEG, OBJ, GLTF/GLB, PLY, DXF, CSV

## Deployment
- Frontend: Vercel (CSM-AiXpert GitHub org)
- Domain: lunadrywallandpaint.com
- Backend: Supabase Cloud

## DB Schema
See backend/database/schema.sql

## Agent Phase 1
- [x] Mia (orchestrator): Architecture + this manifest
- [ ] Agent A (backend): Supabase + DB schema + Edge Functions
- [ ] Agent B (frontend): Next.js scaffold + auth + dashboard + routing
- [ ] Agent C (file/AI pipeline): File ingestion + processing jobs + AI extraction + AI visualizer
- [ ] Agent D (GHL): CRM integration service + webhook handling + sync jobs

## Agent Phase 2
- [ ] Audit team: Verify all flows, calculations, CRM sync, file processing

## Completion Criteria
- [ ] Backend fully operational
- [ ] Storage + processing pipelines work
- [ ] Estimator functions end-to-end
- [ ] AI visualizer behaves correctly (only paint/trim changes, no geometry)
- [ ] File ingestion works correctly
- [ ] GHL integration fully wired
- [ ] Audit agents verify everything
