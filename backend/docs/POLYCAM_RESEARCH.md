# Polycam Research — File Formats & Extraction

## Overview
Polycam is an iOS/Android app that captures 3D rooms/spaces using LiDAR or photogrammetry. It exports in several formats relevant to the Luna Drywall & Paint estimator.

---

## 1. OBJ (3D Mesh)

### What it contains
- **Vertices:** `v x y z` lines — raw 3D point positions in world space
- **Face indices:** `f v1 v2 v3` — triangles referencing vertex indices
- **Normals:** `vn nx ny nz` — surface direction vectors (optional)
- **UVs:** `vt u v` — texture coordinates (optional)
- **Material library:** `mtllib filename.mtl` — references .mtl file with colors

### Example (small room mesh)
```
v -0.005 0.000 2.840
v 4.230 0.000 2.840
v 4.230 2.743 2.840
v -0.005 2.743 2.840
...
f 1 2 3
f 1 3 4
```

### Measurements extractable
- **Bounding box:** min/max XYZ → room width, depth, height
- **Floor area:** project all vertices to Y=0 plane, compute convex hull or bounding rectangle
- **Wall surface area:** sum of triangle areas for vertical faces (normal Y ≈ 0)
- **Ceiling area:** sum of triangle areas for horizontal faces at max Y
- **Openings:** detect mesh "holes" or discontinuities (walls with missing triangles where doors/windows should be)

### Limitations
- No explicit door/window metadata — must infer from mesh topology (holes in wall meshes)
- Large file sizes (raw vertices uncompressed)
- No scale embedded — Polycam exports in meters; assume 1 unit = 1 meter

### Parsing in Deno
```typescript
// Read line by line, parse "v X Y Z" and "f i1 i2 i3"
// Accumulate min/max for each axis
// For each face, compute area via cross product of edge vectors
// Classify face as floor/ceiling/wall by normal direction
```

---

## 2. GLTF / GLB (GL Transmission Format)

### What it contains
- **GLTF (JSON):** Human-readable format with references to binary buffers
- **GLB (binary):** Single-file container with JSON header + binary data packed together
- **Nodes:** Hierarchy of scene objects (mesh references)
- **Meshes:** Arrays of primitives (triangles with position/normal/UV attributes)
- **Accessors:** Typed arrays describing vertex data layout
- **BufferViews:** Slice of binary data
- **Buffers:** Raw binary blobs (base64 in GLTF JSON, embedded in GLB)

### Measurements extractable
- **Bounding box:** `primitives[*].attributes.POSITION` min/max → X, Y, Z dimensions
- **Primitive count:** total triangle count
- **Accessors expose:** positions (vec3), normals (vec3), texture coords (vec2)
- **Scene units:** GLTF uses meters by convention

### Example GLTF structure
```json
{
  "asset": { "version": "2.0" },
  "meshes": [{
    "primitives": [{
      "attributes": { "POSITION": 0, "NORMAL": 1 },
      "indices": 2,
      "material": 0
    }]
  }],
  "accessors": [
    { "bufferView": 0, "componentType": 5126, "count": 1234, "type": "VEC3", "max": [...], "min": [...] },
    ...
  ],
  "bufferViews": [...],
  "buffers": [{ "uri": "data:application/octet-stream;base64,..." }]
}
```

### Limitations
- Binary data must be decoded (base64 or raw ArrayBuffer)
- No semantic labeling of walls/floor/ceiling — must infer from geometry
- Complex scenes may have many unrelated meshes

### Parsing in Deno
```typescript
// GLTF: parse JSON directly
// GLB: extract JSON header from first chunk, binary data from second chunk
// Walk scene nodes to collect all mesh primitives
// Read accessor min/max for bounding boxes
// Decode POSITION accessor data to get raw vertices
```

---

## 3. PLY (Point Cloud)

### What it contains
- **Header:** declares vertex properties (x y z, optionally r g b, nx ny nz, etc.)
- **Vertex list:** raw XYZ coordinates (and optional per-vertex color/normals)
- **Face list:** optional — polygon faces (usually omitted in LiDAR captures)

### Example PLY header
```
ply
format ascii 1.0
element vertex 48752
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
-0.005 0.002 2.840 180 170 160
4.230 0.001 2.839 175 165 155
...
```

### Measurements extractable
- **Bounding box:** min/max XYZ from all vertices → room dimensions
- **Floor plane detection:** find largest horizontal cluster (Y ≈ constant)
- **Wall plane detection:** find vertical clusters (X or Z ≈ constant)
- **Wall surface area:** for each wall plane, compute extent × height
- **Point density:** useful for estimating mesh completeness

### Limitations
- Point cloud only — no triangles/faces to directly compute surface area
- Must fit planes to point clusters to estimate wall/floor area
- No semantic labels — separation of walls/floor/ceiling is heuristic

### Parsing in Deno
```typescript
// Read header lines until "end_header"
// Parse remaining lines as vertex records
// For each vertex: split, cast x/y/z to number
// Accumulate min/max for bounding box
// Optionally cluster points by plane normal to detect surfaces
```

---

## 4. FBX (Filmbox)

### What it contains
- **Binary or ASCII format** — binary is more common for exports
- **Scene graph:** nodes with transforms (translation, rotation, scale)
- **Meshes:** vertices, faces, normals, UVs
- **Materials:** diffuse color, textures
- **Animation data:** if captured (usually not for static rooms)

### Measurements extractable
- Same as OBJ/GLTF — bounding box, surface areas
- FBX stores scale explicitly via units in header

### Limitations
- **Binary format is proprietary** — parsing is complex without a library
- ASCII FBX is rare but easier to parse
- No standard JS/TS FBX parser in Deno ecosystem — would need external dependency
- **Not recommended as primary format for edge functions**

---

## 5. USDZ (Universal Scene Description)

### What it contains
- **ZIP-compressed archive** containing USD (ASCII) + referenced assets (textures, etc.)
- **Stage hierarchy:** scene graph with meshes, materials
- **Prim variants:** named objects

### Measurements extractable
- Bounding box from mesh prims

### Limitations
- USDZ is primarily an **Apple AR format** — less common for room scans
- Parsing requires unzipping + USD parser
- Not ideal for server-side edge functions

---

## 6. DXF (Drawing Exchange Format)

### What it contains
- **CAD format** from AutoCAD
- **Entities:** LINE, POLYLINE, LWPOLYLINE, CIRCLE, ARC, DIMENSION, TEXT, HATCH, etc.
- **Layers:** grouped entities
- **Units:** declared at file header (inches, feet, meters)

### Measurements extractable
- **Wall lines:** POLYLINE/LWPOLYLINE entities representing wall boundaries
- **Dimension entities:** explicit measurement annotations
- **Text entities:** room labels, measurement callouts
- **Scale bar reference:** can derive scale from dimension spacing

### Example DXF entity
```
0
LINE
8
WALLS
10
0.0
20
0.0
30
0.0
11
10.5
21
0.0
31
0.0
```

### Limitations
- ASCII DXF is verbose; binary DXF is proprietary
- Wall thickness varies — need to interpret line/polyline pairs
- No standard DXF parser in Deno — would need library

---

## 7. CSV (Measurement Exports)

### What it contains
- **Direct measurement data** exported from Polycam's measurement tool
- Typical columns: `Label, Length, Width, Height, Area, Notes`
- Often structured as: wall-by-wall measurements, room-by-room

### Example
```
Label,Length_ft,Width_ft,Height_ft,Area_sqft,Type
"North Wall",12.5,1.0,9.0,112.5,wall
"South Wall",12.5,1.0,9.0,112.5,wall
"East Wall",10.0,1.0,9.0,90.0,wall
"West Wall",10.0,1.0,9.0,90.0,wall
"Door 1",3.0,0.5,7.0,21.0,opening
"Window 1",4.0,0.5,4.0,16.0,opening
```

### Measurements extractable
- **Direct:** all measurements listed — these are the ground truth
- **Wall areas:** sum of wall areas
- **Opening areas:** subtract from wall gross area
- **Net paintable area:** gross wall area − openings

### Limitations
- Requires user to have made measurements in Polycam app before export
- Not automatically generated from 3D scan
- CSV parsing is straightforward — no special challenges

---

## 8. PDF (Floor Plans)

### What it contains
- **2D vector drawings** generated by Polycam from 3D scan
- Walls shown as thick lines
- Doors shown as arc symbols
- Windows shown as parallel lines
- Dimension annotations (text callouts)
- Scale bar (legend)
- Room labels

### Measurements extractable
- **Wall lengths:** measure line lengths in PDF coordinate space
- **Room dimensions:** from dimension callout text
- **Opening sizes:** door/window width from symbol sizing
- **Scale:** derive from scale bar or known dimension annotation

### Limitations
- PDF is a **rendered format** — not raw geometry
- Text extraction via OCR or PDF text parsing
- Line lengths need scale factor (pixels → real units)
- Multi-page PDFs need page-by-page processing

---

## 9. PNG / JPEG (2D Captures)

### What it contains
- **Single images** captured by user or from Polycam's 2D capture mode
- Room photos from the user's camera
- Screenshot of Polycam's floor plan view
- Screenshot of measurement overlay

### Measurements extractable
- **Via AI (GPT-4o Vision):** wall dimensions, door sizes, window sizes, ceiling height, room shape
- **Via scale reference:** if a known object (door, ruler) is in frame, can derive scale
- Without scale reference, AI can provide proportional measurements but not absolute

### Limitations
- **No scale reference** = can only estimate relative proportions, not real-world dimensions
- Requires AI vision to extract measurements (no geometric parsing)
- Image quality affects accuracy

---

## Format Summary Table

| Format | Primary Use | Extractable Dimensions | Parsing Difficulty | Luna Use Case |
|--------|------------|------------------------|-------------------|---------------|
| OBJ | 3D mesh export | Bounding box, wall area, floor area | Easy | ★★★★☆ LiDAR/Room scan |
| GLTF/GLB | 3D mesh export | Bounding box, surface areas | Medium | ★★★★☆ Room scan |
| PLY | Point cloud | Bounding box, estimated wall area | Medium | ★★★☆☆ Dense scan |
| FBX | 3D export | Same as OBJ | Hard | ★★☆☆☆ Rare |
| USDZ | AR format | Bounding box only | Hard | ★☆☆☆☆ Not recommended |
| DXF | CAD floor plan | Wall lengths, dimensions | Medium-Hard | ★★★☆☆ Architectural plans |
| CSV | Measurements | All explicit measurements | Easy | ★★★★★ Direct measurement data |
| PDF | 2D floor plan | Wall lengths, room dims | Medium | ★★★★☆ Vector drawings |
| PNG/JPEG | Photos | AI-extracted dimensions | Easy (via AI) | ★★★★☆ User photos |

---

## Deno Edge Function Considerations

### Environment
- Deno Deploy (Supabase Edge Functions) supports:
  - `Deno.readTextFile()` / `Deno.readFile()` for local files
  - `fetch()` for downloading from URLs or Supabase Storage
  - No `fs` module — use Deno namespace APIs
  - No `canvas` / `DOM` — pure computation only

### Memory Limits
- Edge Functions have ~150MB memory limit
- Large OBJ/PLY files could exceed this
- Strategy: stream-parsing, or reject files > 50MB for 3D formats

### No Native Libraries
- Three.js won't run in Deno Edge (no DOM/canvas)
- OBJ/GLTF/PLY parsing must be done from scratch with pure math
- FBX/USDZ not practical without heavy dependencies

### Recommended Parsing Approach
1. **OBJ:** Custom line-by-line parser (trivial grammar)
2. **GLTF:** JSON.parse + ArrayBuffer views
3. **GLB:** Custom binary parser (well-documented spec)
4. **PLY:** Line parser for ASCII; ArrayBuffer for binary
5. **CSV:** Simple split-by-line + split-by-comma
6. **PDF:** Send to Gemini for structured extraction
7. **PNG/JPEG:** Send to GPT-4o Vision for measurement extraction
