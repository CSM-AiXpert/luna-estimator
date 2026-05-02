import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { env } from "./lib/env";
import {
  assertSupabaseSuccess,
  isUuidLike,
  isProjectsUserIdMissingError,
  mapLineItemRow,
  mapProjectRow,
  mapRoomRow,
  requireOwnedLineItem,
  requireOwnedProject,
  requireOwnedRoom,
} from "./lib/supabase-db";
import { getSupabaseAdmin } from "./lib/supabase-admin";
import {
  makeEstimateNumber,
  mockLineItems,
  mockProjects,
  mockRooms,
  nextIds,
} from "./mock-data";

function generateEstimateNumber(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 999).toString().padStart(3, "0");
  return `LUNA-${dateStr}-${random}`;
}

const projectUpdateInput = z.object({
  id: z.number(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  propertyAddress: z.string().optional(),
  propertyType: z.string().optional(),
  projectType: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  leadSource: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum([
    "draft",
    "ready_for_review",
    "sent",
    "signed",
    "deposit_requested",
    "in_pipeline",
    "completed",
    "archived",
  ]).optional(),
  subtotal: z.number().optional(),
  taxRate: z.number().optional(),
  taxAmount: z.number().optional(),
  discountAmount: z.number().optional(),
  total: z.number().optional(),
  depositPercent: z.number().optional(),
  depositAmount: z.number().optional(),
  crmSyncStatus: z.string().optional(),
  crmContactId: z.string().optional(),
  crmOpportunityId: z.string().optional(),
  crmEstimateId: z.string().optional(),
  customerSignedAt: z.date().nullable().optional(),
  customerSignatureName: z.string().optional(),
  estimatorSignedAt: z.date().nullable().optional(),
  estimatorSignatureName: z.string().optional(),
  unsignedPdfUrl: z.string().optional(),
  signedPdfUrl: z.string().optional(),
});

const roomInput = z.object({
  projectId: z.number(),
  name: z.string().min(1),
  sortOrder: z.number().optional(),
  length: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  wallSqFt: z.number().optional(),
  ceilingSqFt: z.number().optional(),
  totalSqFt: z.number().optional(),
  doorCount: z.number().optional(),
  windowCount: z.number().optional(),
  trimLinearFt: z.number().optional(),
  baseboardLinearFt: z.number().optional(),
  hasDrywallRepair: z.array(z.string()).optional(),
  paintScope: z.array(z.string()).optional(),
  textureScope: z.array(z.string()).optional(),
  prepComplexity: z.string().optional(),
  repairComplexity: z.string().optional(),
  paintBrand: z.string().optional(),
  paintColor: z.string().optional(),
  paintColorCode: z.string().optional(),
  finishType: z.string().optional(),
  productLine: z.string().optional(),
  coats: z.number().optional(),
  photos: z.array(z.string()).optional(),
  aiVisualizationUrl: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

const roomUpdateInput = roomInput.partial().extend({
  id: z.number(),
  projectId: z.number().optional(),
  subtotal: z.number().optional(),
});

const lineItemInput = z.object({
  projectId: z.number(),
  roomId: z.number().optional(),
  description: z.string().min(1),
  category: z.string().optional(),
  scope: z.string().optional(),
  quantity: z.number().default(1),
  unit: z.string().default("ea"),
  rate: z.number().default(0),
  subtotal: z.number().optional(),
  sortOrder: z.number().optional(),
  isInternal: z.number().optional(),
});

const lineItemUpdateInput = lineItemInput.partial().extend({
  id: z.number(),
  projectId: z.number().optional(),
});

function asDecimalString(value: number | undefined) {
  return value === undefined ? undefined : value.toFixed(2);
}

function projectPatch(input: Omit<z.infer<typeof projectUpdateInput>, "id">) {
  return {
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_email: input.customerEmail,
    property_address: input.propertyAddress,
    property_type: input.propertyType,
    project_type: input.projectType,
    notes: input.notes,
    internal_notes: input.internalNotes,
    lead_source: input.leadSource,
    tags: input.tags,
    status: input.status,
    subtotal: asDecimalString(input.subtotal),
    tax_rate: asDecimalString(input.taxRate),
    tax_amount: asDecimalString(input.taxAmount),
    discount_amount: asDecimalString(input.discountAmount),
    total: asDecimalString(input.total),
    deposit_percent: input.depositPercent,
    deposit_amount: asDecimalString(input.depositAmount),
    crm_sync_status: input.crmSyncStatus,
    crm_contact_id: input.crmContactId,
    crm_opportunity_id: input.crmOpportunityId,
    crm_estimate_id: input.crmEstimateId,
    customer_signed_at: input.customerSignedAt?.toISOString(),
    customer_signature_name: input.customerSignatureName,
    estimator_signed_at: input.estimatorSignedAt?.toISOString(),
    estimator_signature_name: input.estimatorSignatureName,
    unsigned_pdf_url: input.unsignedPdfUrl,
    signed_pdf_url: input.signedPdfUrl,
  };
}

function roomPatch(input: Omit<z.infer<typeof roomUpdateInput>, "id">) {
  return {
    project_id: input.projectId,
    name: input.name,
    sort_order: input.sortOrder,
    length: asDecimalString(input.length),
    width: asDecimalString(input.width),
    height: asDecimalString(input.height),
    wall_sq_ft: asDecimalString(input.wallSqFt),
    ceiling_sq_ft: asDecimalString(input.ceilingSqFt),
    total_sq_ft: asDecimalString(input.totalSqFt),
    door_count: input.doorCount,
    window_count: input.windowCount,
    trim_linear_ft: asDecimalString(input.trimLinearFt),
    baseboard_linear_ft: asDecimalString(input.baseboardLinearFt),
    has_drywall_repair: input.hasDrywallRepair,
    paint_scope: input.paintScope,
    texture_scope: input.textureScope,
    prep_complexity: input.prepComplexity,
    repair_complexity: input.repairComplexity,
    paint_brand: input.paintBrand,
    paint_color: input.paintColor,
    paint_color_code: input.paintColorCode,
    finish_type: input.finishType,
    product_line: input.productLine,
    coats: input.coats,
    photos: input.photos,
    ai_visualization_url: input.aiVisualizationUrl,
    notes: input.notes,
    internal_notes: input.internalNotes,
    subtotal: asDecimalString(input.subtotal),
  };
}

function lineItemPatch(input: Omit<z.infer<typeof lineItemUpdateInput>, "id">) {
  return {
    project_id: input.projectId,
    room_id: input.roomId ?? null,
    description: input.description,
    category: input.category,
    scope: input.scope,
    quantity: input.quantity === undefined ? undefined : input.quantity.toFixed(2),
    unit: input.unit,
    rate: input.rate === undefined ? undefined : input.rate.toFixed(2),
    subtotal: input.subtotal === undefined ? undefined : input.subtotal.toFixed(2),
    sort_order: input.sortOrder,
    is_internal: input.isInternal,
  };
}

function recalcMockRoom(roomId: number) {
  const subtotal = mockLineItems
    .filter((item) => item.roomId === roomId)
    .reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const room = mockRooms.find((entry) => entry.id === roomId);
  if (room) {
    room.subtotal = subtotal.toFixed(2);
    room.updatedAt = new Date();
  }
  return subtotal;
}

function recalcMockProject(projectId: number) {
  const project = mockProjects.find((entry) => entry.id === projectId);
  if (!project) return 0;

  const subtotal = mockLineItems
    .filter((item) => item.projectId === projectId && !item.isInternal)
    .reduce((sum, item) => sum + Number(item.subtotal || 0), 0);

  const taxRate = Number(project.taxRate || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const discountAmount = Number(project.discountAmount || 0);
  const total = subtotal + taxAmount - discountAmount;
  const depositPercent = project.depositPercent || 50;

  project.subtotal = subtotal.toFixed(2);
  project.taxAmount = taxAmount.toFixed(2);
  project.total = total.toFixed(2);
  project.depositAmount = (total * (depositPercent / 100)).toFixed(2);
  project.updatedAt = new Date();

  return subtotal;
}

async function recalcSupabaseRoom(roomId: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("line_items")
    .select("subtotal")
    .eq("room_id", roomId);

  assertSupabaseSuccess(error, "Unable to recalculate room");
  const roomSubtotal = (data ?? []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const { error: updateError } = await supabase
    .from("rooms")
    .update({ subtotal: roomSubtotal.toFixed(2) })
    .eq("id", roomId);

  assertSupabaseSuccess(updateError, "Unable to update room subtotal");
  return roomSubtotal;
}

async function recalcSupabaseProject(projectId: number, userId: string) {
  const project = await requireOwnedProject(projectId, userId);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("line_items")
    .select("subtotal,is_internal")
    .eq("project_id", projectId);

  assertSupabaseSuccess(error, "Unable to recalculate project");
  const subtotal = (data ?? [])
    .filter((item) => !item.is_internal)
    .reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const taxRate = Number(project.tax_rate || 0);
  const discountAmount = Number(project.discount_amount || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discountAmount;
  const depositPercent = Number(project.deposit_percent || 50);

  const patch = {
    subtotal: subtotal.toFixed(2),
    tax_amount: taxAmount.toFixed(2),
    total: total.toFixed(2),
    deposit_amount: (total * (depositPercent / 100)).toFixed(2),
  };
  if (!isUuidLike(userId)) {
    const fallbackUpdate = await supabase
      .from("projects")
      .update(patch)
      .eq("id", projectId);
    assertSupabaseSuccess(fallbackUpdate.error, "Unable to update project subtotal");
    return subtotal;
  }

  const scopedUpdate = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .eq("user_id", userId);

  if (isProjectsUserIdMissingError(scopedUpdate.error)) {
    const fallbackUpdate = await supabase
      .from("projects")
      .update(patch)
      .eq("id", projectId);
    assertSupabaseSuccess(fallbackUpdate.error, "Unable to update project subtotal");
    return subtotal;
  }

  assertSupabaseSuccess(scopedUpdate.error, "Unable to update project subtotal");
  return subtotal;
}

export const projectsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    if (env.useMockData) {
      return mockProjects
        .filter((project) => project.userId === ctx.user.id)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    const supabase = getSupabaseAdmin();
    if (!isUuidLike(ctx.user.id)) {
      const fallback = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      assertSupabaseSuccess(fallback.error, "Unable to list projects");
      return (fallback.data ?? []).map(mapProjectRow);
    }

    const scoped = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("updated_at", { ascending: false });

    if (isProjectsUserIdMissingError(scoped.error)) {
      const fallback = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      assertSupabaseSuccess(fallback.error, "Unable to list projects");
      return (fallback.data ?? []).map(mapProjectRow);
    }

    assertSupabaseSuccess(scoped.error, "Unable to list projects");
    return (scoped.data ?? []).map(mapProjectRow);
  }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (env.useMockData) {
        return (
          mockProjects.find((project) => project.id === input.id && project.userId === ctx.user.id) ??
          null
        );
      }

      const project = await requireOwnedProject(input.id, ctx.user.id);
      return mapProjectRow(project);
    }),

  create: authedQuery
    .input(
      z.object({
        customerName: z.string().min(1),
        customerPhone: z.string().optional(),
        customerEmail: z.string().email().optional().or(z.literal("")),
        propertyAddress: z.string().min(1),
        propertyType: z.string().optional(),
        projectType: z.string().optional(),
        notes: z.string().optional(),
        leadSource: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const { projectId } = nextIds();
        mockProjects.unshift({
          id: projectId,
          userId: ctx.user.id,
          estimateNumber: makeEstimateNumber(),
          status: "draft",
          customerName: input.customerName,
          customerPhone: input.customerPhone || null,
          customerEmail: input.customerEmail || null,
          propertyAddress: input.propertyAddress,
          propertyType: input.propertyType || null,
          projectType: input.projectType || null,
          notes: input.notes || null,
          internalNotes: null,
          leadSource: input.leadSource || null,
          tags: input.tags || [],
          crmContactId: null,
          crmOpportunityId: null,
          crmEstimateId: null,
          crmSyncStatus: "not_needed",
          subtotal: "0.00",
          taxRate: "0.00",
          taxAmount: "0.00",
          discountAmount: "0.00",
          total: "0.00",
          depositPercent: 50,
          depositAmount: "0.00",
          customerSignedAt: null,
          customerSignatureName: null,
          estimatorSignedAt: null,
          estimatorSignatureName: null,
          unsignedPdfUrl: null,
          signedPdfUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { id: projectId };
      }

      const supabase = getSupabaseAdmin();
      const payload = {
        user_id: ctx.user.id,
        estimate_number: generateEstimateNumber(),
        customer_name: input.customerName,
        customer_phone: input.customerPhone || null,
        customer_email: input.customerEmail || null,
        property_address: input.propertyAddress,
        property_type: input.propertyType || null,
        project_type: input.projectType || null,
        notes: input.notes || null,
        lead_source: input.leadSource || null,
        tags: input.tags || [],
        status: "draft",
      };
      let result = await supabase
        .from("projects")
        .insert(isUuidLike(ctx.user.id) ? payload : (({ user_id, ...rest }) => rest)(payload))
        .select("id")
        .single();

      if (isProjectsUserIdMissingError(result.error)) {
        const { user_id, ...fallbackPayload } = payload;
        result = await supabase
          .from("projects")
          .insert(fallbackPayload)
          .select("id")
          .single();
      }

      assertSupabaseSuccess(result.error, "Unable to create project");
      return { id: Number(result.data?.id ?? 0) };
    }),

  update: authedQuery
    .input(projectUpdateInput)
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const project = mockProjects.find((entry) => entry.id === input.id && entry.userId === ctx.user.id);
        if (!project) return { success: false };

        Object.assign(project, {
          ...input,
          subtotal: asDecimalString(input.subtotal) ?? project.subtotal,
          taxRate: asDecimalString(input.taxRate) ?? project.taxRate,
          taxAmount: asDecimalString(input.taxAmount) ?? project.taxAmount,
          discountAmount: asDecimalString(input.discountAmount) ?? project.discountAmount,
          total: asDecimalString(input.total) ?? project.total,
          depositAmount: asDecimalString(input.depositAmount) ?? project.depositAmount,
          updatedAt: new Date(),
        });
        return { success: true };
      }

      await requireOwnedProject(input.id, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const { id, ...updates } = input;
      if (!isUuidLike(ctx.user.id)) {
        const fallback = await supabase
          .from("projects")
          .update(projectPatch(updates))
          .eq("id", id);
        assertSupabaseSuccess(fallback.error, "Unable to update project");
        return { success: true };
      }

      const scoped = await supabase
        .from("projects")
        .update(projectPatch(updates))
        .eq("id", id)
        .eq("user_id", ctx.user.id);

      if (isProjectsUserIdMissingError(scoped.error)) {
        const fallback = await supabase
          .from("projects")
          .update(projectPatch(updates))
          .eq("id", id);
        assertSupabaseSuccess(fallback.error, "Unable to update project");
        return { success: true };
      }

      assertSupabaseSuccess(scoped.error, "Unable to update project");
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const projectIndex = mockProjects.findIndex((project) => project.id === input.id && project.userId === ctx.user.id);
        if (projectIndex >= 0) {
          mockProjects.splice(projectIndex, 1);
        }
        for (let i = mockRooms.length - 1; i >= 0; i -= 1) {
          if (mockRooms[i].projectId === input.id) mockRooms.splice(i, 1);
        }
        for (let i = mockLineItems.length - 1; i >= 0; i -= 1) {
          if (mockLineItems[i].projectId === input.id) mockLineItems.splice(i, 1);
        }
        return { success: true };
      }

      await requireOwnedProject(input.id, ctx.user.id);
      const supabase = getSupabaseAdmin();
      if (!isUuidLike(ctx.user.id)) {
        const fallback = await supabase.from("projects").delete().eq("id", input.id);
        assertSupabaseSuccess(fallback.error, "Unable to delete project");
        return { success: true };
      }

      const scoped = await supabase.from("projects").delete().eq("id", input.id).eq("user_id", ctx.user.id);
      if (isProjectsUserIdMissingError(scoped.error)) {
        const fallback = await supabase.from("projects").delete().eq("id", input.id);
        assertSupabaseSuccess(fallback.error, "Unable to delete project");
        return { success: true };
      }
      assertSupabaseSuccess(scoped.error, "Unable to delete project");
      return { success: true };
    }),

  duplicate: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const original = mockProjects.find((project) => project.id === input.id && project.userId === ctx.user.id);
        if (!original) return { id: 0 };

        const { projectId } = nextIds();
        mockProjects.unshift({
          ...original,
          id: projectId,
          estimateNumber: makeEstimateNumber(),
          status: "draft",
          customerSignedAt: null,
          customerSignatureName: null,
          estimatorSignedAt: null,
          estimatorSignatureName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { id: projectId };
      }

      const original = await requireOwnedProject(input.id, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const payload = {
        user_id: ctx.user.id,
        estimate_number: generateEstimateNumber(),
        status: "draft",
        customer_name: original.customer_name,
        customer_phone: original.customer_phone,
        customer_email: original.customer_email,
        property_address: original.property_address,
        property_type: original.property_type,
        project_type: original.project_type,
        notes: original.notes,
        internal_notes: original.internal_notes,
        lead_source: original.lead_source,
        tags: original.tags,
      };
      let result = await supabase
        .from("projects")
        .insert(isUuidLike(ctx.user.id) ? payload : (({ user_id, ...rest }) => rest)(payload))
        .select("id")
        .single();

      if (isProjectsUserIdMissingError(result.error)) {
        const { user_id, ...fallbackPayload } = payload;
        result = await supabase
          .from("projects")
          .insert(fallbackPayload)
          .select("id")
          .single();
      }

      assertSupabaseSuccess(result.error, "Unable to duplicate project");
      return { id: Number(result.data?.id ?? 0) };
    }),
});

export const roomsRouter = createRouter({
  list: authedQuery
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (env.useMockData) {
        return mockRooms
          .filter((room) => room.projectId === input.projectId)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }

      await requireOwnedProject(input.projectId, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("project_id", input.projectId)
        .order("sort_order", { ascending: true });

      assertSupabaseSuccess(error, "Unable to list rooms");
      return (data ?? []).map(mapRoomRow);
    }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (env.useMockData) {
        return mockRooms.find((room) => room.id === input.id) ?? null;
      }

      const room = await requireOwnedRoom(input.id, ctx.user.id);
      return mapRoomRow(room);
    }),

  create: authedQuery
    .input(roomInput)
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const { roomId } = nextIds();
        mockRooms.push({
          id: roomId,
          projectId: input.projectId,
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
          length: asDecimalString(input.length) ?? null,
          width: asDecimalString(input.width) ?? null,
          height: asDecimalString(input.height) ?? null,
          wallSqFt: asDecimalString(input.wallSqFt) ?? null,
          ceilingSqFt: asDecimalString(input.ceilingSqFt) ?? null,
          totalSqFt: asDecimalString(input.totalSqFt) ?? null,
          doorCount: input.doorCount ?? 0,
          windowCount: input.windowCount ?? 0,
          trimLinearFt: asDecimalString(input.trimLinearFt) ?? null,
          baseboardLinearFt: asDecimalString(input.baseboardLinearFt) ?? null,
          hasDrywallRepair: input.hasDrywallRepair || [],
          paintScope: input.paintScope || [],
          textureScope: input.textureScope || [],
          prepComplexity: input.prepComplexity || "standard",
          repairComplexity: input.repairComplexity || "none",
          paintBrand: input.paintBrand || null,
          paintColor: input.paintColor || null,
          paintColorCode: input.paintColorCode || null,
          finishType: input.finishType || null,
          productLine: input.productLine || null,
          coats: input.coats ?? 2,
          photos: input.photos || [],
          aiVisualizationUrl: input.aiVisualizationUrl || null,
          notes: input.notes || null,
          internalNotes: input.internalNotes || null,
          subtotal: "0.00",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { id: roomId };
      }

      await requireOwnedProject(input.projectId, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("rooms")
        .insert({
          project_id: input.projectId,
          name: input.name,
          sort_order: input.sortOrder ?? 0,
          length: asDecimalString(input.length) ?? null,
          width: asDecimalString(input.width) ?? null,
          height: asDecimalString(input.height) ?? null,
          wall_sq_ft: asDecimalString(input.wallSqFt) ?? null,
          ceiling_sq_ft: asDecimalString(input.ceilingSqFt) ?? null,
          total_sq_ft: asDecimalString(input.totalSqFt) ?? null,
          door_count: input.doorCount ?? 0,
          window_count: input.windowCount ?? 0,
          trim_linear_ft: asDecimalString(input.trimLinearFt) ?? null,
          baseboard_linear_ft: asDecimalString(input.baseboardLinearFt) ?? null,
          has_drywall_repair: input.hasDrywallRepair || [],
          paint_scope: input.paintScope || [],
          texture_scope: input.textureScope || [],
          prep_complexity: input.prepComplexity || "standard",
          repair_complexity: input.repairComplexity || "none",
          paint_brand: input.paintBrand || null,
          paint_color: input.paintColor || null,
          paint_color_code: input.paintColorCode || null,
          finish_type: input.finishType || null,
          product_line: input.productLine || null,
          coats: input.coats ?? 2,
          photos: input.photos || [],
          ai_visualization_url: input.aiVisualizationUrl || null,
          notes: input.notes || null,
          internal_notes: input.internalNotes || null,
        })
        .select("id")
        .single();

      assertSupabaseSuccess(error, "Unable to create room");
      return { id: Number(data?.id ?? 0) };
    }),

  update: authedQuery
    .input(roomUpdateInput)
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const room = mockRooms.find((entry) => entry.id === input.id);
        if (!room) return { success: false };

        Object.assign(room, {
          ...input,
          length: asDecimalString(input.length) ?? room.length,
          width: asDecimalString(input.width) ?? room.width,
          height: asDecimalString(input.height) ?? room.height,
          wallSqFt: asDecimalString(input.wallSqFt) ?? room.wallSqFt,
          ceilingSqFt: asDecimalString(input.ceilingSqFt) ?? room.ceilingSqFt,
          totalSqFt: asDecimalString(input.totalSqFt) ?? room.totalSqFt,
          trimLinearFt: asDecimalString(input.trimLinearFt) ?? room.trimLinearFt,
          baseboardLinearFt: asDecimalString(input.baseboardLinearFt) ?? room.baseboardLinearFt,
          subtotal: asDecimalString(input.subtotal) ?? room.subtotal,
          updatedAt: new Date(),
        });
        return { success: true };
      }

      await requireOwnedRoom(input.id, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const { id, ...updates } = input;
      const { error } = await supabase.from("rooms").update(roomPatch(updates)).eq("id", id);
      assertSupabaseSuccess(error, "Unable to update room");
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const index = mockRooms.findIndex((room) => room.id === input.id);
        if (index >= 0) mockRooms.splice(index, 1);
        for (let i = mockLineItems.length - 1; i >= 0; i -= 1) {
          if (mockLineItems[i].roomId === input.id) mockLineItems.splice(i, 1);
        }
        return { success: true };
      }

      await requireOwnedRoom(input.id, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("rooms").delete().eq("id", input.id);
      assertSupabaseSuccess(error, "Unable to delete room");
      return { success: true };
    }),
});

export const lineItemsRouter = createRouter({
  list: authedQuery
    .input(z.object({ projectId: z.number(), roomId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (env.useMockData) {
        return mockLineItems
          .filter((item) => item.projectId === input.projectId && (!input.roomId || item.roomId === input.roomId))
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }

      await requireOwnedProject(input.projectId, ctx.user.id);
      const supabase = getSupabaseAdmin();
      let query = supabase
        .from("line_items")
        .select("*")
        .eq("project_id", input.projectId)
        .order("sort_order", { ascending: true });

      if (input.roomId) {
        query = query.eq("room_id", input.roomId);
      }

      const { data, error } = await query;
      assertSupabaseSuccess(error, "Unable to list line items");
      return (data ?? []).map(mapLineItemRow);
    }),

  create: authedQuery
    .input(lineItemInput)
    .mutation(async ({ ctx, input }) => {
      const qty = input.quantity;
      const rate = input.rate;
      const calcSubtotal = input.subtotal ?? qty * rate;

      if (env.useMockData) {
        const { lineItemId } = nextIds();
        mockLineItems.push({
          id: lineItemId,
          projectId: input.projectId,
          roomId: input.roomId ?? null,
          description: input.description,
          category: input.category || null,
          scope: input.scope || null,
          quantity: qty.toFixed(2),
          unit: input.unit,
          rate: rate.toFixed(2),
          subtotal: calcSubtotal.toFixed(2),
          sortOrder: input.sortOrder ?? 0,
          isInternal: input.isInternal ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        if (input.roomId) recalcMockRoom(input.roomId);
        recalcMockProject(input.projectId);
        return { id: lineItemId };
      }

      await requireOwnedProject(input.projectId, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("line_items")
        .insert({
          project_id: input.projectId,
          room_id: input.roomId ?? null,
          description: input.description,
          category: input.category || null,
          scope: input.scope || null,
          quantity: qty.toFixed(2),
          unit: input.unit,
          rate: rate.toFixed(2),
          subtotal: calcSubtotal.toFixed(2),
          sort_order: input.sortOrder ?? 0,
          is_internal: input.isInternal ?? 0,
        })
        .select("id")
        .single();

      assertSupabaseSuccess(error, "Unable to create line item");
      if (input.roomId) await recalcSupabaseRoom(input.roomId);
      await recalcSupabaseProject(input.projectId, ctx.user.id);
      return { id: Number(data?.id ?? 0) };
    }),

  update: authedQuery
    .input(lineItemUpdateInput)
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const item = mockLineItems.find((entry) => entry.id === input.id);
        if (!item) return { success: false };

        const quantity = input.quantity ?? Number(item.quantity || 0);
        const rate = input.rate ?? Number(item.rate || 0);
        const subtotal = input.subtotal ?? quantity * rate;

        Object.assign(item, {
          ...input,
          quantity: input.quantity === undefined ? item.quantity : quantity.toFixed(2),
          rate: input.rate === undefined ? item.rate : rate.toFixed(2),
          subtotal: subtotal.toFixed(2),
          updatedAt: new Date(),
        });

        if (item.roomId) recalcMockRoom(item.roomId);
        recalcMockProject(item.projectId);
        return { success: true };
      }

      const existing = await requireOwnedLineItem(input.id, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const quantity = input.quantity ?? Number(existing.quantity || 0);
      const rate = input.rate ?? Number(existing.rate || 0);
      const subtotal = input.subtotal ?? quantity * rate;
      const { id, ...updates } = input;
      const { error } = await supabase
        .from("line_items")
        .update({
          ...lineItemPatch({
            ...updates,
            subtotal,
          }),
          quantity: quantity.toFixed(2),
          rate: rate.toFixed(2),
          subtotal: subtotal.toFixed(2),
        })
        .eq("id", id);

      assertSupabaseSuccess(error, "Unable to update line item");
      if (existing.room_id) await recalcSupabaseRoom(Number(existing.room_id));
      if (input.roomId && input.roomId !== Number(existing.room_id || 0)) {
        await recalcSupabaseRoom(input.roomId);
      }
      await recalcSupabaseProject(Number(existing.project_id), ctx.user.id);
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        const index = mockLineItems.findIndex((item) => item.id === input.id);
        if (index >= 0) {
          const [removed] = mockLineItems.splice(index, 1);
          if (removed.roomId) recalcMockRoom(removed.roomId);
          recalcMockProject(removed.projectId);
        }
        return { success: true };
      }

      const existing = await requireOwnedLineItem(input.id, ctx.user.id);
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("line_items").delete().eq("id", input.id);
      assertSupabaseSuccess(error, "Unable to delete line item");
      if (existing.room_id) await recalcSupabaseRoom(Number(existing.room_id));
      await recalcSupabaseProject(Number(existing.project_id), ctx.user.id);
      return { success: true };
    }),

  recalcRoom: authedQuery
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        return { subtotal: recalcMockRoom(input.roomId) };
      }

      await requireOwnedRoom(input.roomId, ctx.user.id);
      return { subtotal: await recalcSupabaseRoom(input.roomId) };
    }),

  recalcProject: authedQuery
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (env.useMockData) {
        return { subtotal: recalcMockProject(input.projectId) };
      }

      return { subtotal: await recalcSupabaseProject(input.projectId, ctx.user.id) };
    }),
});
