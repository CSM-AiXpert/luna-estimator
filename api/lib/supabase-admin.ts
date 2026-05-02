import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

let bucketReady = false;

export function getSupabaseAdmin() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase server credentials are missing. Add VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function ensureSupabaseBucket() {
  if (bucketReady) return;

  const supabase = getSupabaseAdmin();
  const bucketName = env.supabaseStorageBucket;
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Unable to inspect Supabase storage buckets: ${listError.message}`);
  }

  const existing = buckets.find((bucket) => bucket.name === bucketName);
  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: "50MB",
    });

    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw new Error(`Unable to create Supabase storage bucket '${bucketName}': ${createError.message}`);
    }
  }

  bucketReady = true;
}

export async function uploadBufferToSupabase({
  objectPath,
  contentType,
  buffer,
}: {
  objectPath: string;
  contentType: string;
  buffer: Buffer;
}) {
  await ensureSupabaseBucket();
  const supabase = getSupabaseAdmin();
  const bucketName = env.supabaseStorageBucket;

  const { error } = await supabase.storage.from(bucketName).upload(objectPath, buffer, {
    cacheControl: "3600",
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(objectPath);
  return {
    bucket: bucketName,
    path: objectPath,
    url: data.publicUrl,
  };
}
