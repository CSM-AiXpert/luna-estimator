import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { Database } from "@/lib/supabase/types"

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}

// Default unit prices for materials (in cents to avoid floating point issues, stored as dollars)
const DEFAULT_PRICES = {
  drywall_4x8_1_2: { unit_cost: 12.50, unit: "sheet", brand: "Gold Bond", part_number: "611612" },
  drywall_4x12_1_2: { unit_cost: 18.75, unit: "sheet", brand: "Gold Bond", part_number: "611622" },
  drywall_4x8_5_8: { unit_cost: 15.00, unit: "sheet", brand: "Gold Bond", part_number: "611614" },
  paint_gallon: { unit_cost: 45.00, unit: "gal", brand: "Sherwin-Williams", part_number: "SW7006" },
  paint_primer: { unit_cost: 35.00, unit: "gal", brand: "Kilz", part_number: "KLP-0001" },
  joint_compound: { unit_cost: 8.50, unit: "bag", brand: "Sheetrock", part_number: "620012" },
  mesh_tape: { unit_cost: 4.25, unit: "roll", brand: "FibaFuse", part_number: "FFT200" },
  paper_tape: { unit_cost: 3.75, unit: "roll", brand: "Sheetrock", part_number: "386003" },
  coarse_screws: { unit_cost: 7.00, unit: "lb", brand: "GRK", part_number: "42200" },
  fine_screws: { unit_cost: 7.50, unit: "lb", brand: "GRK", part_number: "42210" },
  trim_base_3_1_4: { unit_cost: 3.25, unit: "lf", brand: "MDF", part_number: "BASE-314" },
  trim_casing_2_1_4: { unit_cost: 2.75, unit: "lf", brand: "MDF", part_number: "CASE-214" },
  cove_corner: { unit_cost: 2.50, unit: "ea", brand: "DXF", part_number: "CC-225" },
}

interface MaterialLineItem {
  category: string
  description: string
  supplier_part_number: string
  brand: string
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  is_ordered: boolean
  sort_order: number
  notes: string
}

interface GenerationResult {
  materials_order_id: string
  items: MaterialLineItem[]
  totals: {
    drywall_sqft: number
    paint_sqft: number
    trim_lf: number
    subtotal: number
    tax_amount: number
    total: number
  }
}

export async function POST(req: NextRequest) {
  try {
    const { project_id, paint_coats = 2, drywall_size = "4x8_1/2" } = await req.json()

    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 })
    }

    // Create Supabase server client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getSupabase()) as any

    // 1. Fetch project with organization
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*, organization_id, customer:customers(first_name, last_name)")
      .eq("id", project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // 2. Fetch rooms with measurements
    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("*, measurements(*)")
      .eq("project_id", project_id)

    if (roomsError) {
      return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 })
    }

    // 3. Fetch latest estimate if exists
    const { data: estimate } = await supabase
      .from("estimates")
      .select("id, subtotal, total")
      .eq("project_id", project_id)
      .order("version", { ascending: false })
      .limit(1)
      .single()

    // 4. Calculate material quantities from measurements
    const calculations = calculateMaterials(rooms, paint_coats, drywall_size)

    // 5. Build line items
    const items: MaterialLineItem[] = []
    let sortOrder = 0

    // --- DRYWALL ---
    const dw = calculations.drywall
    if (dw.sheets_4x8 > 0) {
      const price = DEFAULT_PRICES.drywall_4x8_1_2
      const total = dw.sheets_4x8 * price.unit_cost
      items.push({
        category: "Drywall",
        description: `Drywall 4'x8' 1/2" sheets`,
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: dw.sheets_4x8,
        unit: "sheet",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${dw.net_sqft} net sqft − ${dw.cutout_sqft} sqft cutouts = ${dw.coverable_sqft} sqft ÷ 32 sqft/sheet + 10% waste`,
      })
    }
    if (dw.sheets_4x12 > 0) {
      const price = DEFAULT_PRICES.drywall_4x12_1_2
      const total = dw.sheets_4x12 * price.unit_cost
      items.push({
        category: "Drywall",
        description: `Drywall 4'x12' 1/2" sheets`,
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: dw.sheets_4x12,
        unit: "sheet",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: dw.sheets_4x12 > 0 ? `${dw.net_sqft} sqft + 10% waste` : "",
      })
    }

    // --- PAINT ---
    if (calculations.paint.gallons > 0) {
      const price = DEFAULT_PRICES.paint_gallon
      const total = calculations.paint.gallons * price.unit_cost
      items.push({
        category: "Paint",
        description: `Interior paint — ${paint_coats} coats`,
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: Math.ceil(calculations.paint.gallons),
        unit: "gal",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${calculations.paint.sqft} sqft ÷ 350 sqft/gal × ${paint_coats} coats = ${calculations.paint.gallons.toFixed(2)} gal`,
      })
    }
    if (calculations.paint.primer_gallons > 0) {
      const price = DEFAULT_PRICES.paint_primer
      const total = calculations.paint.primer_gallons * price.unit_cost
      items.push({
        category: "Paint",
        description: "Primer",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: Math.ceil(calculations.paint.primer_gallons),
        unit: "gal",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${calculations.paint.sqft} sqft ÷ 400 sqft/gal primer coverage`,
      })
    }

    // --- TRIM ---
    const trim = calculations.trim
    if (trim.base_lf > 0) {
      const price = DEFAULT_PRICES.trim_base_3_1_4
      const total = trim.base_lf * price.unit_cost
      items.push({
        category: "Trim",
        description: "Base trim 3-1/4\"",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: trim.base_lf,
        unit: "lf",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `Room perimeter ${trim.perimeter_lf} LF − ${trim.door_lf} LF door widths = ${trim.base_lf} LF`,
      })
    }
    if (trim.casing_lf > 0) {
      const price = DEFAULT_PRICES.trim_casing_2_1_4
      const total = trim.casing_lf * price.unit_cost
      items.push({
        category: "Trim",
        description: "Door/window casing 2-1/4\"",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: trim.casing_lf,
        unit: "lf",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${trim.door_count} doors × ~17 LF each casing`,
      })
    }
    if (trim.cove_lf > 0) {
      const price = DEFAULT_PRICES.cove_corner
      const total = trim.corners * price.unit_cost
      items.push({
        category: "Trim",
        description: "Cove corner",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: trim.corners,
        unit: "ea",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${trim.corners} inside corners @ ${trim.cove_lf} LF cove`,
      })
    }

    // --- FASTENERS ---
    const fasteners = calculations.fasteners
    if (fasteners.coarse_lbs > 0) {
      const price = DEFAULT_PRICES.coarse_screws
      const total = fasteners.coarse_lbs * price.unit_cost
      items.push({
        category: "Fasteners",
        description: "Coarse-thread drywall screws 1-5/8\"",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: Math.ceil(fasteners.coarse_lbs),
        unit: "lb",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${fasteners.coarse_lbs.toFixed(1)} lbs (approx ${fasteners.coarse_lbs * 150} screws @ ~150/lb)`,
      })
    }
    if (fasteners.fine_lbs > 0) {
      const price = DEFAULT_PRICES.fine_screws
      const total = fasteners.fine_lbs * price.unit_cost
      items.push({
        category: "Fasteners",
        description: "Fine-thread drywall screws 1-1/4\"",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: Math.ceil(fasteners.fine_lbs),
        unit: "lb",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${fasteners.fine_lbs.toFixed(1)} lbs for trim attachment`,
      })
    }

    // --- PREP / MISC ---
    const prep = calculations.prep
    if (prep.joint_compound_bags > 0) {
      const price = DEFAULT_PRICES.joint_compound
      const total = prep.joint_compound_bags * price.unit_cost
      items.push({
        category: "Prep / Misc",
        description: "Joint compound (all-purpose)",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: prep.joint_compound_bags,
        unit: "bag",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${prep.joint_compound_bags} bags @ ~50 lb/bag`,
      })
    }
    if (prep.mesh_tape_rolls > 0) {
      const price = DEFAULT_PRICES.mesh_tape
      const total = prep.mesh_tape_rolls * price.unit_cost
      items.push({
        category: "Prep / Misc",
        description: "Mesh tape (self-adhesive)",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: prep.mesh_tape_rolls,
        unit: "roll",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${prep.seam_lf} LF seams ÷ ~500 LF/roll`,
      })
    }
    if (prep.paper_tape_rolls > 0) {
      const price = DEFAULT_PRICES.paper_tape
      const total = prep.paper_tape_rolls * price.unit_cost
      items.push({
        category: "Prep / Misc",
        description: "Paper tape (for flat joints)",
        supplier_part_number: price.part_number,
        brand: price.brand,
        quantity: prep.paper_tape_rolls,
        unit: "roll",
        unit_cost: price.unit_cost,
        total_cost: Math.round(total * 100) / 100,
        is_ordered: false,
        sort_order: sortOrder++,
        notes: `${prep.seam_lf} LF seams ÷ ~500 LF/roll`,
      })
    }

    // 6. Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total_cost, 0)
    const tax_rate = 0
    const tax_amount = 0
    const total = subtotal + tax_amount

    // 7. Save materials_order
    // @ts-ignore - types from generated schema may not include all tables
    const { data: savedOrder, error: orderError } = await supabase
      .from("materials_orders")
      .insert({
        project_id,
        estimate_id: estimate?.id ?? null,
        version: 1,
        status: "draft",
        subtotal: Math.round(subtotal * 100) / 100,
        tax_rate,
        tax_amount,
        total: Math.round(total * 100) / 100,
        notes: null,
      })
      .select()
      .single()

    if (orderError || !savedOrder) {
      return NextResponse.json({ error: "Failed to save materials order", details: orderError }, { status: 500 })
    }

    // 8. Save line items
    // @ts-ignore - types from generated schema may not include all tables
    const itemsToInsert = items.map((item) => ({
      materials_order_id: savedOrder.id,
      category: item.category,
      description: item.description,
      supplier_part_number: item.supplier_part_number,
      brand: item.brand,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: Math.round(item.unit_cost * 100) / 100,
      total_cost: item.total_cost,
      is_ordered: item.is_ordered,
      notes: item.notes,
      sort_order: item.sort_order,
    }))

    const { error: itemsError } = await supabase
      .from("materials_order_items")
      .insert(itemsToInsert)

    if (itemsError) {
      // Rollback the order if items fail
      await supabase.from("materials_orders").delete().eq("id", savedOrder.id)
      return NextResponse.json({ error: "Failed to save order items", details: itemsError }, { status: 500 })
    }

    const result: GenerationResult = {
      materials_order_id: savedOrder.id,
      items,
      totals: {
        drywall_sqft: calculations.drywall.net_sqft,
        paint_sqft: calculations.paint.sqft,
        trim_lf: calculations.trim.base_lf,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount,
        total: Math.round(total * 100) / 100,
      },
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("Materials order generate error:", err)
    return NextResponse.json({ error: "Internal server error", details: String(err) }, { status: 500 })
  }
}

// =============================================================================
// Materials Calculation Logic
// =============================================================================

function calculateMaterials(rooms: any[], paintCoats: number, drywallSize: string) {
  let totalWallSqft = 0
  let totalCeilingSqft = 0
  let totalTrimLf = 0
  let totalDoorCount = 0
  let totalDoorLf = 0
  let totalSeamLf = 0
  let totalWalls = 0

  for (const room of rooms) {
    const measurements = room.measurements || []

    // Wall measurements (square foot type)
    const wallMeas = measurements.filter(
      (m: any) => m.category === "wall" && m.measurement_type === "square_foot"
    )
    for (const m of wallMeas) {
      totalWallSqft += Number(m.value) || 0
      totalWalls++
      // Estimate seams as perimeter of each wall section
      const wallLength = Number(m.length) || 0
      const wallHeight = Number(m.height) || 8
      totalSeamLf += wallLength * 2 // top + bottom seams
      totalTrimLf += wallLength * 2
    }

    // Wall measurements (linear foot type) — for trim calculations
    const wallLinearMeas = measurements.filter(
      (m: any) => m.category === "wall" && m.measurement_type === "linear_foot"
    )
    for (const m of wallLinearMeas) {
      totalTrimLf += Number(m.value) || 0
    }

    // Ceiling measurements
    const ceilingMeas = measurements.filter(
      (m: any) => m.category === "ceiling" && m.measurement_type === "square_foot"
    )
    for (const m of ceilingMeas) {
      totalCeilingSqft += Number(m.value) || 0
    }

    // Opening measurements (doors/windows — for cutouts)
    const openingMeas = measurements.filter((m: any) => m.category === "opening")
    for (const m of openingMeas) {
      const label = (m.label || "").toLowerCase()
      if (label.includes("door")) {
        totalDoorCount++
        // Standard door: 3' wide × 7' tall = 21 sqft cutout
        const area = Number(m.value) || 21
        totalDoorLf += Number(m.length) || 3
      }
    }

    // Trim measurements (linear foot)
    const trimMeas = measurements.filter((m: any) => m.category === "trim")
    for (const m of trimMeas) {
      totalTrimLf += Number(m.value) || 0
    }
  }

  // If no measurements, estimate from rough square footage
  // Assume 8ft ceilings, standard room sizes
  if (totalWallSqft === 0 && rooms.length > 0) {
    // Rough estimate: each room ~200 sqft floor = ~180 wall sqft
    totalWallSqft = rooms.length * 180
    totalCeilingSqft = rooms.length * 200
    totalSeamLf = rooms.length * 60
    totalTrimLf = rooms.length * 60
  }

  // --- DRYWALL CALCULATION ---
  const drywall = calculateDrywall(totalWallSqft, totalCeilingSqft, totalDoorLf, drywallSize)

  // --- PAINT CALCULATION ---
  const paint = calculatePaint(totalWallSqft, totalCeilingSqft, paintCoats)

  // --- TRIM CALCULATION ---
  const trim = calculateTrim(totalTrimLf, totalDoorCount, totalDoorLf)

  // --- FASTENERS CALCULATION ---
  const fasteners = calculateFasteners(drywall.net_sqft)

  // --- PREP CALCULATION ---
  const prep = calculatePrep(totalSeamLf, drywall.net_sqft)

  return { drywall, paint, trim, fasteners, prep }
}

function calculateDrywall(wallSqft: number, ceilingSqft: number, doorLf: number, size: string) {
  // Door cutout area (assume 3' wide × 7' tall = 21 sqft per door)
  const doorCutoutSqft = doorLf > 0 ? doorLf * 2.33 : 0 // ~21 sqft per 3' door

  // Net wall sqft after cutouts
  const netSqft = Math.max(0, wallSqft - doorCutoutSqft)
  // Also hang drywall on ceiling
  const totalSqft = netSqft + ceilingSqft

  // Sheet sizes
  const sheetAreas: Record<string, number> = {
    "4x8_1/2": 32,  // 4 × 8 = 32 sqft
    "4x8_5/8": 32,
    "4x12_1/2": 48, // 4 × 12 = 48 sqft
  }
  const sheetArea = sheetAreas[size] || 32

  // 10% waste factor
  const withWaste = totalSqft * 1.10
  const sheets = Math.ceil(withWaste / sheetArea)

  // For simplicity, all in 4x8 sheets
  const sheets_4x8 = size === "4x12_1/2" ? 0 : sheets
  const sheets_4x12 = size === "4x12_1/2" ? Math.ceil(totalSqft * 1.10 / 48) : 0

  return {
    gross_sqft: Math.round(totalSqft * 10) / 10,
    cutout_sqft: Math.round(doorCutoutSqft * 10) / 10,
    net_sqft: Math.round(netSqft * 10) / 10,
    coverable_sqft: Math.round(totalSqft * 10) / 10,
    sheets_4x8,
    sheets_4x12,
  }
}

function calculatePaint(wallSqft: number, ceilingSqft: number, coats: number) {
  const sqft = wallSqft + ceilingSqft * 0.5 // Ceilings usually painted same color
  const paintSqft = wallSqft + ceilingSqft
  const gallons = (paintSqft / 350) * coats
  const primerGallons = paintSqft / 400 // Primer covers more sqft/gal

  return {
    sqft: Math.round(paintSqft),
    gallons: Math.round(gallons * 100) / 100,
    primer_gallons: Math.round(primerGallons * 100) / 100,
    coats,
  }
}

function calculateTrim(perimeterLf: number, doorCount: number, doorLf: number) {
  // Base trim: perimeter minus door widths (doors don't have base below them)
  // Each door opening ~3 LF of base trim saved
  const doorWidthLf = doorCount * 3
  const baseLf = Math.max(0, perimeterLf - doorWidthLf)

  // Casing: 2 sides + top for each door, ~5 LF per door
  const casingLf = doorCount * 5

  // Cove corner beads at inside corners (rough estimate: 4 per room)
  const corners = Math.max(4, doorCount * 2)
  const coveLf = corners * 1 // 1 LF per corner piece

  return {
    perimeter_lf: Math.round(perimeterLf),
    door_count: doorCount,
    door_lf: Math.round(doorLf),
    base_lf: Math.round(baseLf),
    casing_lf: Math.round(casingLf),
    corners,
    cove_lf: Math.round(coveLf),
  }
}

function calculateFasteners(drywallSqft: number) {
  // Coarse screws: ~1 lb per 35 sqft of drywall (stud spacing 16" oc)
  // Fine screws: ~0.5 lb per 100 LF of trim
  const coarseLbs = Math.max(1, Math.ceil(drywallSqft / 35))
  const fineLbs = 1

  return {
    coarse_lbs: coarseLbs,
    fine_lbs: fineLbs,
  }
}

function calculatePrep(seamLf: number, drywallSqft: number) {
  // Joint compound: ~1 bag per 100 sqft
  const jointCompoundBags = Math.max(1, Math.ceil(drywallSqft / 100))

  // Tape: mesh for seams, ~500 LF/roll
  const tapeLf = seamLf || drywallSqft * 0.1
  const meshTapeRolls = Math.max(1, Math.ceil(tapeLf / 500))
  const paperTapeRolls = Math.max(0, Math.ceil(tapeLf / 600))

  return {
    seam_lf: Math.round(tapeLf),
    joint_compound_bags: jointCompoundBags,
    mesh_tape_rolls: meshTapeRolls,
    paper_tape_rolls: paperTapeRolls,
  }
}
