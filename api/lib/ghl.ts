import { env } from "./env";

type GhlPipeline = {
  id?: string;
  name?: string;
  stages?: Array<{ id?: string; name?: string }>;
};

export function isGhlConfigured() {
  return Boolean(env.ghlApiKey && env.ghlLocationId);
}

function requireGhl() {
  if (!isGhlConfigured()) {
    throw new Error("GoHighLevel is not configured. Add GHL_API_KEY and GHL_LOCATION_ID to .env.");
  }
}

function normalizeGhlValue(value: string | undefined) {
  return (value ?? "").trim();
}

function readNestedId(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  if (typeof record._id === "string") return record._id;
  return "";
}

export function extractGhlEntityId(payload: unknown, candidates: string[] = []): string {
  if (!payload || typeof payload !== "object") return "";

  const root = payload as Record<string, unknown>;
  const direct = readNestedId(root);
  if (direct) return direct;

  for (const key of candidates) {
    const nested = readNestedId(root[key]);
    if (nested) return nested;
  }

  const dataRecord = root.data;
  if (dataRecord && typeof dataRecord === "object") {
    const nested = extractGhlEntityId(dataRecord, candidates);
    if (nested) return nested;
  }

  const contactRecord = root.contact;
  if (contactRecord && typeof contactRecord === "object") {
    const nested = extractGhlEntityId(contactRecord, candidates);
    if (nested) return nested;
  }

  const opportunityRecord = root.opportunity;
  if (opportunityRecord && typeof opportunityRecord === "object") {
    const nested = extractGhlEntityId(opportunityRecord, candidates);
    if (nested) return nested;
  }

  const estimateRecord = root.estimate;
  if (estimateRecord && typeof estimateRecord === "object") {
    const nested = extractGhlEntityId(estimateRecord, candidates);
    if (nested) return nested;
  }

  return "";
}

export async function ghlRequest<T>({
  path,
  method = "GET",
  body,
}: {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}): Promise<T> {
  requireGhl();

  const response = await fetch(`${normalizeGhlValue(env.ghlBaseUrl)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${normalizeGhlValue(env.ghlApiKey)}`,
      Version: normalizeGhlValue(env.ghlVersion) || "2021-07-28",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("GoHighLevel rejected the API key. Replace GHL_API_KEY in .env with a valid Private Integration token for this sub-account.");
    }
    if (response.status === 403) {
      throw new Error("GoHighLevel denied access for this token. Confirm the token has permission to access this location and CRM resources.");
    }
    throw new Error(`GoHighLevel ${method} ${path} failed (${response.status}): ${text}`);
  }

  return payload as T;
}

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "",
  };
}

export function getOpportunityStageId(status: string) {
  if (status === "signed") return env.ghlStageSignedId || env.ghlStageSentId || env.ghlStageDraftId;
  if (status === "deposit_requested") return env.ghlStageDepositRequestedId || env.ghlStageSignedId || env.ghlStageSentId;
  if (status === "sent") return env.ghlStageSentId || env.ghlStageDraftId;
  return env.ghlStageDraftId;
}

export async function resolveGhlPipelineConfig(status: string) {
  const configuredPipelineId = normalizeGhlValue(env.ghlPipelineId);
  const configuredStageId = normalizeGhlValue(getOpportunityStageId(status));
  if (configuredPipelineId && configuredStageId) {
    return {
      pipelineId: configuredPipelineId,
      stageId: configuredStageId,
      stageSource: "configured" as const,
    };
  }

  const payload = await ghlRequest<{
    pipelines?: GhlPipeline[];
    data?: { pipelines?: GhlPipeline[] } | GhlPipeline[];
  }>({
    path: `/opportunities/pipelines?locationId=${encodeURIComponent(env.ghlLocationId)}`,
  });

  const pipelines =
    payload.pipelines ||
    (Array.isArray(payload.data) ? payload.data : payload.data?.pipelines) ||
    [];

  const selectedPipeline =
    pipelines.find((pipeline) => pipeline.id === configuredPipelineId) ||
    pipelines[0];
  const pipelineId = selectedPipeline?.id || configuredPipelineId;
  const stages = selectedPipeline?.stages || [];

  const preferredStageId =
    (status === "signed" && normalizeGhlValue(env.ghlStageSignedId)) ||
    (status === "deposit_requested" && normalizeGhlValue(env.ghlStageDepositRequestedId)) ||
    (status === "sent" && normalizeGhlValue(env.ghlStageSentId)) ||
    normalizeGhlValue(env.ghlStageDraftId);

  const matchedStage =
    stages.find((stage) => stage.id === preferredStageId) ||
    stages.find((stage) => {
      const name = stage.name?.toLowerCase() || "";
      if (status === "signed") return name.includes("signed") || name.includes("won");
      if (status === "deposit_requested") return name.includes("deposit");
      if (status === "sent") return name.includes("sent") || name.includes("proposal");
      return name.includes("draft") || name.includes("new") || name.includes("lead");
    }) ||
    stages[0];

  return {
    pipelineId: pipelineId || "",
    stageId: matchedStage?.id || preferredStageId || "",
    stageSource: configuredPipelineId && preferredStageId ? ("configured" as const) : ("discovered" as const),
  };
}
