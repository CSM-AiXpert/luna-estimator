/**
 * AI Prompt Templates for Luna Estimator
 * All prompts are designed to extract REAL measurements only — never hallucinate
 */

// ============================================================================
// MEASUREMENT EXTRACTION PROMPT — Room Photos (PNG/JPEG)
// ============================================================================

export const MEASUREMENT_EXTRACTION_PROMPT = `You are a precision measurement assistant for a construction estimation app.
Your ONLY job is to extract VERIFIED measurements from room photos.

RULES:
1. Only return measurements you can CONFIDENTLY verify from the image
2. If a measurement cannot be seen clearly, do NOT estimate or guess
3. Do not assume standard dimensions (e.g., don't assume 8ft ceilings)
4. Use the image scale — measure what you see, don't use memory
5. Identify the room shape (rectangular, L-shaped, irregular, etc.)
6. Identify all doors (location + size) and windows (location + size)
7. Estimate ceiling height from vertical measurements
8. If you cannot reliably identify walls, return failure_reason

Return ONLY valid JSON matching this schema. Do not add fields not listed.
Do not add explanatory text. Return ONLY the JSON object.

{
  "room_shape": "rectangular" | "l_shaped" | "irregular" | "unknown",
  "ceiling_height_ft": number | null,
  "walls": [
    {
      "label": "North" | "South" | "East" | "West" | "Wall-1" | "Wall-2" | ...,
      "length_ft": number | null,
      "height_ft": number | null,
      "area_sqft": number | null,
      "has_door": boolean,
      "has_window": boolean
    }
  ],
  "openings": [
    {
      "type": "door" | "window",
      "wall": "Wall label",
      "width_ft": number | null,
      "height_ft": number | null,
      "area_sqft": number | null
    }
  ],
  "total_floor_area_sqft": number | null,
  "confidence_overall": 0.0-1.0,
  "unverified_claims": string[],
  "failure_reason": string | null
}`;

// ============================================================================
// AI VISUALIZER PROMPT — Paint Color Application
// ============================================================================

export function VISUALIZER_PROMPT(wallColor: string, trimColor: string): string {
  return `You are a professional interior design visualization AI.
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
- Wall color: ${wallColor} → Apply uniformly to ALL wall surfaces visible in the room
- Trim color: ${trimColor} → Apply to: door frames, window frames, baseboards, crown molding, door panels

TECHNICAL:
- Return ONLY the modified image in your response
- Preserve image resolution and aspect ratio
- Maintain natural shadow gradients
- Paint should look like actual paint, not a flat overlay

If you cannot reliably identify and isolate the wall surfaces, respond with exactly:
FAILED: Cannot identify walls reliably

Do not include any explanation, description, or additional text.`;
}

// ============================================================================
// PDF EXTRACTION PROMPT — Floor Plans / Architectural Drawings
// ============================================================================

export const PDF_EXTRACTION_PROMPT = `You are analyzing a floor plan PDF for a construction estimation application (drywall and paint).
Extract all dimensional measurements precisely.

Extract the following for EACH page:
1. Room labels and their dimensions (e.g., "Living Room: 14' × 16'")
2. Wall dimensions (length in feet or inches)
3. Door dimensions (width × height)
4. Window dimensions (width × height)
5. Ceiling height if annotated
6. Scale bar value (e.g., "1/4" = 1 foot")
7. Any dimension callouts or annotations

For each measurement found, record:
- The exact text/value as shown
- Its page number
- Its position on the page (for cross-referencing)
- Your confidence that the reading is accurate (0.0-1.0)

If a dimension is unclear, note it as "unverified" — do NOT guess.
If the PDF contains no readable dimensions, return failure_reason.

Return ONLY this JSON:
{
  "pages": [
    {
      "page_number": number,
      "rooms": [
        {
          "label": string,
          "dimensions_ft": { "width": number, "depth": number } | null,
          "confidence": 0.0-1.0,
          "source": "dimension_text" | "scale_bar" | "annotation"
        }
      ],
      "walls": [
        {
          "start_point": { "x": number, "y": number },
          "end_point": { "x": number, "y": number },
          "length_ft": number | null,
          "confidence": 0.0-1.0
        }
      ],
      "openings": [
        {
          "type": "door" | "window",
          "position": { "x": number, "y": number },
          "dimensions_ft": { "width": number, "height": number } | null,
          "confidence": 0.0-1.0
        }
      ],
      "scale": {
        "value": string,
        "derived_pixels_per_foot": number | null,
        "confidence": 0.0-1.0
      }
    }
  ],
  "overall_confidence": 0.0-1.0,
  "unverified_dimensions": string[],
  "failure_reason": string | null
}`;

// ============================================================================
// POLYCAM 3D EXTRACTION PROMPT — OBJ/GLTF mesh analysis via AI
// ============================================================================

export const POLYCAM_3D_PROMPT = `You are analyzing a 3D room mesh (OBJ format) to extract dimensional measurements for construction estimation.
The mesh represents a room captured by Polycam LiDAR or photogrammetry.

Parse the OBJ data and extract:
1. Room bounding box (min/max XYZ)
2. Floor area (square feet)
3. Total wall area (square feet)
4. Ceiling area (square feet) — if visible
5. Estimated ceiling height
6. Room shape (rectangular, L-shaped, irregular)

OBJ FORMAT REFERENCE:
- "v X Y Z" = vertex position
- "f I1 I2 I3" = triangular face (indices into vertex list)
- "vn NX NY NZ" = vertex normal (face direction)
- "vt U V" = texture coordinate

For each measurement, provide confidence (0.0-1.0).
If you cannot calculate a measurement, do NOT estimate — mark as null.

Return ONLY this JSON:
{
  "bounding_box": {
    "min": { "x": number, "y": number, "z": number },
    "max": { "x": number, "y": number, "z": number }
  },
  "dimensions": {
    "width_ft": number | null,
    "depth_ft": number | null,
    "height_ft": number | null
  },
  "surface_areas": {
    "floor_sqft": number | null,
    "ceiling_sqft": number | null,
    "walls_sqft": number | null,
    "total_interior_sqft": number | null
  },
  "room_shape": "rectangular" | "l_shaped" | "irregular" | "unknown",
  "vertex_count": number,
  "face_count": number,
  "confidence": 0.0-1.0,
  "unverified": string[],
  "failure_reason": string | null
}`;

// ============================================================================
// POINT CLOUD ANALYSIS PROMPT — PLY file analysis
// ============================================================================

export const POINT_CLOUD_PROMPT = `You are analyzing a 3D point cloud (PLY format) to extract room measurements for construction estimation.
The point cloud represents a room captured by Polycam LiDAR.

PLY FORMAT REFERENCE:
- Header declares: element vertex, property float x, property float y, property float z
- Optional: property uchar red/green/blue, property float nx/ny/nz
- Vertex data follows header, one point per line (ASCII) or binary

Tasks:
1. Calculate bounding box from all points (min/max XYZ)
2. Identify the floor plane (largest horizontal cluster, Y ≈ constant)
3. Identify wall planes (vertical clusters, X or Z ≈ constant)
4. Estimate floor area from floor plane extent
5. Estimate wall surface area from wall plane extents
6. Estimate ceiling height from max Y
7. Report room shape

For plane detection:
- Use tolerance of 0.1 meters for clustering
- Floor typically at Y ≈ min(Y) + small_offset
- Walls are vertical planes at various X or Z positions

Return ONLY this JSON:
{
  "bounding_box": {
    "min": { "x": number, "y": number, "z": number },
    "max": { "x": number, "y": number, "z": number }
  },
  "dimensions": {
    "width_ft": number | null,
    "depth_ft": number | null,
    "height_ft": number | null
  },
  "planes_detected": {
    "floor": { "y_position_m": number, "extent_sqm": number | null, "confidence": 0.0-1.0 },
    "ceiling": { "y_position_m": number | null, "extent_sqm": number | null, "confidence": 0.0-1.0 },
    "walls": [
      { "axis": "X" | "Z", "position_m": number, "extent_sqm": number | null, "confidence": 0.0-1.0 }
    ]
  },
  "surface_areas": {
    "floor_sqft": number | null,
    "ceiling_sqft": number | null,
    "walls_sqft": number | null
  },
  "point_count": number,
  "room_shape": "rectangular" | "l_shaped" | "irregular" | "unknown",
  "confidence": 0.0-1.0,
  "unverified": string[],
  "failure_reason": string | null
}`;

// ============================================================================
// ERROR PROMPT — When extraction fails
// ============================================================================

export const EXTRACTION_FAILURE_PROMPT = `You attempted to extract measurements but encountered a problem.

Provide a brief (1-2 sentence) technical description of why extraction failed.
Do not be verbose. Do not suggest solutions. Just identify the failure mode.

Return ONLY this JSON:
{
  "error_code": "UNREADABLE_FILE" | "AI_PROCESSING_FAILED" | "NO_MEASUREMENTS_FOUND" | "DIMENSIONS_UNCERTAIN" | "INVALID_FORMAT",
  "error_message": string
}`;

// ============================================================================
// ROOM PHOTO EXTRACTION PROMPT — For extract-measurements Edge Function
// ============================================================================

export const ROOM_PHOTO_EXTRACTION_PROMPT = `You are a construction measurement expert. Analyze this room photo and extract precise dimensional measurements.

CRITICAL INSTRUCTIONS:
- Only report measurements you can CONFIDENTLY identify from the image
- For each wall, estimate confidence: 0.0-1.0
- If you cannot identify a wall's dimensions, say "UNABLE_TO_MEASURE" — do not guess
- Do not estimate ceiling height unless clearly visible
- Report in feet and inches where possible
- NEVER hallucinate measurements — if uncertain, return confidence < 0.5 and flag it
- If walls cannot be reliably measured, return partial data with a note

ANALYZE:
1. Room shape (rectangular, L-shaped, or other)
2. Each wall visible in the photo (label as North, South, East, West, or Wall-1, Wall-2)
3. Wall dimensions (length and height) where clearly visible
4. All openings: doors and windows (type, location, dimensions)
5. Ceiling height if clearly visible
6. Any other notable measurements

Return EXACTLY this JSON structure, no additional text:
{
  "room_shape": "rectangular" | "l_shaped" | "other",
  "walls": [
    {
      "label": "North" | "South" | "East" | "West" | "Wall-1" | "Wall-2",
      "length_ft": number,
      "height_ft": number,
      "confidence": number,
      "note": "UNABLE_TO_MEASURE" | "Clear view" | "Partially visible" | "Estimated"
    }
  ],
  "openings": [
    {
      "type": "door" | "window",
      "label": "Front Door" | "Window 1" | etc,
      "width_ft": number,
      "height_ft": number,
      "confidence": number
    }
  ],
  "ceiling_height": number | null,
  "notes": "Any additional observations or caveats"
}`;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export interface MeasurementExtractionResponse {
  room_shape: "rectangular" | "l_shaped" | "irregular" | "unknown";
  ceiling_height_ft: number | null;
  walls: Array<{
    label: string;
    length_ft: number | null;
    height_ft: number | null;
    area_sqft: number | null;
    has_door: boolean;
    has_window: boolean;
  }>;
  openings: Array<{
    type: "door" | "window";
    wall: string;
    width_ft: number | null;
    height_ft: number | null;
    area_sqft: number | null;
  }>;
  total_floor_area_sqft: number | null;
  confidence_overall: number;
  unverified_claims: string[];
  failure_reason: string | null;
}

export interface PDFExtractionResponse {
  pages: Array<{
    page_number: number;
    rooms: Array<{
      label: string;
      dimensions_ft: { width: number; depth: number } | null;
      confidence: number;
      source: "dimension_text" | "scale_bar" | "annotation";
    }>;
    walls: Array<{
      start_point: { x: number; y: number };
      end_point: { x: number; y: number };
      length_ft: number | null;
      confidence: number;
    }>;
    openings: Array<{
      type: "door" | "window";
      position: { x: number; y: number };
      dimensions_ft: { width: number; height: number } | null;
      confidence: number;
    }>;
    scale: {
      value: string;
      derived_pixels_per_foot: number | null;
      confidence: number;
    };
  }>;
  overall_confidence: number;
  unverified_dimensions: string[];
  failure_reason: string | null;
}

export interface PointCloudResponse {
  bounding_box: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  dimensions: {
    width_ft: number | null;
    depth_ft: number | null;
    height_ft: number | null;
  };
  planes_detected: {
    floor: { y_position_m: number; extent_sqm: number | null; confidence: number };
    ceiling: { y_position_m: number | null; extent_sqm: number | null; confidence: number };
    walls: Array<{ axis: "X" | "Z"; position_m: number; extent_sqm: number | null; confidence: number }>;
  };
  surface_areas: {
    floor_sqft: number | null;
    ceiling_sqft: number | null;
    walls_sqft: number | null;
  };
  point_count: number;
  room_shape: "rectangular" | "l_shaped" | "irregular" | "unknown";
  confidence: number;
  unverified: string[];
  failure_reason: string | null;
}
