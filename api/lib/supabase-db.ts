import { getSupabaseAdmin } from "./supabase-admin";

export type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
};

export function isUuidLike(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: string | Date | null | undefined) {
  return value ? toDate(value) : null;
}

export function assertSupabaseSuccess(error: { message: string } | null, message: string) {
  if (error) {
    throw new Error(`${message}: ${error.message}`);
  }
}

export function isProjectsUserIdMissingError(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("projects.user_id does not exist") ||
    (message.includes("column") && message.includes("user_id") && message.includes("does not exist")) ||
    (message.includes("invalid input syntax for type uuid") && message.includes("2")) ||
    message.includes("invalid input syntax for type uuid")
  );
}

export function mapProjectRow(row: Record<string, any>) {
  return {
    id: Number(row.id),
    userId: row.user_id,
    estimateNumber: row.estimate_number,
    status: row.status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    propertyAddress: row.property_address,
    propertyType: row.property_type,
    projectType: row.project_type,
    notes: row.notes,
    internalNotes: row.internal_notes,
    leadSource: row.lead_source,
    tags: row.tags,
    crmContactId: row.crm_contact_id,
    crmOpportunityId: row.crm_opportunity_id,
    crmEstimateId: row.crm_estimate_id,
    crmSyncStatus: row.crm_sync_status,
    subtotal: row.subtotal,
    taxRate: row.tax_rate,
    taxAmount: row.tax_amount,
    discountAmount: row.discount_amount,
    total: row.total,
    depositPercent: row.deposit_percent,
    depositAmount: row.deposit_amount,
    customerSignedAt: toNullableDate(row.customer_signed_at),
    customerSignatureName: row.customer_signature_name,
    estimatorSignedAt: toNullableDate(row.estimator_signed_at),
    estimatorSignatureName: row.estimator_signature_name,
    unsignedPdfUrl: row.unsigned_pdf_url,
    signedPdfUrl: row.signed_pdf_url,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function mapRoomRow(row: Record<string, any>) {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    name: row.name,
    sortOrder: row.sort_order,
    length: row.length,
    width: row.width,
    height: row.height,
    wallSqFt: row.wall_sq_ft,
    ceilingSqFt: row.ceiling_sq_ft,
    totalSqFt: row.total_sq_ft,
    doorCount: row.door_count,
    windowCount: row.window_count,
    trimLinearFt: row.trim_linear_ft,
    baseboardLinearFt: row.baseboard_linear_ft,
    hasDrywallRepair: row.has_drywall_repair,
    paintScope: row.paint_scope,
    textureScope: row.texture_scope,
    prepComplexity: row.prep_complexity,
    repairComplexity: row.repair_complexity,
    paintBrand: row.paint_brand,
    paintColor: row.paint_color,
    paintColorCode: row.paint_color_code,
    finishType: row.finish_type,
    productLine: row.product_line,
    coats: row.coats,
    photos: row.photos,
    aiVisualizationUrl: row.ai_visualization_url,
    notes: row.notes,
    internalNotes: row.internal_notes,
    subtotal: row.subtotal,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function mapLineItemRow(row: Record<string, any>) {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    roomId: row.room_id === null ? null : Number(row.room_id),
    description: row.description,
    category: row.category,
    scope: row.scope,
    quantity: row.quantity,
    unit: row.unit,
    rate: row.rate,
    subtotal: row.subtotal,
    sortOrder: row.sort_order,
    isInternal: row.is_internal,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function mapMediaRow(row: Record<string, any>) {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    roomId: row.room_id === null ? null : Number(row.room_id),
    url: row.url,
    caption: row.caption,
    category: row.category,
    includeOnPdf: row.include_on_pdf,
    isInternal: row.is_internal,
    sortOrder: row.sort_order,
    createdAt: toDate(row.created_at),
  };
}

export async function getOwnedProjectRow(projectId: number, userId: string) {
  const supabase = getSupabaseAdmin();
  if (!isUuidLike(userId)) {
    const fallback = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    assertSupabaseSuccess(fallback.error, "Unable to load project");
    return fallback.data;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (isProjectsUserIdMissingError(error)) {
    const fallback = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    assertSupabaseSuccess(fallback.error, "Unable to load project");
    return fallback.data;
  }

  assertSupabaseSuccess(error, "Unable to load project");
  return data;
}

export async function requireOwnedProject(projectId: number, userId: string) {
  const project = await getOwnedProjectRow(projectId, userId);
  if (!project) {
    throw new Error("Project not found.");
  }
  return project;
}

export async function requireOwnedRoom(roomId: number, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  assertSupabaseSuccess(error, "Unable to load room");
  if (!data) {
    throw new Error("Room not found.");
  }

  await requireOwnedProject(Number(data.project_id), userId);
  return data;
}

export async function requireOwnedLineItem(lineItemId: number, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("line_items")
    .select("*")
    .eq("id", lineItemId)
    .maybeSingle();

  assertSupabaseSuccess(error, "Unable to load line item");
  if (!data) {
    throw new Error("Line item not found.");
  }

  await requireOwnedProject(Number(data.project_id), userId);
  return data;
}
