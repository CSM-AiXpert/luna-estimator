/**
 * PLY (Point Cloud) Parser for Luna Estimator
 * Parses ASCII and binary PLY files
 * Extracts: bounding box, floor/ceiling plane detection, wall plane estimation
 * 
 * Note: PLY is a point cloud, not a mesh. Area calculations are estimates
 * based on plane fitting, not direct triangle areas.
 */

export interface PLYParseResult {
  success: boolean;
  error_code?: "UNREADABLE_FILE" | "INVALID_FORMAT" | "NO_DATA";
  format: "ascii" | "binary_little_endian" | "binary_big_endian";
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
    floor: { y_position_ft: number; area_sqft: number | null; confidence: number } | null;
    ceiling: { y_position_ft: number | null; area_sqft: number | null; confidence: number } | null;
    walls: Array<{
      axis: "X" | "Z";
      position_ft: number;
      extent_sqft: number;
      confidence: number;
    }>;
  };
  totalWallArea_sqft: number;
  floorArea_sqft: number | null;
  unit: "meters";
}

interface PlaneCandidate {
  axis: "X" | "Z" | "Y";
  position: number;  // the constant coordinate value
  points: Array<{ x: number; y: number; z: number }>;
  min1: number;  // extent along first non-axis dimension
  max1: number;
  min2: number;  // extent along second non-axis dimension
  max2: number;
}

const METERS_TO_FEET = 3.28084;
const VERTEX_LIMIT = 10_000_000;  // 10M points is a lot but ok
const PLANE_TOLERANCE = 0.15;     // meters — how close to constant Y = same plane
const MIN_POINTS_PER_PLANE = 50;  // minimum points to call it a detected surface
const Y_HISTOGRAM_BINS = 100;     // for finding floor/ceiling planes

/**
 * Parse PLY header to extract format and property definitions
 */
function parseHeader(lines: string[]): {
  format: PLYParseResult["format"];
  properties: Array<{ name: string; type: string }>;
  vertexCount: number;
  hasColors: boolean;
} {
  let format: PLYParseResult["format"] = "ascii";
  let elementVertexCount = 0;
  const properties: Array<{ name: string; type: string }> = [];
  let hasColors = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === "ply") continue;
    
    if (trimmed.startsWith("format ascii")) {
      format = "ascii";
    } else if (trimmed.startsWith("format binary_little_endian")) {
      format = "binary_little_endian";
    } else if (trimmed.startsWith("format binary_big_endian")) {
      format = "binary_big_endian";
    } else if (trimmed.startsWith("element vertex")) {
      elementVertexCount = parseInt(trimmed.split(" ")[2], 10);
    } else if (trimmed.startsWith("property")) {
      const parts = trimmed.split(" ");
      const type = parts[1];
      const name = parts[2];
      properties.push({ name, type });
      if (["red", "green", "blue", "r", "g", "b"].includes(name.toLowerCase())) {
        hasColors = true;
      }
    } else if (trimmed === "end_header") {
      break;
    }
  }

  return { format, properties, vertexCount: elementVertexCount, hasColors };
}

/**
 * Find property indices by name
 */
function getPropIndices(properties: Array<{ name: string; type: string }>) {
  const getIdx = (name: string) => properties.findIndex(p => p.toLowerCase() === name.toLowerCase());
  return {
    x: getIdx("x"),
    y: getIdx("y"),
    z: getIdx("z"),
    red: getIdx("red") !== -1 ? getIdx("red") : getIdx("r"),
    green: getIdx("green") !== -1 ? getIdx("green") : getIdx("g"),
    blue: getIdx("blue") !== -1 ? getIdx("blue") : getIdx("b"),
  };
}

/**
 * Parse ASCII PLY
 */
function parseASCII(headerLines: string[], dataLines: string[], properties: Array<{ name: string; type: string }>): Float32Array {
  const props = getPropIndices(properties);
  if (props.x === -1 || props.y === -1 || props.z === -1) {
    throw new Error("PLY missing required x, y, z properties");
  }

  // Count valid lines
  let count = 0;
  for (const line of dataLines) {
    if (line.trim()) count++;
  }

  const vertices = new Float32Array(count * 3);
  let idx = 0;
  
  for (const line of dataLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    
    const x = parseFloat(parts[props.x]);
    const y = parseFloat(parts[props.y]);
    const z = parseFloat(parts[props.z]);
    
    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
    
    vertices[idx++] = x;
    vertices[idx++] = y;
    vertices[idx++] = z;
  }

  return vertices.slice(0, idx);
}

/**
 * Parse binary PLY
 */
function parseBinary(buffer: ArrayBuffer, headerLines: string[], properties: Array<{ name: string; type: string }>, isBigEndian: boolean): Float32Array {
  const props = getPropIndices(properties);
  if (props.x === -1 || props.y === -1 || props.z === -1) {
    throw new Error("PLY missing required x, y, z properties");
  }

  // Calculate property byte offsets
  const propOffsets: Array<{ index: number; offset: number; size: number }> = [];
  let offset = 0;
  const listProps: Array<{ index: number; offset: number; valueType: string; countType: string }> = [];
  
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    if (prop.type.startsWith("list")) {
      const [countType, valueType] = prop.type.slice(5, -1).split(" ");
      listProps.push({ index: i, offset, valueType, countType });
      // List: count (1-4 bytes) + values
      offset += getTypeSize(countType);
    } else {
      propOffsets.push({ index: i, offset, size: getTypeSize(prop.type) });
      offset += getTypeSize(prop.type);
    }
  }

  const vertexSize = offset;
  const headerEndOffset = findEndHeaderOffset(buffer);
  const dataOffset = headerEndOffset;

  const dv = isBigEndian ? new DataView(buffer) : new DataView(buffer);
  const littleEndian = !isBigEndian;

  // Count vertices
  const byteLen = buffer.byteLength - dataOffset;
  if (byteLen < 0) return new Float32Array(0);
  const vertexCount = Math.floor(byteLen / vertexSize);

  const vertices = new Float32Array(vertexCount * 3);
  let outIdx = 0;

  for (let v = 0; v < vertexCount; v++) {
    const base = dataOffset + v * vertexSize;
    
    // Skip list properties for now (not typical in scan data)
    let currentOffset = 0;
    for (const { index, offset: po, size } of propOffsets) {
      if (index === props.x || index === props.y || index === props.z) {
        const val = readType(dv, base + currentOffset + po, prop.type, littleEndian);
        if (index === props.x) vertices[outIdx * 3] = val;
        if (index === props.y) vertices[outIdx * 3 + 1] = val;
        if (index === props.z) vertices[outIdx * 3 + 2] = val;
      }
    }
    outIdx++;
  }

  return vertices.slice(0, outIdx * 3);
}

function getTypeSize(type: string): number {
  switch (type) {
    case "char": case "uchar": case "int8": case "uint8": return 1;
    case "short": case "ushort": case "int16": case "uint16": return 2;
    case "int": case "uint": case "int32": case "uint32": case "float": case "float32": return 4;
    case "double": case "float64": case "int64": case "uint64": return 8;
    default: return 1;
  }
}

function readType(dv: DataView, offset: number, type: string, little: boolean): number {
  switch (type) {
    case "char": case "int8": return dv.getInt8(offset);
    case "uchar": case "uint8": return dv.getUint8(offset);
    case "short": case "int16": return dv.getInt16(offset, little);
    case "ushort": case "uint16": return dv.getUint16(offset, little);
    case "int": case "int32": return dv.getInt32(offset, little);
    case "uint": case "uint32": return dv.getUint32(offset, little);
    case "float": case "float32": return dv.getFloat32(offset, little);
    case "double": case "float64": return dv.getFloat64(offset, little);
    default: return dv.getFloat64(offset, little);
  }
}

function findEndHeaderOffset(buffer: ArrayBuffer): number {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  let offset = 0;
  let line = "";
  
  for (let i = 0; i < buffer.byteLength - 8; i++) {
    const char = bytes[i];
    if (char === 10) { // newline
      if (line.trim() === "end_header") return i + 1;
      line = "";
    } else {
      line += String.fromCharCode(char);
    }
  }
  return buffer.byteLength;
}

/**
 * Find dominant horizontal planes (floor/ceiling) using histogram
 */
function findHorizontalPlanes(vertices: Float32Array): { floor: PlaneCandidate | null; ceiling: PlaneCandidate | null } {
  if (vertices.length < 3) return { floor: null, ceiling: null };

  // Build histogram of Y values
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < vertices.length; i += 3) {
    const y = vertices[i];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (!isFinite(minY)) return { floor: null, ceiling: null };

  const binWidth = (maxY - minY) / Y_HISTOGRAM_BINS || 0.01;
  const bins = new Int32Array(Y_HISTOGRAM_BINS);

  for (let i = 1; i < vertices.length; i += 3) {
    const bin = Math.floor((vertices[i] - minY) / binWidth);
    if (bin >= 0 && bin < Y_HISTOGRAM_BINS) bins[bin]++;
  }

  // Find dominant floor plane (lowest significant peak)
  // Floor is usually at lowest Y
  let floorBin = 0;
  let maxFloorCount = 0;
  for (let i = 0; i < Math.floor(Y_HISTOGRAM_BINS * 0.3); i++) { // floor likely in bottom 30%
    if (bins[i] > maxFloorCount && bins[i] > MIN_POINTS_PER_PLANE) {
      maxFloorCount = bins[i];
      floorBin = i;
    }
  }

  // Find ceiling plane (highest significant peak)
  let ceilBin = Y_HISTOGRAM_BINS - 1;
  let maxCeilCount = 0;
  for (let i = Math.floor(Y_HISTOGRAM_BINS * 0.7); i < Y_HISTOGRAM_BINS; i++) {
    if (bins[i] > maxCeilCount && bins[i] > MIN_POINTS_PER_PLANE) {
      maxCeilCount = bins[i];
      ceilBin = i;
    }
  }

  const floorY = minY + (floorBin + 0.5) * binWidth;
  const ceilY = minY + (ceilBin + 0.5) * binWidth;

  // Collect points near floor plane
  const floorPoints: Array<{ x: number; y: number; z: number }> = [];
  const ceilPoints: Array<{ x: number; y: number; z: number }> = [];
  let floorMinX = Infinity, floorMaxX = -Infinity, floorMinZ = Infinity, floorMaxZ = -Infinity;
  let ceilMinX = Infinity, ceilMaxX = -Infinity, ceilMinZ = Infinity, ceilMaxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    if (Math.abs(y - floorY) < PLANE_TOLERANCE) {
      floorPoints.push({ x, y, z });
      if (x < floorMinX) floorMinX = x; if (x > floorMaxX) floorMaxX = x;
      if (z < floorMinZ) floorMinZ = z; if (z > floorMaxZ) floorMaxZ = z;
    }
    if (Math.abs(y - ceilY) < PLANE_TOLERANCE) {
      ceilPoints.push({ x, y, z });
      if (x < ceilMinX) ceilMinX = x; if (x > ceilMaxX) ceilMaxX = x;
      if (z < ceilMinZ) ceilMinZ = z; if (z > ceilMaxZ) ceilMaxZ = z;
    }
  }

  const floorConfidence = floorPoints.length > MIN_POINTS_PER_PLANE
    ? Math.min(floorPoints.length / 500, 0.95)
    : 0;
  const ceilConfidence = ceilPoints.length > MIN_POINTS_PER_PLANE
    ? Math.min(ceilPoints.length / 500, 0.95)
    : 0;

  return {
    floor: floorPoints.length > MIN_POINTS_PER_PLANE ? {
      axis: "Y" as const,
      position: floorY,
      points: floorPoints,
      min1: floorMinX, max1: floorMaxX,
      min2: floorMinZ, max2: floorMaxZ,
    } : null,
    ceiling: ceilPoints.length > MIN_POINTS_PER_PLANE ? {
      axis: "Y" as const,
      position: ceilY,
      points: ceilPoints,
      min1: ceilMinX, max1: ceilMaxX,
      min2: ceilMinZ, max2: ceilMaxZ,
    } : null,
  };
}

/**
 * Find dominant vertical planes (walls) using histogram on X and Z
 */
function findVerticalPlanes(vertices: Float32Array, axis: "X" | "Z"): PlaneCandidate[] {
  if (vertices.length < 3) return [];

  // Get range
  let min = Infinity, max = -Infinity;
  const axisIdx = axis === "X" ? 0 : 2;
  for (let i = axisIdx; i < vertices.length; i += 3) {
    const v = vertices[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (!isFinite(min)) return [];

  const binWidth = (max - min) / 20 || 0.1; // 20 bins for walls
  const bins = new Int32Array(20);
  const binCenters: number[] = [];
  for (let i = 0; i < 20; i++) binCenters.push(min + (i + 0.5) * binWidth);

  for (let i = axisIdx; i < vertices.length; i += 3) {
    const bin = Math.floor((vertices[i] - min) / binWidth);
    if (bin >= 0 && bin < 20) bins[bin]++;
  }

  // Find peaks (wall positions)
  const planes: PlaneCandidate[] = [];
  for (let b = 0; b < 20; b++) {
    if (bins[b] < MIN_POINTS_PER_PLANE) continue;
    
    // Check if this is a local maximum
    const prev = b > 0 ? bins[b - 1] : 0;
    const next = b < 19 ? bins[b + 1] : 0;
    if (bins[b] <= prev || bins[b] <= next) continue;

    const wallPos = binCenters[b];
    const wallPoints: Array<{ x: number; y: number; z: number }> = [];
    let wallMin1 = Infinity, wallMax1 = -Infinity, wallMin2 = Infinity, wallMax2 = -Infinity;
    // Other axes for this wall
    const otherIdx1 = axis === "X" ? 1 : 1; // Y
    const otherIdx2 = axis === "X" ? 2 : 0; // Z or X

    for (let i = 0; i < vertices.length; i += 3) {
      const pos = vertices[i + axisIdx];
      if (Math.abs(pos - wallPos) < PLANE_TOLERANCE) {
        const y = vertices[i + otherIdx1];
        const o = vertices[i + otherIdx2];
        wallPoints.push({ 
          x: vertices[i], y, 
          z: vertices[i + 2] 
        });
        if (y < wallMin1) wallMin1 = y;
        if (y > wallMax1) wallMax1 = y;
        if (o < wallMin2) wallMin2 = o;
        if (o > wallMax2) wallMax2 = o;
      }
    }

    const extent1 = wallMax1 - wallMin1; // height
    const extent2 = wallMax2 - wallMin2; // length along wall
    const area = extent1 * extent2 * METERS_TO_FEET * METERS_TO_FEET;
    
    planes.push({
      axis,
      position: wallPos,
      points: wallPoints,
      min1: wallMin1, max1: wallMax1,
      min2: wallMin2, max2: wallMax2,
    });
  }

  return planes;
}

/**
 * Parse PLY content (string for ASCII, ArrayBuffer for binary)
 */
export function parsePLY(content: string | ArrayBuffer): PLYParseResult {
  let lines: string[] = [];
  let dataOffset = 0;

  if (typeof content === "string") {
    lines = content.split("\n");
    // Find end_header line index
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "end_header") {
        dataOffset = i + 1;
        break;
      }
    }
  }

  const headerLines = lines.slice(0, dataOffset || lines.length);
  const { format, properties, vertexCount: declaredCount, hasColors } = parseHeader(headerLines);

  if (declaredCount === 0) {
    return { success: false, error_code: "NO_DATA", format, vertexCount: 0, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, planes: { floor: null, ceiling: null, walls: [] }, totalWallArea_sqft: 0, floorArea_sqft: null, unit: "meters" } as any;
  }

  let vertices: Float32Array;

  if (typeof content === "string") {
    const dataLines = lines.slice(dataOffset);
    vertices = parseASCII(headerLines, dataLines, properties);
  } else {
    const isBigEndian = format === "binary_big_endian";
    vertices = parseBinary(content, headerLines, properties, isBigEndian);
  }

  if (vertices.length === 0) {
    return { success: false, error_code: "NO_DATA", format, vertexCount: 0, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, planes: { floor: null, ceiling: null, walls: [] }, totalWallArea_sqft: 0, floorArea_sqft: null, unit: "meters" } as any;
  }

  if (vertices.length / 3 > VERTEX_LIMIT) {
    return { success: false, error_code: "UNREADABLE_FILE", format, vertexCount: vertices.length / 3, boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, dimensions: { width_ft: 0, depth_ft: 0, height_ft: 0 }, planes: { floor: null, ceiling: null, walls: [] }, totalWallArea_sqft: 0, floorArea_sqft: null, unit: "meters" } as any;
  }

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  // Find planes
  const { floor, ceiling } = findHorizontalPlanes(vertices);
  const xWalls = findVerticalPlanes(vertices, "X");
  const zWalls = findVerticalPlanes(vertices, "Z");
  const allWalls = [...xWalls, ...zWalls];

  // Compute areas
  let totalWallArea = 0;
  for (const w of allWalls) {
    const height = (w.max1 - w.min1) * METERS_TO_FEET;
    const length = (w.max2 - w.min2) * METERS_TO_FEET;
    totalWallArea += height * length;
  }

  const floorArea = floor
    ? (floor.max1 - floor.min1) * (floor.max2 - floor.min2) * METERS_TO_FEET * METERS_TO_FEET
    : null;

  return {
    success: true,
    format,
    vertexCount: vertices.length / 3,
    boundingBox: { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } },
    dimensions: {
      width_ft: Math.max((maxX - minX) * METERS_TO_FEET, 0.1),
      depth_ft: Math.max((maxZ - minZ) * METERS_TO_FEET, 0.1),
      height_ft: Math.max((maxY - minY) * METERS_TO_FEET, 0.1),
    },
    planes: {
      floor: floor ? {
        y_position_ft: floor.position * METERS_TO_FEET,
        area_sqft: floorArea,
        confidence: Math.min(floor.points.length / 500, 0.95),
      } : null,
      ceiling: ceiling ? {
        y_position_ft: ceiling.position * METERS_TO_FEET,
        area_sqft: null,
        confidence: Math.min(ceiling.points.length / 500, 0.95),
      } : null,
      walls: allWalls.map(w => ({
        axis: w.axis,
        position_ft: w.position * METERS_TO_FEET,
        extent_sqft: (w.max1 - w.min1) * (w.max2 - w.min2) * METERS_TO_FEET * METERS_TO_FEET,
        confidence: Math.min(w.points.length / 500, 0.95),
      })),
    },
    totalWallArea_sqft: totalWallArea,
    floorArea_sqft: floorArea,
    unit: "meters",
  };
}

/**
 * Read PLY file from path
 */
export async function parsePLYFile(path: string): Promise<PLYParseResult> {
  const isASCII = path.endsWith(".ply") && false; // can't auto-detect from path for binary
  // Try reading as text first, fall back to binary
  try {
    const text = await Deno.readTextFile(path);
    return parsePLY(text);
  } catch {
    const buffer = await Deno.readFile(path);
    return parsePLY(buffer);
  }
}

/**
 * Convert to normalized extraction result
 */
export function toNormalizedResult(plyResult: PLYParseResult) {
  return {
    room_shape: "rectangular",
    ceiling_height_ft: plyResult.dimensions.height_ft,
    floor_area_sqft: plyResult.floorArea_sqft,
    gross_wall_area_sqft: plyResult.totalWallArea_sqft,
    wall_count: plyResult.planes.walls.length,
    confidence: 0.75, // PLY is estimated, lower confidence
    source: "point_cloud" as const,
  };
}
