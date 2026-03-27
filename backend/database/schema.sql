-- =============================================================================
-- Luna Drywall & Paint Estimator — Full Database Schema
-- =============================================================================
-- Run this file in your Supabase SQL Editor to set up the complete backend.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE project_status AS ENUM ('lead', 'bid', 'active', 'completed', 'cancelled');
CREATE TYPE room_status AS ENUM ('pending', 'measured', 'estimated', 'complete');
CREATE TYPE measurement_source AS ENUM ('ai_extracted', 'manual', 'calculated');
CREATE TYPE estimate_status AS ENUM ('draft', 'sent', 'approved', 'rejected', 'revised');
CREATE TYPE processing_status AS ENUM ('pending', 'uploaded', 'queued', 'processing', 'extracting', 'completed', 'failed');
CREATE TYPE job_status AS ENUM ('pending', 'queued', 'processing', 'completed', 'failed');
CREATE TYPE visualizer_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE sync_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

CREATE TABLE organizations (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    ghl_location_id  TEXT,
    ghl_pipeline_id  TEXT,
    default_currency TEXT NOT NULL DEFAULT 'USD',
    timezone      TEXT NOT NULL DEFAULT 'America/New_York',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- USERS (extends Supabase auth.users)
-- =============================================================================

CREATE TABLE users (
    id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email          TEXT NOT NULL,
    full_name      TEXT NOT NULL,
    role           user_role NOT NULL DEFAULT 'member',
    avatar_url     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CUSTOMERS
-- =============================================================================

CREATE TABLE customers (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ghl_contact_id TEXT,
    first_name     TEXT NOT NULL,
    last_name      TEXT NOT NULL,
    email          TEXT,
    phone          TEXT,
    company_name   TEXT,
    address_line1  TEXT,
    address_line2  TEXT,
    city           TEXT,
    state          TEXT,
    postal_code    TEXT,
    country        TEXT DEFAULT 'US',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE TABLE projects (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id            UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    ghl_opportunity_id     TEXT,
    name                  TEXT NOT NULL,
    status                project_status NOT NULL DEFAULT 'lead',
    address               TEXT NOT NULL,
    city                  TEXT NOT NULL,
    state                 TEXT NOT NULL,
    postal_code           TEXT NOT NULL,
    estimated_start_date  DATE,
    estimated_end_date    DATE,
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by            UUID REFERENCES users(id),
    updated_by            UUID REFERENCES users(id)
);

-- =============================================================================
-- ROOMS
-- =============================================================================

CREATE TABLE rooms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    room_type   TEXT NOT NULL,
    floor       INTEGER NOT NULL DEFAULT 1,
    status      room_status NOT NULL DEFAULT 'pending',
    notes       TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ROOM_PHOTOS
-- =============================================================================

CREATE TABLE room_photos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    file_type   TEXT NOT NULL,
    file_size   INTEGER NOT NULL,
    width       INTEGER,
    height      INTEGER,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MEASUREMENTS
-- =============================================================================

CREATE TABLE measurements (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id          UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    category         TEXT NOT NULL,
    measurement_type TEXT NOT NULL,
    label            TEXT NOT NULL,
    value            NUMERIC NOT NULL,
    unit             TEXT NOT NULL,
    source           measurement_source NOT NULL DEFAULT 'manual',
    confidence_score NUMERIC,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ESTIMATES
-- =============================================================================

CREATE TABLE estimates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL DEFAULT 1,
    status          estimate_status NOT NULL DEFAULT 'draft',
    subtotal        NUMERIC NOT NULL DEFAULT 0,
    tax_rate        NUMERIC NOT NULL DEFAULT 0,
    tax_amount      NUMERIC NOT NULL DEFAULT 0,
    markup_rate     NUMERIC NOT NULL DEFAULT 0,
    markup_amount   NUMERIC NOT NULL DEFAULT 0,
    total           NUMERIC NOT NULL DEFAULT 0,
    valid_until     DATE,
    notes           TEXT,
    ghl_opportunity_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

-- =============================================================================
-- ESTIMATE_ITEMS
-- =============================================================================

CREATE TABLE estimate_items (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estimate_id  UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    room_id      UUID REFERENCES rooms(id) ON DELETE SET NULL,
    category     TEXT NOT NULL,
    description  TEXT NOT NULL,
    quantity     NUMERIC NOT NULL DEFAULT 1,
    unit         TEXT NOT NULL,
    unit_cost    NUMERIC NOT NULL DEFAULT 0,
    total_cost   NUMERIC NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROJECT_FILES
-- =============================================================================

CREATE TABLE project_files (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    room_id           UUID REFERENCES rooms(id) ON DELETE SET NULL,
    storage_path      TEXT NOT NULL,
    file_name         TEXT NOT NULL,
    file_type         TEXT NOT NULL,
    file_size         INTEGER NOT NULL,
    mime_type         TEXT NOT NULL,
    source            TEXT NOT NULL,
    processing_status processing_status NOT NULL DEFAULT 'pending',
    processing_error  TEXT,
    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROCESSING_JOBS
-- =============================================================================

CREATE TABLE processing_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    job_type        TEXT NOT NULL,
    status          job_status NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    input_data      JSONB NOT NULL DEFAULT '{}',
    output_data     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- AI_VISUALIZER_RUNS
-- =============================================================================

CREATE TABLE ai_visualizer_runs (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_photo_id      UUID NOT NULL REFERENCES room_photos(id) ON DELETE CASCADE,
    room_id            UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    status             visualizer_status NOT NULL DEFAULT 'pending',
    wall_color_applied TEXT,
    trim_color_applied TEXT,
    output_storage_path TEXT,
    error_message      TEXT,
    model_used         TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at       TIMESTAMPTZ
);

-- =============================================================================
-- GHL_SYNC_JOBS
-- =============================================================================

CREATE TABLE ghl_sync_jobs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sync_type        TEXT NOT NULL,
    status           sync_status NOT NULL DEFAULT 'pending',
    ghl_response     JSONB,
    error_message    TEXT,
    records_synced   INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

-- =============================================================================
-- WEBHOOK_EVENTS
-- =============================================================================

CREATE TABLE webhook_events (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source         TEXT NOT NULL,
    event_type     TEXT NOT NULL,
    payload        JSONB NOT NULL,
    processed      BOOLEAN NOT NULL DEFAULT false,
    processed_at   TIMESTAMPTZ,
    error          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- GHL_INTEGRATION_SETTINGS
-- =============================================================================

CREATE TABLE ghl_integration_settings (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id      UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    is_active            BOOLEAN NOT NULL DEFAULT false,
    auth_type            TEXT NOT NULL,
    access_token         TEXT,
    refresh_token        TEXT,
    token_expires_at     TIMESTAMPTZ,
    location_id          TEXT NOT NULL,
    pipeline_id          TEXT,
    default_stage_id     TEXT,
    field_mappings       JSONB NOT NULL DEFAULT '{}',
    auto_sync_contacts   BOOLEAN NOT NULL DEFAULT true,
    auto_sync_estimates  BOOLEAN NOT NULL DEFAULT true,
    webhook_secret       TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- AUDIT_LOGS
-- =============================================================================

CREATE TABLE audit_logs (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    action         TEXT NOT NULL,
    entity_type    TEXT NOT NULL,
    entity_id      UUID,
    metadata       JSONB,
    ip_address     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_customers_organization_id ON customers(organization_id);
CREATE INDEX idx_customers_ghl_contact_id ON customers(ghl_contact_id);
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_rooms_project_id ON rooms(project_id);
CREATE INDEX idx_room_photos_room_id ON room_photos(room_id);
CREATE INDEX idx_measurements_room_id ON measurements(room_id);
CREATE INDEX idx_estimates_project_id ON estimates(project_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_project_files_processing_status ON project_files(processing_status);
CREATE INDEX idx_processing_jobs_project_file_id ON processing_jobs(project_file_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_ai_visualizer_runs_room_id ON ai_visualizer_runs(room_id);
CREATE INDEX idx_ghl_sync_jobs_organization_id ON ghl_sync_jobs(organization_id);
CREATE INDEX idx_ghl_sync_jobs_status ON ghl_sync_jobs(status);
CREATE INDEX idx_webhook_events_organization_id ON webhook_events(organization_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================================================
-- TRIGGERS — updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at     BEFORE UPDATE ON organizations              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at             BEFORE UPDATE ON users                      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER customers_updated_at          BEFORE UPDATE ON customers                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at          BEFORE UPDATE ON projects                   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER rooms_updated_at              BEFORE UPDATE ON rooms                      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER measurements_updated_at       BEFORE UPDATE ON measurements               FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER estimates_updated_at          BEFORE UPDATE ON estimates                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER estimate_items_updated_at    BEFORE UPDATE ON estimate_items              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER project_files_updated_at      BEFORE UPDATE ON project_files              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ghl_integration_settings_updated_at BEFORE UPDATE ON ghl_integration_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- HELPER FUNCTION — get user's organization_id
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_organization_id(requesting_user_id UUID)
RETURNS UUID AS $$
    SELECT organization_id FROM users WHERE id = requesting_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- HELPER FUNCTION — org-scoped storage path prefix
-- =============================================================================

CREATE OR REPLACE FUNCTION get_org_storage_prefix(requesting_user_id UUID)
RETURNS TEXT AS $$
    SELECT 'organizations/' || organization_id FROM users WHERE id = requesting_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- ROW LEVEL SECURITY — Enable on all user-data tables
-- =============================================================================

ALTER TABLE organizations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_photos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements               ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files              ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_visualizer_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_sync_jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_integration_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES — organizations
-- =============================================================================

-- Users can see their own organization
CREATE POLICY "Users can view their organization"
    ON organizations FOR SELECT
    USING (id = get_user_organization_id(auth.uid()));

-- Only owners can update organization
CREATE POLICY "Owners can update their organization"
    ON organizations FOR UPDATE
    USING (id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

-- =============================================================================
-- RLS POLICIES — users
-- =============================================================================

-- Users can view all users in their organization
CREATE POLICY "Users can view users in their organization"
    ON users FOR SELECT
    USING (organization_id = get_user_organization_id(auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

-- Owners/admins can insert new users
CREATE POLICY "Owners/admins can insert users"
    ON users FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id(auth.uid())
                AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- Owners can delete users
CREATE POLICY "Owners can delete users"
    ON users FOR DELETE
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

-- =============================================================================
-- RLS POLICIES — customers
-- =============================================================================

CREATE POLICY "Members can view customers in their org"
    ON customers FOR SELECT
    USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Members can insert customers in their org"
    ON customers FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id(auth.uid())
                AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update customers in their org"
    ON customers FOR UPDATE
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Admins/owners can delete customers"
    ON customers FOR DELETE
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- =============================================================================
-- RLS POLICIES — projects
-- =============================================================================

CREATE POLICY "Members can view projects in their org"
    ON projects FOR SELECT
    USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Members can insert projects in their org"
    ON projects FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id(auth.uid())
                AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update projects in their org"
    ON projects FOR UPDATE
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Admins/owners can delete projects"
    ON projects FOR DELETE
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- =============================================================================
-- RLS POLICIES — rooms
-- =============================================================================

CREATE POLICY "Members can view rooms in their projects"
    ON rooms FOR SELECT
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert rooms"
    ON rooms FOR INSERT
    WITH CHECK (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update rooms"
    ON rooms FOR UPDATE
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Admins/owners can delete rooms"
    ON rooms FOR DELETE
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- =============================================================================
-- RLS POLICIES — room_photos
-- =============================================================================

CREATE POLICY "Members can view room photos in their projects"
    ON room_photos FOR SELECT
    USING (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert room photos"
    ON room_photos FOR INSERT
    WITH CHECK (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can delete room photos"
    ON room_photos FOR DELETE
    USING (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

-- =============================================================================
-- RLS POLICIES — measurements
-- =============================================================================

CREATE POLICY "Members can view measurements in their projects"
    ON measurements FOR SELECT
    USING (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert measurements"
    ON measurements FOR INSERT
    WITH CHECK (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update measurements"
    ON measurements FOR UPDATE
    USING (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can delete measurements"
    ON measurements FOR DELETE
    USING (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

-- =============================================================================
-- RLS POLICIES — estimates
-- =============================================================================

CREATE POLICY "Members can view estimates in their projects"
    ON estimates FOR SELECT
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert estimates"
    ON estimates FOR INSERT
    WITH CHECK (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update estimates"
    ON estimates FOR UPDATE
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Admins/owners can delete estimates"
    ON estimates FOR DELETE
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- =============================================================================
-- RLS POLICIES — estimate_items
-- =============================================================================

CREATE POLICY "Members can view estimate items in their projects"
    ON estimate_items FOR SELECT
    USING (estimate_id IN (
        SELECT e.id FROM estimates e
        JOIN projects p ON e.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert estimate items"
    ON estimate_items FOR INSERT
    WITH CHECK (estimate_id IN (
        SELECT e.id FROM estimates e
        JOIN projects p ON e.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update estimate items"
    ON estimate_items FOR UPDATE
    USING (estimate_id IN (
        SELECT e.id FROM estimates e
        JOIN projects p ON e.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can delete estimate items"
    ON estimate_items FOR DELETE
    USING (estimate_id IN (
        SELECT e.id FROM estimates e
        JOIN projects p ON e.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

-- =============================================================================
-- RLS POLICIES — project_files
-- =============================================================================

CREATE POLICY "Members can view project files in their org"
    ON project_files FOR SELECT
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert project files"
    ON project_files FOR INSERT
    WITH CHECK (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update project files"
    ON project_files FOR UPDATE
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can delete project files"
    ON project_files FOR DELETE
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

-- =============================================================================
-- RLS POLICIES — processing_jobs
-- =============================================================================

CREATE POLICY "Members can view processing jobs in their org"
    ON processing_jobs FOR SELECT
    USING (project_file_id IN (
        SELECT pf.id FROM project_files pf
        JOIN projects p ON pf.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert processing jobs"
    ON processing_jobs FOR INSERT
    WITH CHECK (project_file_id IN (
        SELECT pf.id FROM project_files pf
        JOIN projects p ON pf.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can update processing jobs"
    ON processing_jobs FOR UPDATE
    USING (project_file_id IN (
        SELECT pf.id FROM project_files pf
        JOIN projects p ON pf.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

-- =============================================================================
-- RLS POLICIES — ai_visualizer_runs
-- =============================================================================

CREATE POLICY "Members can view visualizer runs in their projects"
    ON ai_visualizer_runs FOR SELECT
    USING (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert visualizer runs"
    ON ai_visualizer_runs FOR INSERT
    WITH CHECK (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update visualizer runs"
    ON ai_visualizer_runs FOR UPDATE
    USING (room_id IN (
        SELECT r.id FROM rooms r
        JOIN projects p ON r.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

-- =============================================================================
-- RLS POLICIES — ghl_sync_jobs
-- =============================================================================

CREATE POLICY "Members can view sync jobs in their org"
    ON ghl_sync_jobs FOR SELECT
    USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins/owners can insert sync jobs"
    ON ghl_sync_jobs FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id(auth.uid())
                AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admins/owners can update sync jobs"
    ON ghl_sync_jobs FOR UPDATE
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- =============================================================================
-- RLS POLICIES — webhook_events
-- =============================================================================

CREATE POLICY "Members can view webhook events in their org"
    ON webhook_events FOR SELECT
    USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Service role can insert webhook events"
    ON webhook_events FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id(auth.uid())
                OR auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- RLS POLICIES — ghl_integration_settings
-- =============================================================================

CREATE POLICY "Owners can view ghl settings in their org"
    ON ghl_integration_settings FOR SELECT
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

CREATE POLICY "Owners can insert ghl settings"
    ON ghl_integration_settings FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id(auth.uid())
                AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

CREATE POLICY "Owners can update ghl settings"
    ON ghl_integration_settings FOR UPDATE
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

-- =============================================================================
-- RLS POLICIES — audit_logs
-- =============================================================================

CREATE POLICY "Owners/admins can view audit logs in their org"
    ON audit_logs FOR SELECT
    USING (organization_id = get_user_organization_id(auth.uid())
           AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Service role can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id(auth.uid())
                OR auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- STORAGE BUCKETS (run separately in SQL Editor or via API)
-- =============================================================================

-- NOTE: Run these as a separate batch AFTER the tables above.
-- The storage.system policy already handles bucket existence checks.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('room-photos',        'room-photos',         false, 52428800,  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('project-files',      'project-files',       false, 104857600, ARRAY['application/pdf', 'model/gltf+json', 'model/gltf-binary', 'application/octet-stream', 'application/zip', 'text/plain']),
  ('generated-pdfs',     'generated-pdfs',      false, 20971520,  ARRAY['application/pdf']),
  ('visualizer-outputs', 'visualizer-outputs',  false, 52428800,  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STORAGE RLS POLICIES
-- =============================================================================

-- Helper: storage path must be prefixed with org folder
CREATE OR REPLACE FUNCTION storage_org_path_match(storage_path TEXT, requesting_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT storage_path LIKE get_org_storage_prefix(requesting_user_id) || '%';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- room-photos
CREATE POLICY "Users can upload room photos within their org"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'room-photos'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can view room photos within their org"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'room-photos'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can update room photos within their org"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'room-photos'
        AND storage_org_path_match(name, auth.uid())
    )
    WITH CHECK (
        bucket_id = 'room-photos'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can delete room photos within their org"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'room-photos'
        AND storage_org_path_match(name, auth.uid())
    );

-- project-files
CREATE POLICY "Users can upload project files within their org"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'project-files'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can view project files within their org"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'project-files'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can update project files within their org"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'project-files'
        AND storage_org_path_match(name, auth.uid())
    )
    WITH CHECK (
        bucket_id = 'project-files'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can delete project files within their org"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'project-files'
        AND storage_org_path_match(name, auth.uid())
    );

-- generated-pdfs
CREATE POLICY "Users can upload generated PDFs within their org"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'generated-pdfs'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can view generated PDFs within their org"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'generated-pdfs'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can delete generated PDFs within their org"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'generated-pdfs'
        AND storage_org_path_match(name, auth.uid())
    );

-- visualizer-outputs
CREATE POLICY "Users can upload visualizer outputs within their org"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'visualizer-outputs'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can view visualizer outputs within their org"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'visualizer-outputs'
        AND storage_org_path_match(name, auth.uid())
    );

CREATE POLICY "Users can delete visualizer outputs within their org"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'visualizer-outputs'
        AND storage_org_path_match(name, auth.uid())
    );

-- =============================================================================
-- AUDIT LOG HELPER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION log_audit_action(
    p_organization_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
    INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata, ip_address)
    VALUES (p_organization_id, p_user_id, p_action, p_entity_type, p_entity_id, p_metadata, p_ip_address)
    RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
    DECLARE
        org_id UUID;
    BEGIN
        -- If this is a new organization signup (first user), create the org
        -- Otherwise, the org_id should be passed in user_metadata
        IF NEW.raw_user_meta_data ? 'organization_id' THEN
            org_id := NEW.raw_user_meta_data ->> 'organization_id';
        ELSE
            -- Create a new organization for this user
            INSERT INTO organizations (name, default_currency, timezone)
            VALUES (
                COALESCE(NEW.raw_user_meta_data ->> 'organization_name', NEW.email || '''s Organization'),
                COALESCE(NEW.raw_user_meta_data ->> 'default_currency', 'USD'),
                COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'America/New_York')
            )
            RETURNING id INTO org_id;

            -- Make this user the owner
        END IF;

        -- Create user profile
        INSERT INTO users (id, organization_id, email, full_name, role, avatar_url)
        VALUES (
            NEW.id,
            org_id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
            'owner',
            NEW.raw_user_meta_data ->> 'avatar_url'
        );

        RETURN NEW;
    END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant usage on custom types
GRANT USAGE ON TYPE user_role TO anon, authenticated, service_role;
GRANT USAGE ON TYPE project_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE room_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE measurement_source TO anon, authenticated, service_role;
GRANT USAGE ON TYPE estimate_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE processing_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE job_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE visualizer_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE sync_status TO anon, authenticated, service_role;

-- Grant all table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant storage permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO service_role;
GRANT ALL ON storage.buckets TO authenticated, service_role;

-- =============================================================================
-- SCHEMA VERSION TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_versions (
    version    INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes      TEXT
);

INSERT INTO schema_versions (version, notes)
VALUES (1, 'Initial Luna Estimator schema — 16 tables, RLS, storage, triggers, audit log')
ON CONFLICT (version) DO NOTHING;