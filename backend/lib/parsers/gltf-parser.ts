/**
 * GLTF / GLB Parser for Luna Estimator
 * Parses both GLTF (JSON + external buffers) and GLB (binary) formats
 * Extracts: bounding box, dimensions, surface areas
 * 
 * GLTF uses METERS as the canonical unit.
 */

export interface GLTFParseResult {
  success: boolean;
  error_code?: "UNREADABLE_FILE" | "INVALID_FORMAT" | "NO_DATA";
  format: "gltf" | "glb";
  nodeCount: number;
  meshCount: number;
  primitiveCount: number;
  totalTriangleCount: number;
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
  unit: "meters";
}

interface GLTFAccessor {
  bufferView: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
}

interface GLTFPrimitive {
  attributes: { POSITION?: number; NORMAL?: number; indices?: number };
  material?: number;
  indices?: number;
}

interface GLTFMesh {
  primitives: GLTFPrimitive[];
}

interface GLTFNode {
  mesh?: number;
  children?: number[];
}

const METERS_TO_FEET = 3.28084;
const VERTEX_LIMIT = 2_000_000;
const TRIANGLE_LIMIT = 2_000_000;

/**
 * Parse a GLTF (JSON format) string
 * Binary buffers must be fetched separately or embedded as data URIs
 */
export function parseGLTF(gltf: any, binaryData?: ArrayBuffer): GLTFParseResult {
  if (!gltf || !gltf.meshes) {
    return { success: false, error_code: "INVALID_FORMAT", format: "gltf", nodeCount: 0, meshCount: 0, primitiveCount: 0, totalTriangleCount: 0, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, surfaceAreas: { floor: 0, ceiling: 0, walls: 0 }, unit: "meters" } as any;
  }

  const meshes: GLTFMesh[] = gltf.meshes || [];
  const nodes: GLTFNode[] = gltf.nodes || [];
  const accessors: GLTFAccessor[] = gltf.accessors || [];
  const bufferViews = gltf.bufferViews || [];

  // Collect all mesh primitives
  let totalTriangles = 0;
  let globalMinX = Infinity, globalMaxX = -Infinity;
  let globalMinY = Infinity, globalMaxY = -Infinity;
  let globalMinZ = Infinity, globalMaxZ = -Infinity;
  let totalFloorArea = 0;
  let totalCeilingArea = 0;
  let totalWallArea = 0;

  for (const mesh of meshes) {
    for (const prim of mesh.primitives) {
      const posAccessorIdx = prim.attributes?.POSITION;
      const normalAccessorIdx = prim.attributes?.NORMAL;

      if (posAccessorIdx === undefined) continue;

      const posAccessor = accessors[posAccessorIdx];
      if (!posAccessor) continue;

      // Use accessor's min/max if available (fast path)
      if (posAccessor.min && posAccessor.max && posAccessor.min.length >= 3) {
        const [aminX, aminY, aminZ] = posAccessor.min;
        const [amaxX, amaxY, amaxZ] = posAccessor.max;
        globalMinX = Math.min(globalMinX, aminX);
        globalMaxX = Math.max(globalMaxX, amaxX);
        globalMinY = Math.min(globalMinY, aminY);
        globalMaxY = Math.max(globalMaxY, amaxY);
        globalMinZ = Math.min(globalMinZ, aminZ);
        globalMaxZ = Math.max(globalMaxZ, amaxZ);
      }

      // Count triangles from indices or infer from vertex count
      const indexAccessor = prim.indices !== undefined ? accessors[prim.indices] : null;
      const vertCount = posAccessor.count;
      const triCount = indexAccessor
        ? indexAccessor.count / 3
        : Math.floor(vertCount / 3);
      totalTriangles += triCount;

      // Estimate areas from bounding box contribution
      const primWidth = posAccessor.max && posAccessor.min ? posAccessor.max[0] - posAccessor.min[0] : 0;
      const primDepth = posAccessor.max && posAccessor.min ? posAccessor.max[2] - posAccessor.min[2] : 0;
      const primHeight = posAccessor.max && posAccessor.min ? posAccessor.max[1] - posAccessor.min[1] : 0;
      
      // Floor: bounding box projected on XZ
      totalFloorArea += primWidth * primDepth * METERS_TO_FEET * METERS_TO_FEET;
      totalCeilingArea += primWidth * primDepth * METERS_TO_FEET * METERS_TO_FEET;
      // Wall estimate: perimeter × height
      totalWallArea += 2 * (primWidth + primDepth) * primHeight * METERS_TO_FEET * METERS_TO_FEET;
    }
  }

  // If no min/max from accessors, we can't compute bounding box
  if (!isFinite(globalMinX)) {
    return { success: false, error_code: "NO_DATA", format: "gltf", nodeCount: nodes.length, meshCount: meshes.length, primitiveCount: 0, totalTriangleCount: 0, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, surfaceAreas: { floor: 0, ceiling: 0, walls: 0 }, unit: "meters" } as any;
  }

  const width_ft  = (globalMaxX - globalMinX) * METERS_TO_FEET;
  const depth_ft  = (globalMaxZ - globalMinZ) * METERS_TO_FEET;
  const height_ft = (globalMaxY - globalMinY) * METERS_TO_FEET;

  return {
    success: true,
    format: "gltf",
    nodeCount: nodes.length,
    meshCount: meshes.length,
    primitiveCount: meshes.reduce((sum, m) => sum + m.primitives.length, 0),
    totalTriangleCount: totalTriangles,
    boundingBox: {
      min: { x: globalMinX, y: globalMinY, z: globalMinZ },
      max: { x: globalMaxX, y: globalMaxY, z: globalMaxZ },
    },
    dimensions: {
      width_ft: Math.max(width_ft, 0.1),
      depth_ft: Math.max(depth_ft, 0.1),
      height_ft: Math.max(height_ft, 0.1),
    },
    surfaceAreas: {
      floor: width_ft * depth_ft,
      ceiling: width_ft * depth_ft,
      walls: 2 * (width_ft + depth_ft) * height_ft,
    },
    unit: "meters",
  };
}

/**
 * Parse a GLB (binary GLTF) from ArrayBuffer
 * GLB format: 12-byte header + JSON chunk + binary chunk(s)
 */
export function parseGLB(buffer: ArrayBuffer): GLTFParseResult {
  const dv = new DataView(buffer);
  
  // GLB Header: magic(4) + version(4) + length(4)
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546C67) { // "glTF" in little-endian
    return { success: false, error_code: "INVALID_FORMAT", format: "glb", nodeCount: 0, meshCount: 0, primitiveCount: 0, totalTriangleCount: 0, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, surfaceAreas: { floor: 0, ceiling: 0, walls: 0 }, unit: "meters" } as any;
  }

  const version = dv.getUint32(4, true);
  const length = dv.getUint32(8, true);

  // Chunk 0: JSON
  const chunk0Length = dv.getUint32(12, true);
  const chunk0Type = dv.getUint32(16, true); // 0x4E4F534A = "JSON"
  
  if (chunk0Type !== 0x4E4F534A) {
    return { success: false, error_code: "INVALID_FORMAT", format: "glb", nodeCount: 0, meshCount: 0, primitiveCount: 0, totalTriangleCount: 0, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, surfaceAreas: { floor: 0, ceiling: 0, walls: 0 }, unit: "meters" } as any;
  }

  const jsonBytes = new Uint8Array(buffer, 20, chunk0Length);
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(jsonBytes);
  
  let gltf: any;
  try {
    gltf = JSON.parse(jsonString);
  } catch {
    return { success: false, error_code: "INVALID_FORMAT", format: "glb", nodeCount: 0, meshCount: 0, primitiveCount: 0, totalTriangleCount: 0, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, surfaceAreas: { floor: 0, ceiling: 0, walls: 0 }, unit: "meters" } as any;
  }

  // Extract binary data from chunk 1 if present
  let binaryData: ArrayBuffer | undefined;
  if (buffer.byteLength > 20 + chunk0Length + 8) {
    const chunk1Offset = 20 + chunk0Length;
    const chunk1Length = dv.getUint32(chunk1Offset, true);
    const chunk1Type = dv.getUint32(chunk1Offset + 4, true); // 0x004E4942 = "BIN\0"
    if (chunk1Type === 0x004E4942) {
      binaryData = buffer.slice(chunk1Offset + 8, chunk1Offset + 8 + chunk1Length);
    }
  }

  return parseGLTF(gltf, binaryData);
}

/**
 * Auto-detect and parse GLTF or GLB
 */
export function parseGLTFAny(content: string | ArrayBuffer, formatHint?: "gltf" | "glb"): GLTFParseResult {
  if (formatHint === "glb" || (formatHint !== "gltf" && content instanceof ArrayBuffer)) {
    return parseGLB(content as ArrayBuffer);
  }
  
  // Assume string = GLTF JSON
  if (typeof content === "string") {
    try {
      const gltf = JSON.parse(content);
      return parseGLTF(gltf);
    } catch {
      return { success: false, error_code: "INVALID_FORMAT", format: "gltf", nodeCount: 0, meshCount: 0, primitiveCount: 0, totalTriangleCount: 0, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, surfaceAreas: { floor: 0, ceiling: 0, walls: 0 }, unit: "meters" } as any;
    }
  }

  return parseGLB(content);
}

/**
 * Read GLTF/GLB from a Deno file path
 */
export async function parseGLTFFile(path: string, format?: "gltf" | "glb"): Promise<GLTFParseResult> {
  const isGLB = path.endsWith(".glb");
  const content = isGLB 
    ? await Deno.readFile(path)
    : await Deno.readTextFile(path);
  return parseGLTFAny(content as string | ArrayBuffer, isGLB ? "glb" : format);
}

/**
 * Convert to normalized extraction result
 */
export function toNormalizedResult(gltfResult: GLTFParseResult) {
  return {
    room_shape: "rectangular",
    ceiling_height_ft: gltfResult.dimensions.height_ft,
    floor_area_sqft: gltfResult.surfaceAreas.floor,
    gross_wall_area_sqft: gltfResult.surfaceAreas.walls,
    wall_count: 4, // Typical room has 4 walls
    confidence: 0.95,
    source: "geometric_parser" as const,
  };
}
