-- =============================================================================
-- Luna Estimator — Materials Order Tables
-- Migration: 20260328000001_materials_order
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUM
-- =============================================================================

CREATE TYPE materials_order_status AS ENUM ('draft', 'ordered', 'partial', 'received', 'cancelled');

-- =============================================================================
-- MATERIALS_ORDERS
-- =============================================================================

CREATE TABLE materials_orders (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    estimate_id          UUID REFERENCES estimates(id) ON DELETE SET NULL,
    version              INTEGER NOT NULL DEFAULT 1,
    status               materials_order_status NOT NULL DEFAULT 'draft',
    notes                TEXT,
    supplier_name        TEXT,
    order_date           DATE,
    expected_delivery    DATE,
    subtotal             NUMERIC NOT NULL DEFAULT 0,
    tax_rate             NUMERIC NOT NULL DEFAULT 0,
    tax_amount           NUMERIC NOT NULL DEFAULT 0,
    total                NUMERIC NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by           UUID REFERENCES users(id),
    updated_by           UUID REFERENCES users(id)
);

-- =============================================================================
-- MATERIALS_ORDER_ITEMS
-- =============================================================================

CREATE TABLE materials_order_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    materials_order_id   UUID NOT NULL REFERENCES materials_orders(id) ON DELETE CASCADE,
    category             TEXT NOT NULL,
    description          TEXT NOT NULL,
    supplier_part_number TEXT,
    brand                TEXT,
    quantity             NUMERIC NOT NULL DEFAULT 1,
    unit                 TEXT NOT NULL,
    unit_cost            NUMERIC NOT NULL DEFAULT 0,
    total_cost           NUMERIC NOT NULL DEFAULT 0,
    is_ordered           BOOLEAN NOT NULL DEFAULT false,
    ordered_quantity     NUMERIC,
    notes                TEXT,
    sort_order           INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_materials_orders_project_id ON materials_orders(project_id);
CREATE INDEX idx_materials_orders_estimate_id ON materials_orders(estimate_id);
CREATE INDEX idx_materials_orders_status ON materials_orders(status);
CREATE INDEX idx_materials_order_items_materials_order_id ON materials_order_items(materials_order_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER materials_orders_updated_at
    BEFORE UPDATE ON materials_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER materials_order_items_updated_at
    BEFORE UPDATE ON materials_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE materials_orders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view materials orders in their projects"
    ON materials_orders FOR SELECT
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert materials orders"
    ON materials_orders FOR INSERT
    WITH CHECK (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update materials orders"
    ON materials_orders FOR UPDATE
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Admins/owners can delete materials orders"
    ON materials_orders FOR DELETE
    USING (project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Members can view materials order items"
    ON materials_order_items FOR SELECT
    USING (materials_order_id IN (
        SELECT mo.id FROM materials_orders mo
        JOIN projects p ON mo.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ));

CREATE POLICY "Members can insert materials order items"
    ON materials_order_items FOR INSERT
    WITH CHECK (materials_order_id IN (
        SELECT mo.id FROM materials_orders mo
        JOIN projects p ON mo.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can update materials order items"
    ON materials_order_items FOR UPDATE
    USING (materials_order_id IN (
        SELECT mo.id FROM materials_orders mo
        JOIN projects p ON mo.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

CREATE POLICY "Members can delete materials order items"
    ON materials_order_items FOR DELETE
    USING (materials_order_id IN (
        SELECT mo.id FROM materials_orders mo
        JOIN projects p ON mo.project_id = p.id
        WHERE p.organization_id = get_user_organization_id(auth.uid())
    ) AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')));

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT USAGE ON TYPE materials_order_status TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON materials_orders TO authenticated, service_role;
GRANT SELECT ON materials_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON materials_order_items TO authenticated, service_role;
GRANT SELECT ON materials_order_items TO anon;

-- =============================================================================
-- SCHEMA VERSION
-- =============================================================================

INSERT INTO schema_versions (version, notes)
VALUES (2, 'Materials order tables — materials_orders, materials_order_items, RLS, indexes')
ON CONFLICT (version) DO NOTHING;
