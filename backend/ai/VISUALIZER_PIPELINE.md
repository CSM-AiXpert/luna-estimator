# AI Visualizer Pipeline

## Overview

The AI Visualizer applies user-selected paint colors to room photos. It is a **strict wall paint color application tool** — it must NOT modify room geometry, furniture, lighting, or any other aspect of the image.

**Core principle: The output must look like the same room with different paint.**

---

## Architecture

```
User selects colors (wall hex + trim hex)
    │
    ▼
ai-visualizer Edge Function
    │
    ├── 1. Download room photo from storage
    ├── 2. Validate image quality
    ├── 3. Call GPT-4o Vision API with paint prompt
    ├── 4. Upload result to storage
    ├── 5. Create ai_visualizer_run record
    ▼
Return result URL or failure
```

---

## Input

```typescript
interface VisualizerRequest {
  room_photo_id: string;    // Supabase storage file ID
  wall_color: string;       // Hex color, e.g., "#4A6FA5"
  trim_color: string;       // Hex color, e.g., "#FFFFFF"
  room_id: string;          // For record keeping
}
```

### Validation
- `wall_color`: Must be valid 6-digit hex (`/^#[0-9A-Fa-f]{6}$/`)
- `trim_color`: Must be valid 6-digit hex
- `room_photo_id`: Must exist in `room_photos` table with `file_path`
- Image must be ≤ 10MB
- Image must be PNG or JPEG

---

## GPT-4o Vision Prompt

```
You are a professional interior design visualization AI.
Your ONLY task is to apply paint colors to the walls and trim in this room photo.

STRICT CONSTRAINTS — Violating any of these invalidates the output:
1. DO NOT change room geometry or layout
2. DO NOT move, add, or remove any furniture, appliances, decorations, or objects
3. DO NOT change lighting, shadows, or reflections
4. DO NOT modify floors, ceilings (unless user explicitly wants ceiling painted)
5. DO NOT add textures, patterns, or effects to the paint
6. ONLY change wall paint color and trim color
7. If uncertain whether a surface is a wall vs furniture, DO NOT modify it
8. Apply the colors naturally — paint has slight variation, not flat solid blocks
9. Keep consistent with room lighting — painted walls should match the light source

COLOR APPLICATION:
- Wall color: #WALL_HEX → Apply uniformly to ALL wall surfaces visible in the room
- Trim color: #TRIM_HEX → Apply to: door frames, window frames, baseboards, crown molding, door panels

TECHNICAL:
- Return ONLY the modified image in your response
- Preserve image resolution and aspect ratio
- Maintain natural shadow gradients
- Paint should look like actual paint, not a flat overlay

If you cannot reliably identify and isolate the wall surfaces, respond with exactly:
FAILED: Cannot identify walls reliably

Do not include any explanation, description, or additional text.
```

Replace `#WALL_HEX` and `#TRIM_HEX` with actual hex values.

---

## Process Flow

### Step 1: Download Original Photo
```typescript
// Get signed URL or public URL for the room photo
const { data: photo, error } = await supabase
  .storage
  .from('room-photos')
  .download(room_photo_id);

// Validate it's an image
const contentType = photo.headers.get('content-type');
if (!contentType.match(/^image\/(png|jpeg|jpg)$/)) {
  throw new Error('INVALID_IMAGE_FORMAT');
}
```

### Step 2: Validate Image Quality
```typescript
// Decode image dimensions
// If < 640px in either dimension → FAIL: IMAGE_TOO_SMALL
// If > 10MB → FAIL: IMAGE_TOO_LARGE

// Additional quality checks via AI (in prompt):
// - If blurry/unclear, AI will report FAILED
```

### Step 3: Call AI API
```typescript
const response = await openAI.images.edit({
  model: 'gpt-4o',  // or 'gpt-4o-mini' for cost savings
  image: photoBuffer,   // base64 encoded
  prompt: visualizerPrompt(wall_color, trim_color),
  response_format: 'b64_json',
});
```

**IMPORTANT:** We use `images.edit` (not `images.generate`) because we want to preserve the exact room geometry and only change colors. The model must work from the original image.

### Step 4: Upload Result
```typescript
const resultBuffer = Buffer.from(response.data[0].b64_json, 'base64');

const fileName = `${room_id}/${Date.now()}-visualized.png`;
const { data: uploadData, error: uploadError } = await supabase
  .storage
  .from('visualizations')
  .upload(fileName, resultBuffer, {
    contentType: 'image/png',
    upsert: false,
  });
```

### Step 5: Create Record
```typescript
const { error: insertError } = await supabase
  .from('ai_visualizer_runs')
  .insert({
    id: crypto.randomUUID(),
    room_id,
    room_photo_id,
    wall_color,
    trim_color,
    input_file_path: originalPath,
    output_file_path: fileName,
    status: 'completed',
    completed_at: new Date().toISOString(),
    gpt_model: 'gpt-4o',
    tokens_used: response.usage?.total_tokens || null,
    cost_usd: calculateCost(response.usage),  // based on model pricing
  });
```

---

## Output

```typescript
interface VisualizerResponse {
  success: boolean;
  run_id: string;                  // ai_visualizer_runs.id
  output_url: string;             // Public URL of visualized image
  input_photo_id: string;
  colors_applied: {
    wall_color: string;
    trim_color: string;
  };
  status: "completed" | "failed";
  
  // If failed:
  error_code?: "IMAGE_TOO_SMALL" | "IMAGE_TOO_LARGE" | 
               "INVALID_IMAGE_FORMAT" | "AI_PROCESSING_FAILED" | 
               "AI_CANNOT_IDENTIFY_WALLS" | "STORAGE_UPLOAD_FAILED";
  error_message?: string;
}
```

---

## Failure States

| Error Code | Cause | User Message |
|------------|-------|--------------|
| `IMAGE_TOO_SMALL` | Image < 640px | "Image resolution too low. Please use a larger photo." |
| `IMAGE_TOO_LARGE` | Image > 10MB | "Image file too large. Please use a smaller file." |
| `INVALID_IMAGE_FORMAT` | Not PNG/JPEG | "Only PNG and JPEG images are supported." |
| `AI_PROCESSING_FAILED` | API error/timeout | "Visualization failed. Please try again." |
| `AI_CANNOT_IDENTIFY_WALLS` | AI returned FAILED | "Could not identify wall surfaces. Please try a clearer photo." |
| `STORAGE_UPLOAD_FAILED` | Upload error | "Could not save result. Please try again." |

### On AI Failure
```typescript
// If AI returns "FAILED: Cannot identify walls reliably"
if (aiResponse.includes('FAILED')) {
  await supabase.from('ai_visualizer_runs').insert({
    // ... record with status: 'failed', error_code: 'AI_CANNOT_IDENTIFY_WALLS'
  });
  return { success: false, error_code: 'AI_CANNOT_IDENTIFY_WALLS' };
}
```

---

## Cost Estimation

GPT-4o image editing pricing (approximate):
- Input image: charged at image tokenization rate (~850 tokens for 512×512, scales with resolution)
- Output image: ~$0.04-0.12 per image depending on size

For a typical room photo (1024×768):
- Estimated input tokens: ~2500
- Estimated cost: ~$0.03-0.05 per visualization

Track costs in `ai_visualizer_runs.cost_usd` for billing/reporting.

---

## Constraints Summary (STRICT)

| DO | DO NOT |
|----|--------|
| Apply wall_color to wall surfaces | Change room dimensions |
| Apply trim_color to trim elements | Move or modify furniture |
| Preserve existing lighting/shadows | Change lighting |
| Keep image resolution same | Add objects |
| Natural paint texture/variation | Flat color overlay |
| Consistent with room's light source | Modify floor/ceiling |

---

## Retry Policy

- **Max retries:** 1 (on AI timeout or transient error only)
- **No retries** for: low quality, cannot identify walls, invalid format
- **Retry delay:** 2 seconds before retry

---

## Monitoring

Track in `ai_visualizer_runs`:
- `wall_color`, `trim_color` — for color popularity analytics
- `gpt_model` — for model cost tracking
- `tokens_used`, `cost_usd` — for cost monitoring
- `status` — for success rate tracking
- `completed_at` — for latency monitoring

Dashboard queries:
```sql
-- Success rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate
FROM ai_visualizer_runs
WHERE created_at > NOW() - INTERVAL '7 days';

-- Average cost per run
SELECT AVG(cost_usd) FROM ai_visualizer_runs WHERE cost_usd IS NOT NULL;

-- Most popular colors (top 10)
SELECT wall_color, COUNT(*) as uses
FROM ai_visualizer_runs
GROUP BY wall_color
ORDER BY uses DESC
LIMIT 10;
```
