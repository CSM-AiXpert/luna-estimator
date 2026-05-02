import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { env } from "./lib/env";
import { uploadBufferToSupabase } from "./lib/supabase-admin";
import {
  assertSupabaseSuccess,
  isUuidLike,
  isProjectsUserIdMissingError,
  mapMediaRow,
  requireOwnedProject,
  requireOwnedRoom,
} from "./lib/supabase-db";
import { getSupabaseAdmin } from "./lib/supabase-admin";
import { mockMedia, mockProjects, mockRooms, nextIds } from "./mock-data";

const mediaListInput = z.object({
  projectId: z.number(),
  roomId: z.number().optional(),
  category: z.string().optional(),
});

const mediaUploadInput = z.object({
  projectId: z.number(),
  roomId: z.number().optional(),
  fileName: z.string().min(1),
  contentType: z.string().default("application/octet-stream"),
  dataUrl: z.string().optional(),
  textContent: z.string().optional(),
  category: z.string().default("general"),
  caption: z.string().optional(),
  includeOnPdf: z.boolean().optional(),
  isInternal: z.boolean().optional(),
});

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function dataUrlToBuffer(dataUrl: string) {
  const [meta, base64Data] = dataUrl.split(",");
  if (!meta || !base64Data) {
    throw new Error("Invalid file payload.");
  }

  return Buffer.from(base64Data, "base64");
}

async function storeUpload(input: z.infer<typeof mediaUploadInput>) {
  const safeName = sanitizeFileName(input.fileName);
  const objectPath = [
    "projects",
    String(input.projectId),
    input.roomId ? `rooms/${input.roomId}` : "project",
    `${Date.now()}-${safeName}`,
  ].join("/");

  const buffer = input.dataUrl
    ? dataUrlToBuffer(input.dataUrl)
    : Buffer.from(input.textContent || "", "utf8");

  return uploadBufferToSupabase({
    objectPath,
    contentType: input.contentType,
    buffer,
  });
}

function appendRoomPhoto(roomId: number | undefined, url: string, category: string) {
  if (!roomId) return;

  const room = mockRooms.find((entry) => entry.id === roomId);
  if (!room) return;

  if (["room-photo", "ai-generated", "customer-signature", "estimator-signature"].includes(category)) {
    room.photos = Array.from(new Set([...(room.photos || []), url]));
  }
  if (category === "ai-generated") {
    room.aiVisualizationUrl = url;
  }
  room.updatedAt = new Date();
}

function applyProjectArtifact(projectId: number, url: string, category: string) {
  const project = mockProjects.find((entry) => entry.id === projectId);
  if (!project) return;

  if (category === "unsigned-pdf") project.unsignedPdfUrl = url;
  if (category === "signed-pdf") project.signedPdfUrl = url;
  project.updatedAt = new Date();
}

export const mediaRouter = createRouter({
  list: authedQuery.input(mediaListInput).query(async ({ ctx, input }) => {
    if (env.useMockData) {
      return mockMedia
        .filter((item) => item.projectId === input.projectId)
        .filter((item) => (input.roomId ? item.roomId === input.roomId : true))
        .filter((item) => (input.category ? item.category === input.category : true))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    await requireOwnedProject(input.projectId, ctx.user.id);
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("media")
      .select("*")
      .eq("project_id", input.projectId)
      .order("created_at", { ascending: false });

    if (input.roomId) {
      query = query.eq("room_id", input.roomId);
    }
    if (input.category) {
      query = query.eq("category", input.category);
    }

    const { data, error } = await query;
    assertSupabaseSuccess(error, "Unable to list media");
    return (data ?? []).map(mapMediaRow);
  }),

  upload: authedQuery.input(mediaUploadInput).mutation(async ({ ctx, input }) => {
    if (env.useMockData) {
      const stored = await storeUpload(input);
      const { mediaId } = nextIds();
      mockMedia.unshift({
        id: mediaId,
        projectId: input.projectId,
        roomId: input.roomId ?? null,
        url: stored.url,
        caption: input.caption || null,
        category: input.category,
        includeOnPdf: input.includeOnPdf === false ? 0 : 1,
        isInternal: input.isInternal ? 1 : 0,
        sortOrder: 0,
        createdAt: new Date(),
      });
      appendRoomPhoto(input.roomId, stored.url, input.category);
      applyProjectArtifact(input.projectId, stored.url, input.category);
      return {
        id: mediaId,
        url: stored.url,
        path: stored.path,
      };
    }

    await requireOwnedProject(input.projectId, ctx.user.id);
    if (input.roomId) {
      const room = await requireOwnedRoom(input.roomId, ctx.user.id);
      if (Number(room.project_id) !== input.projectId) {
        throw new Error("Room does not belong to that project.");
      }
    }

    const stored = await storeUpload(input);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("media")
      .insert({
        project_id: input.projectId,
        room_id: input.roomId ?? null,
        url: stored.url,
        caption: input.caption || null,
        category: input.category,
        include_on_pdf: input.includeOnPdf === false ? 0 : 1,
        is_internal: input.isInternal ? 1 : 0,
        sort_order: 0,
      })
      .select("id")
      .single();

    assertSupabaseSuccess(error, "Unable to create media record");

    if (input.roomId && ["room-photo", "ai-generated"].includes(input.category)) {
      const room = await requireOwnedRoom(input.roomId, ctx.user.id);
      const nextPhotos = Array.from(new Set([...(room.photos || []), stored.url]));
      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          photos: nextPhotos,
          ai_visualization_url: input.category === "ai-generated" ? stored.url : room.ai_visualization_url,
        })
        .eq("id", input.roomId);

      assertSupabaseSuccess(roomError, "Unable to update room media");
    }

    if (input.category === "unsigned-pdf" || input.category === "signed-pdf") {
      const patch =
        input.category === "unsigned-pdf"
          ? { unsigned_pdf_url: stored.url }
          : { signed_pdf_url: stored.url };
      if (!isUuidLike(ctx.user.id)) {
        const fallback = await supabase
          .from("projects")
          .update(patch)
          .eq("id", input.projectId);
        assertSupabaseSuccess(fallback.error, "Unable to update project artifact");
        return {
          id: Number(data?.id ?? 0),
          url: stored.url,
          path: stored.path,
        };
      }

      const scoped = await supabase
        .from("projects")
        .update(patch)
        .eq("id", input.projectId)
        .eq("user_id", ctx.user.id);

      if (isProjectsUserIdMissingError(scoped.error)) {
        const fallback = await supabase
          .from("projects")
          .update(patch)
          .eq("id", input.projectId);
        assertSupabaseSuccess(fallback.error, "Unable to update project artifact");
      } else {
        assertSupabaseSuccess(scoped.error, "Unable to update project artifact");
      }
    }

    return {
      id: Number(data?.id ?? 0),
      url: stored.url,
      path: stored.path,
    };
  }),
});
