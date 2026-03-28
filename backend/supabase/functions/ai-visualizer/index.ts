// ai-visualizer/index.ts
// Takes room photo, applies paint/trim color changes using OpenAI GPT Image 1 or Gemini

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { room_photo_id, room_id, wall_color, trim_color, model } = await req.json();

    if (!room_photo_id || !room_id) {
      return new Response(JSON.stringify({ error: "room_photo_id and room_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get room photo
    const { data: roomPhoto, error: photoError } = await supabase
      .from("room_photos")
      .select("*")
      .eq("id", room_photo_id)
      .single();

    if (photoError || !roomPhoto) {
      return new Response(JSON.stringify({ error: "Room photo not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create visualizer run record
    const { data: run, error: runError } = await supabase
      .from("ai_visualizer_runs")
      .insert({
        room_photo_id,
        room_id,
        status: "processing",
        wall_color_applied: wall_color || null,
        trim_color_applied: trim_color || null,
        model_used: model || "gpt-image-1",
      })
      .select()
      .single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: "Failed to create visualizer run" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download room photo from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(roomPhoto.storage_path);

    if (downloadError || !imageData) {
      throw new Error(`Failed to download image: ${downloadError?.message}`);
    }

    const imageBase64 = await imageData
      .arrayBuffer()
      .then((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))));

    let outputImageBase64: string | null = null;
    const usedModel = model || "gpt-image-1";

    try {
      // Build the prompt for the image generation
      let colorInstructions = "";
      if (wall_color) {
        colorInstructions += `Repaint all walls the color ${wall_color}. `;
      }
      if (trim_color) {
        colorInstructions += `Repaint all trim, baseboards, door frames, and window frames the color ${trim_color}. `;
      }

      const prompt = `Photorealistic interior room photo. ${colorInstructions}Keep all furniture, decor, lighting, and room structure exactly the same. Only change the wall and/or trim paint colors as specified. Natural lighting, professional interior photography.`;

      // Use OpenAI GPT Image 1 (via images API)
      const imageResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: usedModel,
          image: imageBase64,
          prompt,
          n: 1,
          size: "1024x1024",
        }),
      });

      if (!imageResponse.ok) {
        // Fall back to DALL-E 3 if GPT Image 1 is not available
        const dallEResponse = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-2",
            image: imageBase64,
            prompt,
            n: 1,
            size: "1024x1024",
          }),
        });

        if (!dallEResponse.ok) {
          throw new Error(`Image generation failed: ${await imageResponse.text()}`);
        }

        const dallEData = await dallEResponse.json();
        outputImageBase64 = dallEData.data?.[0]?.url || null;
      } else {
        const imageData = await imageResponse.json();
        outputImageBase64 = imageData.data?.[0]?.url || null;
      }
    } catch (imgError) {
      console.error("Image generation error:", imgError);
      // Store the error and complete the run
      await supabase
        .from("ai_visualizer_runs")
        .update({
          status: "failed",
          error_message: imgError.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return new Response(JSON.stringify({ error: imgError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let outputStoragePath: string | null = null;

    // If we got a URL back, download and re-upload to Supabase storage
    if (outputImageBase64) {
      try {
        const imageResponse = await fetch(outputImageBase64);
        const imageBuffer = await imageResponse.arrayBuffer();

        const outputPath = `organizations/${roomPhoto.storage_path.split("/")[1]}/visualizer-outputs/${run.id}.png`;

        const { error: uploadError } = await supabase.storage
          .from("visualizer-outputs")
          .upload(outputPath, imageBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!uploadError) {
          outputStoragePath = outputPath;
        }
      } catch (uploadError) {
        console.error("Failed to upload output image:", uploadError);
        // Non-fatal — the image URL is still returned
      }
    }

    // Mark run as completed
    await supabase
      .from("ai_visualizer_runs")
      .update({
        status: "completed",
        output_storage_path: outputStoragePath,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        output_url: outputImageBase64,
        output_storage_path: outputStoragePath,
        wall_color_applied: wall_color,
        trim_color_applied: trim_color,
        model_used: usedModel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-visualizer:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
