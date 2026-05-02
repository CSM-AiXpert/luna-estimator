import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { env } from "./lib/env";
import { extractGhlEntityId, ghlRequest, isGhlConfigured, resolveGhlPipelineConfig, splitName } from "./lib/ghl";
import { getSupabaseAdmin } from "./lib/supabase-admin";
import { assertSupabaseSuccess, isUuidLike, requireOwnedProject } from "./lib/supabase-db";
import { mockLineItems, mockMedia, mockProjects, mockRooms } from "./mock-data";

const syncProjectInput = z.object({
  projectId: z.number(),
});

function normalizeServiceName({
  description,
  scope,
  projectType,
}: {
  description?: string | null;
  scope?: string | null;
  projectType?: string | null;
}) {
  const haystack = `${description || ""} ${scope || ""} ${projectType || ""}`.toLowerCase();
  if (haystack.includes("exterior")) return "Exterior Paint";
  if (haystack.includes("popcorn")) return "Popcorn Ceiling Removal";
  if (haystack.includes("drywall")) return "Drywall Repair";
  if (haystack.includes("texture")) return "Texture Work";
  if (haystack.includes("cabinet")) return "Cabinet Paint";
  if (haystack.includes("trim") || haystack.includes("baseboard") || haystack.includes("crown") || haystack.includes("door") || haystack.includes("window")) {
    return "Trim Paint";
  }
  return "Interior Paint";
}

function formatMoney(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

function buildEstimateLines({
  projectType,
  items,
  roomRecords,
}: {
  projectType?: string | null;
  items: Array<{
    id: number;
    roomId: number | null;
    description: string;
    scope: string | null;
    quantity: string | null;
    unit: string | null;
    subtotal: string | null;
  }>;
  roomRecords: Array<{ id: number; name: string }>;
}) {
  return items.map((item) => {
    const roomName = roomRecords.find((room) => room.id === item.roomId)?.name;
    const service = normalizeServiceName({
      description: item.description,
      scope: item.scope,
      projectType,
    });

    return {
      id: item.id,
      service,
      description: roomName ? `${service} - ${roomName}` : service,
      detail: item.description,
      quantity: Number(item.quantity || 1),
      unit: item.unit || "ea",
      amount: Number(item.subtotal || 0),
    };
  });
}

function buildEstimateNote({
  project,
  estimateLines,
  unsignedPdfUrl,
  signedPdfUrl,
}: {
  project: {
    estimateNumber: string;
    propertyAddress: string;
    projectType: string | null;
    subtotal: string | null;
    total: string | null;
    depositAmount: string | null;
    status: string;
  };
  estimateLines: Array<{
    service: string;
    description: string;
    detail: string;
    quantity: number;
    unit: string;
    amount: number;
  }>;
  unsignedPdfUrl?: string | null;
  signedPdfUrl?: string | null;
}) {
  const lineSummary = estimateLines
    .map((line, index) => `${index + 1}. ${line.service} | ${line.detail} | ${line.quantity} ${line.unit} | $${line.amount.toFixed(2)}`)
    .join("\n");

  return [
    `Luna Estimator Sync`,
    `Estimate: ${project.estimateNumber}`,
    `Project Type: ${project.projectType || "Unspecified"}`,
    `Address: ${project.propertyAddress}`,
    `Status: ${project.status}`,
    "",
    "Estimate Items",
    lineSummary,
    "",
    `Subtotal: $${formatMoney(project.subtotal)}`,
    `Total: $${formatMoney(project.total)}`,
    `Deposit Target: $${formatMoney(project.depositAmount)}`,
    ...(unsignedPdfUrl ? [`Unsigned PDF: ${unsignedPdfUrl}`] : []),
    ...(signedPdfUrl ? [`Signed PDF: ${signedPdfUrl}`] : []),
  ].join("\n");
}

export const syncRouter = createRouter({
  projectToGhl: authedQuery.input(syncProjectInput).mutation(async ({ ctx, input }) => {
    const warnings: string[] = [];
    if (!isGhlConfigured()) {
      throw new Error("GoHighLevel is not configured. Add GHL_API_KEY and GHL_LOCATION_ID to .env.");
    }

    const data = env.useMockData
      ? {
          project: mockProjects.find((entry) => entry.id === input.projectId && entry.userId === ctx.user.id) || null,
          rooms: mockRooms.filter((entry) => entry.projectId === input.projectId),
          lineItems: mockLineItems.filter((entry) => entry.projectId === input.projectId && !entry.isInternal),
          media: mockMedia.filter((entry) => entry.projectId === input.projectId),
        }
      : await (async () => {
          const supabase = getSupabaseAdmin();
          const project = await requireOwnedProject(input.projectId, ctx.user.id);
          const [{ data: roomRows, error: roomError }, { data: itemRows, error: itemError }, { data: mediaRows, error: mediaError }] =
            await Promise.all([
              supabase.from("rooms").select("*").eq("project_id", input.projectId),
              supabase.from("line_items").select("*").eq("project_id", input.projectId),
              supabase.from("media").select("*").eq("project_id", input.projectId),
            ]);

          assertSupabaseSuccess(roomError, "Unable to load rooms for sync");
          assertSupabaseSuccess(itemError, "Unable to load line items for sync");
          assertSupabaseSuccess(mediaError, "Unable to load media for sync");

          return {
            project,
            rooms: (roomRows ?? []).map((entry) => ({
              id: Number(entry.id),
              name: entry.name,
            })),
            lineItems: (itemRows ?? [])
              .filter((entry) => !entry.is_internal)
              .map((entry) => ({
                id: Number(entry.id),
                roomId: entry.room_id === null ? null : Number(entry.room_id),
                description: entry.description,
                scope: entry.scope,
                quantity: entry.quantity,
                unit: entry.unit,
                subtotal: entry.subtotal,
              })),
            media: mediaRows ?? [],
          };
        })();

    if (!data.project) {
      throw new Error("Project not found.");
    }

    const project = env.useMockData
      ? data.project
      : {
          id: Number(data.project.id),
          estimateNumber: data.project.estimate_number,
          customerName: data.project.customer_name,
          customerEmail: data.project.customer_email,
          customerPhone: data.project.customer_phone,
          propertyAddress: data.project.property_address,
          projectType: data.project.project_type,
          leadSource: data.project.lead_source,
          subtotal: data.project.subtotal,
          total: data.project.total,
          depositAmount: data.project.deposit_amount,
          status: data.project.status,
          crmEstimateId: data.project.crm_estimate_id,
          crmOpportunityId: data.project.crm_opportunity_id,
          createdAt: new Date(data.project.created_at),
          unsignedPdfUrl: data.project.unsigned_pdf_url,
          signedPdfUrl: data.project.signed_pdf_url,
        };

    const unsignedPdfUrl =
      data.media.find((item) => item.category === "unsigned-pdf")?.url || project.unsignedPdfUrl;
    const signedPdfUrl =
      data.media.find((item) => item.category === "signed-pdf")?.url || project.signedPdfUrl;
    const estimateLines = buildEstimateLines({
      projectType: project.projectType,
      items: data.lineItems,
      roomRecords: data.rooms,
    });

    const { firstName, lastName } = splitName(project.customerName);
    const contactPayload = await ghlRequest<Record<string, unknown>>({
      path: "/contacts/upsert",
      method: "POST",
      body: {
        locationId: env.ghlLocationId,
        firstName,
        lastName,
        name: project.customerName,
        email: project.customerEmail || undefined,
        phone: project.customerPhone || undefined,
        address1: project.propertyAddress,
        source: project.leadSource || "Luna Drywall & Paint",
        tags: ["luna-drywall-paint", project.projectType || "estimate"].filter(Boolean),
      },
    });

    const contactId = extractGhlEntityId(contactPayload, ["contact"]);

    if (!contactId) {
      throw new Error("GoHighLevel did not return a contact id.");
    }

    const notePayload = await ghlRequest<Record<string, unknown>>({
      path: `/contacts/${contactId}/notes`,
      method: "POST",
      body: {
        body: buildEstimateNote({
          project,
          estimateLines,
          unsignedPdfUrl,
          signedPdfUrl,
        }),
      },
    });
    const noteId = extractGhlEntityId(notePayload, ["note"]);

    let estimateId = project.crmEstimateId || "";
    try {
      const estimatePayload = await ghlRequest<Record<string, unknown>>({
        path: project.crmEstimateId ? `/invoices/estimate/${project.crmEstimateId}` : "/invoices/estimate",
        method: project.crmEstimateId ? "PUT" : "POST",
        body: {
          locationId: env.ghlLocationId,
          contactId,
          title: `${project.customerName} - ${project.projectType || "Estimate"}`,
          estimateNumber: project.estimateNumber,
          issueDate: new Date(project.createdAt || new Date()).toISOString(),
          subtotal: Number(project.subtotal || 0),
          total: Number(project.total || 0),
          items: estimateLines.map((line) => ({
            name: line.service,
            description: line.detail,
            quantity: line.quantity,
            unit: line.unit,
            price: Number((line.amount / Math.max(line.quantity, 1)).toFixed(2)),
            total: Number(line.amount.toFixed(2)),
          })),
        },
      });

      estimateId = extractGhlEntityId(estimatePayload, ["estimate"]) || estimateId;

      if (estimateId && project.status === "signed") {
        try {
          await ghlRequest({
            path: `/invoices/estimate/${estimateId}/invoice`,
            method: "POST",
          });
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : "Signed estimate synced, but invoice creation failed.");
        }
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "GoHighLevel estimate creation failed.");
    }

    let opportunityId = project.crmOpportunityId || "";
    try {
      const pipelineConfig = await resolveGhlPipelineConfig(project.status);
      if (pipelineConfig.pipelineId && pipelineConfig.stageId) {
        const opportunityPayload = await ghlRequest<Record<string, unknown>>({
          path: "/opportunities/upsert",
          method: "POST",
          body: {
            locationId: env.ghlLocationId,
            contactId,
            name: `${project.customerName} - ${project.projectType || "Estimate"}`,
            pipelineId: pipelineConfig.pipelineId,
            pipelineStageId: pipelineConfig.stageId,
            status: "open",
            monetaryValue: Number(project.total || 0),
            source: "Luna Drywall & Paint",
          },
        });

        opportunityId = extractGhlEntityId(opportunityPayload, ["opportunity"]) || "";
        if (pipelineConfig.stageSource === "discovered") {
          warnings.push("GoHighLevel pipeline stages were auto-discovered because no stage ids are configured in .env.");
        }
      } else {
        warnings.push("GoHighLevel opportunity sync was skipped because no pipeline stages were available for this location.");
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "GoHighLevel opportunity sync failed.");
    }

    const crmSyncStatus =
      contactId && (estimateId || opportunityId)
        ? "synced"
        : contactId || noteId
          ? "partial"
          : "failed";

    const updates = {
      crmContactId: contactId,
      crmOpportunityId: opportunityId || undefined,
      crmEstimateId: estimateId || undefined,
      crmSyncStatus,
    };

    if (env.useMockData) {
      Object.assign(project, updates, {
        updatedAt: new Date(),
      });
    } else {
      const supabase = getSupabaseAdmin();
      const patch = {
        crm_contact_id: updates.crmContactId,
        crm_opportunity_id: updates.crmOpportunityId,
        crm_estimate_id: updates.crmEstimateId,
        crm_sync_status: updates.crmSyncStatus,
      };
      const { error } = await (isUuidLike(ctx.user.id)
        ? supabase
            .from("projects")
            .update(patch)
            .eq("id", project.id)
            .eq("user_id", ctx.user.id)
        : supabase
            .from("projects")
            .update(patch)
            .eq("id", project.id));

      assertSupabaseSuccess(error, "Unable to save sync metadata");
    }

    return {
      success: true,
      contactId,
      opportunityId: opportunityId || null,
      noteId: noteId || null,
      estimateLines,
      warnings,
    };
  }),
});
