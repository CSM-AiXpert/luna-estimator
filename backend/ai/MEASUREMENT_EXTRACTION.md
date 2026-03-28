# AI Measurement Extraction Pipeline

## Overview

The measurement extraction pipeline extracts real, verified dimensional data from uploaded files. It is designed to **never hallucinate** — if a measurement cannot be reliably extracted, it returns an error, not a guess.

---

## Pipeline Architecture

```
User Upload
    │
    ▼
process-file (Edge Function)
    │  Classifies file type
    │  Creates processing_job record
    ▼
extract-measurements (Edge Function)
    │
    ├── [image] ──────────► extract-image (GPT-4o Vision)
    ├── [pdf] ────────────► extract-pdf (Gemini)
    ├── [obj/gltf/glb] ───► extract-polycam (geometric parser)
    ├── [ply] ─────────────► extract-polycam (plane fitting)
    ├── [dxf] ─────────────► extract-pdf (Gemini for CAD)
    └── [csv] ─────────────► parse-csv (direct parsing)
            │
            ▼
    Extracted Measurements
    │
    ├── Verified measurements → returned
    ├── Uncertain measurements → flagged, returned with confidence
    └── Failed extraction ────► error with code
```

---

## 1. Image Analysis (PNG/JPEG)

### Model
**GPT-4o Vision** — has image input + strong spatial reasoning

### Input
- Image file (base64 or storage URL)
- Optional: known scale reference (e.g., "door is 80 inches tall")

### Prompt Engineering

```
You are a precision measurement assistant for a construction estimation app.
Your ONLY job is to extract VERIFIED measurements from room photos.

RULES:
1. Only return measurements you can CONFIDENTLY verify from the image
2. If a measurement cannot be seen clearly, do NOT estimate or guess
3. Do not assume standard dimensions (e.g., don't assume 8ft ceilings)
4. Use the image scale — measure what you see, don't use memory
5. Identify the room shape (rectangular, L-shaped, irregular, etc.)
6. Identify all doors (location + size) and windows (location + size)
7. Estimate ceiling height from vertical measurements

Return ONLY valid JSON matching this schema. Do not add fields not listed.
Do not add explanatory text. Return ONLY the JSON object.

{
  "room_shape": "rectangular" | "l_shaped" | "irregular" | "unknown",
  "ceiling_height_ft": number | null,           // confidence: 0.0-1.0
  "walls": [
    {
      "label": "North" | "South" | "East" | "West" | "Wall-1" | "Wall-2" | ...,
      "length_ft": number | null,                 // confidence: 0.0-1.0
      "height_ft": number | null,                 // confidence: 0.0-1.0
      "area_sqft": number | null,                 // confidence: 0.0-1.0
      "has_door": boolean,
      "has_window": boolean
    }
  ],
  "openings": [
    {
      "type": "door" | "window",
      "wall": "Wall label",
      "width_ft": number | null,                  // confidence: 0.0-1.0
      "height_ft": number | null,                  // confidence: 0.0-1.0
      "area_sqft": number | null
    }
  ],
  "total_floor_area_sqft": number | null,         // confidence: 0.0-1.0
  "confidence_overall": 0.0-1.0,                  // overall extraction confidence
  "unverified_claims": string[],                  // what you looked for but couldn't verify
  "failure_reason": string | null                  // if overall confidence < 0.5
}
```

### Output Schema
```typescript
interface ImageExtractionResult {
  success: boolean;
  error_code?: "UNREADABLE_FILE" | "AI_PROCESSING_FAILED" | "NO_MEASUREMENTS_FOUND" | "DIMENSIONS_UNCERTAIN";
  error_message?: string;
  data: {
    room_shape: string;
    ceiling_height_ft: number | null;
    walls: Wall[];
    openings: Opening[];
    total_floor_area_sqft: number | null;
    confidence_overall: number;
    unverified_claims: string[];
    failure_reason?: string;
  };
}
```

### Constraints
- **MAX_RETRIES:** 1 (retry on timeout only, not on low confidence)
- **TIMEOUT:** 30 seconds
- **Image size limit:** 10MB (reject larger)
- **Resolution requirement:** min 640×480px effective

---

## 2. PDF Analysis

### Model
**Gemini 1.5 Pro** — native PDF understanding, large context window

### Input
- PDF file (storage URL)
- Room ID for context

### Process
1. Download PDF from Supabase Storage
2. Convert PDF pages to images (if Gemini can't read natively)
3. Send to Gemini with structured prompt
4. Parse structured JSON response
5. Cross-reference measurements across pages

### Prompt Engineering

```
You are analyzing a floor plan PDF for a construction estimation application (drywall and paint).
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
        "value": string,           // e.g., "1/4 inch = 1 foot"
        "derived_pixels_per_foot": number | null,
        "confidence": 0.0-1.0
      }
    }
  ],
  "overall_confidence": 0.0-1.0,
  "unverified_dimensions": string[],
  "failure_reason": string | null
}
```

### Output Schema
```typescript
interface PDFExtractionResult {
  success: boolean;
  error_code?: "UNREADABLE_FILE" | "AI_PROCESSING_FAILED" | "NO_MEASUREMENTS_FOUND";
  error_message?: string;
  data: {
    pages: PDFPage[];
    overall_confidence: number;
    unverified_dimensions: string[];
    failure_reason?: string;
  };
}
```

---

## 3. Polycam 3D Analysis (OBJ/GLTF/GLB)

### Approach
Pure geometric parsing — no AI needed for bounding box and area calculations

### OBJ Parsing
```typescript
interface OBJParseResult {
  vertices: Float32Array;      // [x0,y0,z0,x1,y1,z1,...]
  vertexCount: number;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  dimensions: {
    width_ft: number;           // X axis
    depth_ft: number;           // Z axis
    height_ft: number;          // Y axis
  };
  surfaceAreas: {
    floor: number;              // sq ft
    ceiling: number;            // sq ft
    walls: number;              // total sq ft
  };
  wallCount: number;
  triangleCount: number;
  scale: "meters";              // Polycam default unit
}
```

### GLTF/GLB Parsing
```typescript
interface GLTFParseResult {
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  dimensions: {
    width_ft: number;
    depth_ft: number;
    height_ft: number;
  };
  surfaceAreas: {
    floor: number;
    ceiling: number;
    walls: number;
  };
  nodeCount: number;
  meshCount: number;
  triangleCount: number;
  scale: "meters";
}
```

### Key Calculations

**Bounding Box:**
```typescript
minX = Math.min(...vertices.filter((_, i) => i % 3 === 0))
maxX = Math.max(...vertices.filter((_, i) => i % 3 === 0))
minY = Math.min(...vertices.filter((_, i) => i % 3 === 1))
maxY = Math.max(...vertices.filter((_, i) => i % 3 === 1))
minZ = Math.min(...vertices.filter((_, i) => i % 3 === 2))
maxZ = Math.max(...vertices.filter((_, i) => i % 3 === 2))

width_ft  = (maxX - minX) * 3.28084   // meters → feet
depth_ft  = (maxZ - minZ) * 3.28084
height_ft = (maxY - minY) * 3.28084
```

**Floor Area:**
```typescript
floorArea_sqft = width_ft * depth_ft
```

**Wall Area:**
```typescript
// For each face classified as wall (normal Y ≈ 0, i.e., vertical):
// Project to 2D, compute polygon area
// Sum all wall polygon areas → total wall area
```

**Opening Detection:**
```typescript
// Detect "holes" in wall mesh where door/window should be:
// 1. Find all faces with normals pointing in a consistent direction (wall plane)
// 2. Project face vertices to the wall plane
// 3. Detect if there's a gap (missing triangles) in the projection
// 4. Gaps > threshold (0.5 sqft) flagged as potential openings
// NOTE: This detects presence, not exact dimensions
```

---

## 4. Point Cloud (PLY) Analysis

### Approach
Statistical + geometric — fit planes, compute bounding box

### Process
1. Parse PLY header → extract property names
2. Parse vertex data → extract XYZ coordinates
3. Compute bounding box
4. Fit floor plane (largest horizontal cluster)
5. Fit wall planes (vertical clusters)
6. Compute areas from plane extents

### Plane Fitting Algorithm (RANSAC)
```typescript
function fitPlane(points: Float32Array, axis: 'X' | 'Y' | 'Z'): Plane {
  // For floor: axis = 'Y', find cluster where Y ≈ constant
  // For walls: axis = 'X' or 'Z', find clusters where X or Z ≈ constant
  
  // 1. Create histogram of coordinate values for the given axis
  // 2. Find dominant peak = most common plane position
  // 3. Filter points near that plane (within tolerance)
  // 4. Compute plane bounds from filtered points' other two axes
  // 5. Return plane: { axis, position, bounds: {min, max} }
}
```

### Output Schema
```typescript
interface PLYParseResult {
  vertexCount: number;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  dimensions: {
    width_ft: number;
    depth_ft: number;
    height_ft: number;
  };
  planes: {
    floor: { position_ft: number; area_sqft: number; confidence: number } | null;
    ceiling: { position_ft: number; area_sqft: number; confidence: number } | null;
    walls: Array<{ axis: 'X' | 'Z'; position_ft: number; area_sqft: number; confidence: number }>;
  };
  totalWallArea_sqft: number;
  floorArea_sqft: number;
  scale: "meters";
}
```

---

## 5. CSV Parsing

### Process
1. Download CSV from storage
2. Parse header row to identify columns
3. Map known column names to semantic types:
   - `length`, `length_ft`, `wall_length` → wall length
   - `width`, `width_ft`, `wall_width` → wall width (thickness, usually ignored)
   - `height`, `height_ft`, `wall_height`, `ceiling_height` → wall height
   - `area`, `area_sqft`, `wall_area` → wall area
   - `type`, `label`, `element_type` → element type (wall, door, window)
   - `notes`, `description` → supplementary text

4. Validate numeric values
5. Return structured data

### Output Schema
```typescript
interface CSVParseResult {
  success: boolean;
  error_code?: "UNREADABLE_FILE" | "INVALID_FORMAT" | "NO_MEASUREMENTS_FOUND";
  error_message?: string;
  data: {
    rows: CSVRow[];
    totalWalls_sqft: number;
    totalDoors_sqft: number;
    totalWindows_sqft: number;
    totalOpenings_sqft: number;
    netPaintableArea_sqft: number;
    raw_confidence: number;  // how well CSV matched expected schema
  };
}

interface CSVRow {
  label: string;
  type: "wall" | "door" | "window" | "ceiling" | "floor" | "unknown";
  length_ft: number | null;
  width_ft: number | null;
  height_ft: number | null;
  area_sqft: number | null;
  confidence: number;
  raw_data: Record<string, string>;
}
```

---

## Unified Output Format

All extractors return a normalized result:

```typescript
interface ExtractionResult {
  success: boolean;
  job_id: string;
  room_id: string;
  file_type: "image" | "pdf" | "obj" | "gltf" | "glb" | "ply" | "dxf" | "csv";
  extracted_at: string;  // ISO 8601
  
  // Measurements (normalized)
  measurements: {
    room_shape: string | null;
    ceiling_height_ft: number | null;
    floor_area_sqft: number | null;
    gross_wall_area_sqft: number | null;
    net_wall_area_sqft: number | null;    // gross - openings
    openings_total_area_sqft: number | null;
    wall_count: number;
    opening_count: number;
  };
  
  // Detailed wall/opening breakdown
  walls: NormalizedWall[];
  openings: NormalizedOpening[];
  
  // Confidence & errors
  confidence: number;           // 0.0-1.0 overall
  unverified: string[];          // what we couldn't confirm
  error_code?: string;
  error_message?: string;
}

interface NormalizedWall {
  label: string;
  area_sqft: number | null;
  height_ft: number | null;
  length_ft: number | null;
  confidence: number;
  source: "ai_vision" | "geometric_parser" | "point_cloud" | "csv" | "pdf";
}

interface NormalizedOpening {
  type: "door" | "window";
  area_sqft: number | null;
  width_ft: number | null;
  height_ft: number | null;
  confidence: number;
  source: "ai_vision" | "geometric_parser" | "point_cloud" | "csv" | "pdf";
}
```

---

## Confidence Scoring

| Source | Typical Confidence | Notes |
|--------|-------------------|-------|
| CSV direct | 0.95-1.0 | Direct measurement export |
| PDF dimension text | 0.80-0.95 | Depends on annotation clarity |
| OBJ/GLTF bounding box | 0.90-1.0 | Geometric, not estimated |
| PLY plane fitting | 0.70-0.90 | Statistical estimate |
| AI Vision (clear photo) | 0.70-0.85 | Depends on image quality |
| AI Vision (busy room) | 0.50-0.70 | May miss details |
| DXF | 0.75-0.90 | Depends on layer quality |

**Threshold:** If `confidence < 0.5`, set `success: false` and return `DIMENSIONS_UNCERTAIN`.

---

## Failure Handling

| Error Code | Trigger | Response |
|------------|---------|----------|
| `UNREADABLE_FILE` | File corrupted, wrong format | Fail, return error |
| `INVALID_FORMAT` | Expected format doesn't match | Fail, return error |
| `NO_MEASUREMENTS_FOUND` | File valid but empty of measurements | Fail, return error |
| `AI_PROCESSING_FAILED` | API timeout, rate limit, server error | Retry once, then fail |
| `DIMENSIONS_UNCERTAIN` | Confidence < 0.5 after extraction | Fail, return error |

**NEVER return estimated values when confidence is low. Fail cleanly.**
