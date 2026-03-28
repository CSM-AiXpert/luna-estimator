/**
 * OBJ File Parser for Luna Estimator
 * Parses Wavefront OBJ format 3D mesh files
 * Extracts: bounding box, dimensions, surface areas, wall detection
 * 
 * Polycam OBJ files use METERS as the unit.
 */

export interface OBJParseResult {
  success: boolean;
  error_code?: "UNREADABLE_FILE" | "INVALID_FORMAT" | "NO_DATA";
  vertexCount: number;
  faceCount: number;
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
    floor: number;     // sq ft
    ceiling: number;   // sq ft
    walls: number;      // sq ft (total)
  };
  wallDetails: Array<{
    normal: { x: number; y: number; z: number };
    area_sqft: number;
    direction: "X+" | "X-" | "Z+" | "Z-" | "unknown";
  }>;
  unit: "meters";
  rawVertices?: never;  // Not included to save memory
}

interface RawFace {
  vIndices: number[];
  normal: { x: number; y: number; z: number };
  area: number;
}

const METERS_TO_FEET = 3.28084;
const VERTEX_LIMIT = 2_000_000;   // Safety: reject files with >2M vertices
const FACE_LIMIT = 2_000_000;      // Safety: reject files with >2M faces
const NORMAL_TOLERANCE = 0.1;      // How close to 0 Y-component = vertical wall
const VERTICAL_THRESHOLD = 0.15;   // If |normal.y| < this, it's a wall

/**
 * Parse an OBJ file string and extract room measurements
 */
export async function parseOBJ(content: string): Promise<OBJParseResult> {
  const lines = content.split("\n");
  
  const vertices: Array<{ x: number; y: number; z: number }> = [];
  const normals: Array<{ x: number; y: number; z: number }> = [];
  const faces: RawFace[] = [];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];

    if (cmd === "v") {
      if (parts.length < 4) continue;
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      
      if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
      
      vertices.push({ x, y, z });
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);

    } else if (cmd === "vn") {
      if (parts.length < 4) continue;
      const nx = parseFloat(parts[1]);
      const ny = parseFloat(parts[2]);
      const nz = parseFloat(parts[3]);
      if (!isNaN(nx) && !isNaN(ny) && !isNaN(nz)) {
        normals.push({ x: nx, y: ny, z: nz });
      }

    } else if (cmd === "f") {
      // Face: f v1 v2 v3 [v4] — triangulate if quad
      const faceVertices: number[] = [];
      for (let i = 1; i < parts.length; i++) {
        const idx = parseInt(parts[i].split("/")[0], 10);
        if (!isNaN(idx) && idx !== 0) {
          // OBJ indices are 1-based; negative = relative
          const absoluteIdx = idx < 0 ? vertices.length + idx + 1 : idx;
          faceVertices.push(absoluteIdx - 1);
        }
      }

      // Triangulate: fan from first vertex
      for (let i = 1; i < faceVertices.length - 1; i++) {
        const i0 = faceVertices[0];
        const i1 = faceVertices[i];
        const i2 = faceVertices[i + 1];

        if (i0 >= vertices.length || i1 >= vertices.length || i2 >= vertices.length) continue;

        const v0 = vertices[i0];
        const v1 = vertices[i1];
        const v2 = vertices[i2];

        // Compute face normal via cross product
        const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z;
        const bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;
        
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;
        
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 1e-10) continue;  // Degenerate

        const normal = { x: nx / len, y: ny / len, z: nz / len };
        
        // Triangle area = |cross| / 2
        const area = len / 2;

        faces.push({ vIndices: [i0, i1, i2], normal, area });
      }
    }
  }

  // Validate
  if (vertices.length === 0) {
    return { success: false, error_code: "NO_DATA", vertexCount: 0, faceCount: 0 } as any;
  }
  if (vertices.length > VERTEX_LIMIT) {
    return { success: false, error_code: "UNREADABLE_FILE", vertexCount: vertices.length, faceCount: faces.length } as any;
  }
  if (faces.length > FACE_LIMIT) {
    return { success: false, error_code: "UNREADABLE_FILE", vertexCount: vertices.length, faceCount: faces.length } as any;
  }

  // Compute dimensions in feet
  const width_ft  = (maxX - minX) * METERS_TO_FEET;
  const depth_ft  = (maxZ - minZ) * METERS_TO_FEET;
  const height_ft = (maxY - minY) * METERS_TO_FEET;

  // Classify faces as floor, ceiling, or wall
  let floorArea = 0;
  let ceilingArea = 0;
  let wallArea = 0;
  const wallDetails: OBJParseResult["wallDetails"] = [];

  // Floor: normal.y ≈ 1 (pointing up)
  // Ceiling: normal.y ≈ -1 (pointing down)
  // Wall: normal.y ≈ 0 (horizontal, i.e., vertical surface)
  const FLOOR_THRESHOLD = 0.7;   // normal.y > 0.7 → floor
  const CEILING_THRESHOLD = -0.7; // normal.y < -0.7 → ceiling

  for (const face of faces) {
    const { normal, area } = face;
    const area_sqft = area * METERS_TO_FEET * METERS_TO_FEET;

    if (normal.y > FLOOR_THRESHOLD) {
      // Floor — project to XZ plane
      floorArea += area_sqft;

    } else if (normal.y < CEILING_THRESHOLD) {
      // Ceiling
      ceilingArea += area_sqft;

    } else if (Math.abs(normal.y) < VERTICAL_THRESHOLD) {
      // Wall — determine direction from normal X/Z
      wallArea += area_sqft;

      let direction: OBJParseResult["wallDetails"][0]["direction"] = "unknown";
      if (normal.x > 0.5) direction = "X+";
      else if (normal.x < -0.5) direction = "X-";
      else if (normal.z > 0.5) direction = "Z+";
      else if (normal.z < -0.5) direction = "Z-";

      wallDetails.push({ normal, area_sqft, direction });
    }
  }

  // Floor area: use bounding box projection as primary, face sum as secondary
  const projectedFloorArea = width_ft * depth_ft;
  const computedFloorArea = floorArea > 0 ? floorArea : projectedFloorArea;
  const computedCeilingArea = ceilingArea > 0 ? ceilingArea : projectedFloorArea;

  return {
    success: true,
    vertexCount: vertices.length,
    faceCount: faces.length,
    boundingBox: { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } },
    dimensions: {
      width_ft: Math.max(width_ft, 0.1),
      depth_ft: Math.max(depth_ft, 0.1),
      height_ft: Math.max(height_ft, 0.1),
    },
    surfaceAreas: {
      floor: computedFloorArea,
      ceiling: computedCeilingArea,
      walls: wallArea,
    },
    wallDetails,
    unit: "meters",
  };
}

/**
 * Parse OBJ from a Deno file handle or string
 */
export async function parseOBJFile(path: string): Promise<OBJParseResult> {
  const content = await Deno.readTextFile(path);
  return parseOBJ(content);
}

/**
 * Convert to normalized extraction result
 */
export function toNormalizedResult(objResult: OBJParseResult) {
  return {
    room_shape: "rectangular", // OBJ bounding box is always rectangular
    ceiling_height_ft: objResult.dimensions.height_ft,
    floor_area_sqft: objResult.surfaceAreas.floor,
    gross_wall_area_sqft: objResult.surfaceAreas.walls,
    wall_count: objResult.wallDetails.length,
    confidence: 0.95,
    source: "geometric_parser" as const,
  };
}
