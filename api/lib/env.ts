import { config } from "dotenv";

config({ override: true });

function normalizeSupabaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/rest\/v1\/?$/, "");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: process.env.APP_ID ?? "",
  appSecret: process.env.APP_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
  openAiApiKey: (process.env.OPENAI_API_KEY ?? "").trim(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  supabaseUrl: normalizeSupabaseUrl(required("VITE_SUPABASE_URL")),
  supabaseAnonKey: (process.env.VITE_SUPABASE_ANON_KEY ?? "").trim(),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "luna-estimator",
  ghlApiKey: process.env.GHL_API_KEY ?? "",
  ghlLocationId: process.env.GHL_LOCATION_ID ?? "",
  ghlBaseUrl: process.env.GHL_BASE_URL ?? "https://services.leadconnectorhq.com",
  ghlVersion: process.env.GHL_VERSION ?? "2021-07-28",
  ghlPipelineId: process.env.GHL_PIPELINE_ID ?? "",
  ghlStageDraftId: process.env.GHL_STAGE_DRAFT_ID ?? "",
  ghlStageSentId: process.env.GHL_STAGE_SENT_ID ?? "",
  ghlStageSignedId: process.env.GHL_STAGE_SIGNED_ID ?? "",
  ghlStageDepositRequestedId: process.env.GHL_STAGE_DEPOSIT_REQUESTED_ID ?? "",
  kimiAuthUrl: process.env.KIMI_AUTH_URL ?? "",
  kimiOpenUrl: process.env.KIMI_OPEN_URL ?? "",
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  useMockAi: process.env.LUNA_USE_MOCK_AI === "true",
  useMockData:
    process.env.LUNA_USE_MOCK_DATA === "true" ||
    (process.env.NODE_ENV !== "production" &&
      (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)),
};
