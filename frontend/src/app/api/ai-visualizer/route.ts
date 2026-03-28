import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* ignore */ }
        },
      },
    }
  )
}

// POST /api/ai-visualizer
// Calls the Supabase Edge Function for AI paint visualization
export async function POST(req: NextRequest) {
  try {
    const { imageUrl, wallColor, trimColor, roomId, model } = await req.json()

    if (!imageUrl || !roomId) {
      return NextResponse.json({ error: "imageUrl and roomId are required" }, { status: 400 })
    }

    // Get the current user's auth token
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Get the room photo for this room
    const { data: roomPhotos, error: photoError } = await supabase
      .from("room_photos")
      .select("id")
      .eq("room_id", roomId)
      .limit(1)

    if (photoError || !roomPhotos?.length) {
      return NextResponse.json({ error: "No room photo found. Upload a photo first." }, { status: 400 })
    }

    const roomPhotoId = roomPhotos[0].id

    // Call Supabase Edge Function
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-visualizer`
    const edgeRes = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        room_photo_id: roomPhotoId,
        room_id: roomId,
        wall_color: wallColor ?? "#F5F5F5",
        trim_color: trimColor ?? "#FFFFFF",
        model: model ?? "gpt-image-1",
      }),
    })

    if (!edgeRes.ok) {
      const errData = await edgeRes.json().catch(() => ({}))
      return NextResponse.json({ error: errData.error ?? "AI visualization failed" }, { status: 500 })
    }

    const result = await edgeRes.json()
    return NextResponse.json({
      outputUrl: result.output_url ?? result.visualization_url,
      status: result.status,
    })
  } catch (err) {
    console.error("AI visualizer error:", err)
    return NextResponse.json({ error: "Server error during visualization" }, { status: 500 })
  }
}
