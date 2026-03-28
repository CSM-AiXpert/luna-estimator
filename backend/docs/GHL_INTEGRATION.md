# Luna × GoHighLevel (CoastaFlow) Integration Docs

## Overview
Bi-directional sync between Luna Estimator (Supabase/Next.js) and GoHighLevel CRM (CoastaFlow).
Luna acts as the system-of-record for estimates; GHL acts as the system-of-record for CRM contacts/opportunities.

---

## Authentication

### Private Integration (Development / API Token)
Use for internal tools and server-to-server communication.

```
Authorization: Bearer <ACCESS_TOKEN>
```

### OAuth 2.0 (Production / Multi-tenant)
Used when Luna is distributed as an app in the GHL Marketplace, or for agency-level access.

**Authorization URL:**
```
https://marketplace.gohighlevel.com/oauth/chooselocation
```

**Token URL:**
```
https://services.leadconnectorhq.com/oauth/token
```

**Scopes required:**
- `contacts.readonly` / `contacts.write`
- `opportunities.readonly` / `opportunities.write`
- `locations.readonly`
- `tags.readonly` / `tags.write`
- `webhooks.readonly` / `webhooks.write`

---

## API Base URL

```
https://services.leadconnectorhq.com
```

All endpoints are prefixed with `/v2/`.

---

## Core Resources

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contacts/?location_id={loc}` | List contacts (paginated) |
| POST | `/contacts/` | Create contact |
| GET | `/contacts/{contactId}` | Get single contact |
| PUT | `/contacts/{contactId}` | Update contact |
| DELETE | `/contacts/{contactId}` | Delete contact |
| GET | `/contacts/search?location_id={loc}&email={email}` | Search by email/phone |
| POST | `/contacts/{contactId}/tags` | Add tag |
| DELETE | `/contacts/{contactId}/tags/{tag}` | Remove tag |
| POST | `/contacts/{contactId}/notes` | Add note |

**Create Contact Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "phone1": "+15551234567",
  "companyName": "Doe Construction",
  "address1": "123 Main St",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "US",
  "locationId": "0y2jUMFpRTn2Fsae9LzE",
  "tags": ["luna-customer"]
}
```

**Contact Response:**
```json
{
  "id": "CONTACT_ID",
  "locationId": "0y2jUMFpRTn2Fsae9LzE",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "phone1": "+15551234567",
  "companyName": "Doe Construction",
  "address1": "123 Main St",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "US",
  "tags": ["luna-customer"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Opportunities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/opportunities/?location_id={loc}` | List opportunities |
| POST | `/opportunities/` | Create opportunity |
| GET | `/opportunities/{opportunityId}` | Get single opportunity |
| PUT | `/opportunities/{opportunityId}` | Update opportunity |
| PUT | `/opportunities/{opportunityId}/move` | Move to stage |
| DELETE | `/opportunities/{opportunityId}` | Delete opportunity |

**Create Opportunity Request Body:**
```json
{
  "name": "Kitchen Drywall Project",
  "locationId": "0y2jUMFpRTn2Fsae9LzE",
  "pipelineId": "PIPELINE_ID",
  "pipelineStageId": "STAGE_ID",
  "contactId": "CONTACT_ID",
  "maxVal": 15000,
  "status": "open",
  "monetaryValue": 15000,
  "source": "Luna Estimator"
}
```

**Move Opportunity Stage Request Body:**
```json
{
  "pipelineStageId": "NEW_STAGE_ID"
}
```

---

### Pipelines
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pipelines/?location_id={loc}` | List all pipelines |
| GET | `/pipelines/{pipelineId}/pipelinestages/` | Get pipeline stages |

---

### Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tags/?location_id={loc}` | List all tags |

---

### Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/contacts/{contactId}/notes` | Add note to contact |
| POST | `/opportunities/{oppId}/notes` | Add note to opportunity |

**Note Request Body:**
```json
{
  "body": "Estimate #1234 created: $15,000 for kitchen drywall project.",
  "type": "Log"
}
```

---

## Webhooks

**Webhook Subscribe Endpoint:**
```
POST https://services.leadconnectorhq.com/webhooks/
```

**Payload:**
```json
{
  "name": "Luna CRM Sync",
  "events": [
    "contact.create",
    "contact.update",
    "opportunity.create",
    "opportunity.stage_update",
    "opportunity.update"
  ],
  "locationId": "0y2jUMFpRTn2Fsae9LzE",
  "webhookUrl": "https://your-project.supabase.co/functions/v1/ghl-webhook",
  "webhookSecret": "WH_SECRET_XXX"
}
```

**Webhook Signature Verification:**
GHL signs each webhook with HMAC-SHA256 using the `webhookSecret`. The signature is in the header:
```
X-Hook-Secret: <signature>
```

Verify by computing `HMAC-SHA256(secret, raw_body)` and comparing to the header value.

---

## Rate Limits

| Plan | Requests / Minute |
|------|------------------|
| Trial | 30 |
| Starter | 60 |
| Professional | 100 |
| Agency | 200 |

**Headers returned:**
```
X ratelimit-limit: 100
X ratelimit-remaining: 95
X ratelimit-reset: 1704067200
```

When rate limited (429), back off with `Retry-After` header value.

---

## Luna → GHL Data Flow

```
Luna Customer created/updated
  → syncCustomerToGHL()
    → GHL Contact upserted
    → ghl_sync_jobs logged

Luna Project created/updated
  → syncProjectToGHL()
    → GHL Opportunity upserted (linked to Contact)
    → ghl_sync_jobs logged

Luna Estimate created/updated
  → syncEstimateToGHL()
    → GHL Opportunity.monetaryValue updated
    → GHL Note added with line items
    → GHL Opportunity stage updated if status changed
    → ghl_sync_jobs logged
```

---

## GHL → Luna Data Flow

```
GHL Webhook received at /ghl-webhook
  → Signature verified
  → Raw event stored in webhook_events
  → Async processing:
    contact.create/update → Luna customer updated (matched by email)
    opportunity.create/update/stage_update → Luna project status updated
```

---

## Supabase Tables

### ghl_integration_settings
Stores OAuth tokens and API credentials.
```sql
CREATE TABLE ghl_integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT UNIQUE NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  private_integration_token TEXT,
  webhook_id TEXT,
  webhook_secret TEXT,
  pipeline_id TEXT,
  pipeline_stage_initial TEXT,
  pipeline_stage_estimate_sent TEXT,
  pipeline_stage_won TEXT,
  pipeline_stage_lost TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### ghl_sync_jobs
Audit log of all sync operations.
```sql
CREATE TABLE ghl_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'contact_push' | 'contact_pull' | 'opportunity_push' | 'opportunity_pull'
  direction TEXT NOT NULL, -- 'luna_to_ghl' | 'ghl_to_luna'
  luna_id TEXT,
  ghl_id TEXT,
  status TEXT NOT NULL, -- 'pending' | 'success' | 'failed'
  error_message TEXT,
  payload JSONB,
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### webhook_events
Raw storage of inbound GHL webhooks.
```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  ghl_contact_id TEXT,
  ghl_opportunity_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Environment Variables

```env
GHL_ACCESS_TOKEN=        # Private integration token (dev)
GHL_LOCATION_ID=         # Default location ID (Sub-account)
GHL_CLIENT_ID=           # OAuth client ID
GHL_CLIENT_SECRET=       # OAuth client secret
GHL_WEBHOOK_SECRET=      # Webhook verification secret
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role key
```

---

## Endpoints Reference

| Resource | Base Path |
|----------|-----------|
| Contacts | `/v2/contacts/` |
| Opportunities | `/v2/opportunities/` |
| Pipelines | `/v2/pipelines/` |
| Tags | `/v2/tags/` |
| Notes | `/v2/contacts/{id}/notes` |
| Webhooks | `/v2/webhooks/` |
