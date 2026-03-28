import { createBrowserClient } from "@supabase/ssr"
import { Database } from "./types"

export function getSupabaseClient() {
  if (typeof window === "undefined") return null
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const supabase = getSupabaseClient()

export function createServerSupabaseClient(cookies: { getAll: () => { name: string; value: string }[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { createServerClient } = require("@supabase/ssr") as { createServerClient: any }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: cookies.getAll,
      },
    }
  )
}
