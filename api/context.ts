import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { AppUser } from "./lib/supabase-db";
import { env } from "./lib/env";
import { getSupabaseAdmin } from "./lib/supabase-admin";
import { mockUser } from "./mock-data";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: AppUser;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  if (env.useMockData) {
    ctx.user = mockUser;
    return ctx;
  }
  try {
    const authHeader = opts.req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

    if (!token) {
      return ctx;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return ctx;
    }

    ctx.user = {
      id: data.user.id,
      name: (data.user.user_metadata?.full_name as string | undefined) ?? data.user.email ?? null,
      email: data.user.email ?? null,
      avatar: (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
      role:
        (data.user.app_metadata?.role as string | undefined) ??
        (data.user.user_metadata?.role as string | undefined) ??
        "admin",
    };
  } catch {
    // Authentication is optional here
  }
  return ctx;
}
