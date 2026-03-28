"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRoom, useUpdateRoom } from "@/lib/api/hooks/use-rooms"
import { useMeasurements, useCreateMeasurement, useUpdateMeasurement, useDeleteMeasurement } from "@/lib/api/hooks/use-measurements"
import { useEstimate, useAddEstimateLineItem, useUpdateEstimateLineItem, useDeleteEstimateLineItem } from "@/lib/api/hooks/use-estimates"
import { useRoomFiles } from "@/lib/api/hooks/use-files"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AiVisualizerModal } from "@/components/ai/ai-visualizer-modal"
import { FileUploader } from "@/components/files/file-uploader"
import {
  ArrowLeft,
  Wand2,
  Upload,
  Plus,
  Trash2,
  Loader2,
  Ruler,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  GripVertical,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type RoomType = "living" | "bedroom" | "kitchen" | "bathroom" | "basement" | "garage" | "attic" | "office" | "other"

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living: "Living Room",
  bedroom: "Bedroom",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  basement: "Basement",
  garage: "Garage",
  attic: "Attic",
  office: "Office",
  other: "Other",
}

export default function RoomEstimatorPage({
  params,
}: {
  params: Promise<{ projectId: string; roomId: string }>
}) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [visualizerImage, setVisualizerImage] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    params.then((p) => {
      setProjectId(p.projectId)
      setRoomId(p.roomId)
    })
  }, [params])

  if (!projectId || !roomId) return null

  return (
    <RoomEstimatorInner
      projectId={projectId}
      roomId={roomId}
      visualizerImage={visualizerImage}
      setVisualizerImage={setVisualizerImage}
    />
  )
}

function RoomEstimatorInner({
  projectId,
  roomId,
  visualizerImage,
  setVisualizerImage,
}: {
  projectId: string
  roomId: string
  visualizerImage: { url: string; name: string } | null
  setVisualizerImage: (v: { url: string; name: string } | null) => void
}) {
  const { toast } = useToast()
  const { data: room, isLoading } = useRoom(roomId)
  const { data: measurements = [] } = useMeasurements(roomId)
  const { data: estimate } = useEstimate(projectId)
  const { data: files = [] } = useRoomFiles(roomId)
  const updateRoom = useUpdateRoom()
  const createMeasurement = useCreateMeasurement()
  const updateMeasurement = useUpdateMeasurement()
  const deleteMeasurement = useDeleteMeasurement()
  const addLineItem = useAddEstimateLineItem()
  const updateLineItem = useUpdateEstimateLineItem()
  const deleteLineItem = useDeleteEstimateLineItem()

  const [editingName, setEditingName] = useState(false)
  const [roomName, setRoomName] = useState("")
  const [roomType, setRoomType] = useState<RoomType>("living")

  const [lineForm, setLineForm] = useState({
    description: "",
    category: "material",
    unit_cost: "",
    unit: "ea",
    quantity: "1",
  })

  useEffect(() => {
    if (room) {
      setRoomName(room.name)
      setRoomType(room.room_type as RoomType)
    }
  }, [room])

  const [measurementsState, setMeasurementsState] = useState<Array<{
    id?: string
    category: "wall" | "ceiling" | "floor" | "trim" | "opening" | "misc"
    sub_type?: "door" | "window"
    wall_index: number | null
    length: string
    height: string
    width: string
    quantity: string
    source: "manual" | "ai_extracted" | "calculated"
  }>>([])

  useEffect(() => {
    if (measurements.length > 0) {
      setMeasurementsState(
        measurements.map((m) => ({
          id: m.id,
          category: m.category,
          wall_index: m.wall_index,
          length: String(m.length),
          height: m.height ? String(m.height) : "",
          width: m.width ? String(m.width) : "",
          quantity: String(m.quantity),
          source: m.source,
        }))
      )
    } else if (measurements.length === 0 && !isLoading) {
      setMeasurementsState([
        { category: "wall", wall_index: 1, length: "", height: "", width: "", quantity: "1", source: "manual" },
        { category: "wall", wall_index: 2, length: "", height: "", width: "", quantity: "1", source: "manual" },
        { category: "wall", wall_index: 3, length: "", height: "", width: "", quantity: "1", source: "manual" },
        { category: "wall", wall_index: 4, length: "", height: "", width: "", quantity: "1", source: "manual" },
        { category: "ceiling", wall_index: null, length: "", height: "", width: "", quantity: "1", source: "manual" },
      ])
    }
  }, [measurements, isLoading])

  function saveName() {
    setEditingName(false)
    if (room && roomName !== room.name) {
      updateRoom.mutate({ id: roomId, updates: { name: roomName } })
    }
  }

  function saveType(newType: RoomType) {
    setRoomType(newType)
    if (room) {
      updateRoom.mutate({ id: roomId, updates: { room_type: newType } })
    }
  }

  async function handleSaveMeasurements() {
    for (const m of measurementsState) {
      const length = parseFloat(m.length) || 0
      const height = parseFloat(m.height) || 0
      const width = parseFloat(m.width) || 0
      const quantity = parseInt(m.quantity) || 1

      if (length === 0) continue

      const isWall = m.category === "wall"
      const isCeiling = m.category === "ceiling"
      const isLinear = m.category === "trim" || m.category === "opening"
      const measurement_type = (isCeiling ? "square_foot" : isLinear ? "linear_foot" : "unit") as "square_foot" | "linear_foot" | "unit"
      const unit = (isCeiling ? "sqft" : isLinear ? "lf" : "ea") as "sqft" | "lf" | "ea"
      const computedValue = isWall
        ? length * height
        : isCeiling
        ? length * width
        : quantity
      const label = isWall ? `Wall ${m.wall_index ?? 0}` : isCeiling ? "Ceiling" : m.category === "opening" ? "Opening" : m.category

      const payload = {
        room_id: roomId,
        category: m.category,
        measurement_type,
        label,
        value: computedValue,
        unit,
        wall_index: m.wall_index,
        length: length || null,
        height: isWall ? (height || null) : null,
        width: isCeiling ? (width || null) : null,
        quantity: parseFloat(m.quantity) || 1,
        source: m.source,
      }

      try {
        if (m.id) {
          await updateMeasurement.mutateAsync({ id: m.id, updates: payload })
        } else {
          const created = await createMeasurement.mutateAsync(payload)
          setMeasurementsState((prev) =>
            prev.map((s) => (s === m ? { ...s, id: created.id } : s))
          )
        }
      } catch {
        toast({ title: "Failed to save measurements", variant: "error" })
      }
    }
    toast({ title: "Measurements saved" })
  }

  function addMeasurementRow(newCategory: typeof measurementsState[0]["category"], subType?: "door" | "window") {
    setMeasurementsState((prev) => [
      ...prev,
      {
        category: newCategory,
        sub_type: subType,
        wall_index: newCategory === "wall" ? prev.filter((m) => m.category === "wall").length + 1 : null,
        length: "",
        height: "",
        width: "",
        quantity: "1",
        source: "manual",
      },
    ])
  }

  async function handleAddLineItem(e: React.FormEvent) {
    e.preventDefault()
    if (!lineForm.description) return
    try {
      const unitCost = parseFloat(lineForm.unit_cost) || 0
      const qty = parseInt(lineForm.quantity) || 1
      await addLineItem.mutateAsync({
        room_id: roomId,
        estimate_id: estimate?.id ?? "",
        description: lineForm.description,
        category: lineForm.category || "material",
        unit_cost: unitCost,
        total_cost: unitCost * qty,
        unit: lineForm.unit || "ea",
        quantity: qty,
        sort_order: 0,
      })
      toast({ title: "Line item added" })
      setLineForm({ description: "", category: "material", unit_cost: "", unit: "ea", quantity: "1" })
    } catch {
      toast({ title: "Failed to add line item", variant: "error" })
    }
  }

  async function handleDeleteLineItem(id: string) {
    try {
      await deleteLineItem.mutateAsync(id)
      toast({ title: "Line item removed" })
    } catch {
      toast({ title: "Failed to remove line item", variant: "error" })
    }
  }

  const wallMeasurements = measurementsState.filter((m) => m.category === "wall")
  const ceilingMeasurement = measurementsState.find((m) => m.category === "ceiling")
  const openingMeasurements = measurementsState.filter((m) => m.category === "opening")
  const doorMeasurements = openingMeasurements.filter((m) => m.sub_type === "door")
  const windowMeasurements = openingMeasurements.filter((m) => m.sub_type === "window")

  const totalWallSqFt = wallMeasurements.reduce((sum, m) => {
    const l = parseFloat(m.length) || 0
    const h = parseFloat(m.height) || 0
    return sum + l * h * (parseInt(m.quantity) || 1)
  }, 0)

  const totalCeilingSqFt = ceilingMeasurement
    ? (parseFloat(ceilingMeasurement.length) || 0) *
      (parseFloat(ceilingMeasurement.width) || 0)
    : 0

  const totalDoorSqFt = doorMeasurements.reduce((sum, m) => {
    const h = parseFloat(m.height) || 0
    const w = parseFloat(m.width) || 0
    return sum + h * w * (parseInt(m.quantity) || 1)
  }, 0)

  const totalWindowSqFt = windowMeasurements.reduce((sum, m) => {
    const h = parseFloat(m.height) || 0
    const w = parseFloat(m.width) || 0
    return sum + h * w * (parseInt(m.quantity) || 1)
  }, 0)

  const netSqFt = Math.max(0, totalWallSqFt + totalCeilingSqFt - totalDoorSqFt - totalWindowSqFt)

  const roomLineItems = (estimate?.line_items ?? []).filter(
    (item) => item.room_id === roomId
  )
  const roomSubtotal = roomLineItems.reduce(
    (sum, item) => sum + item.total_cost,
    0
  )

  const imageFiles = files.filter(
    (f) => f.processing_status === "completed" && f.mime_type?.startsWith("image/")
  )

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div
          className="sticky top-0 z-30"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(15,17,30,0.9)",
            backdropFilter: "blur(24px)",
            padding: "20px 32px",
          }}
        >
          <div className="skeleton h-8 w-48 rounded" />
        </div>
        <div className="px-8 pt-6">
          <div className="skeleton h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  const sourceBadgeClass = (source: string) =>
    source === "ai_extracted"
      ? "badge badge-gold"
      : source === "calculated"
      ? "badge badge-warning"
      : "badge badge-muted"

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Sticky Header */}
      <div
        className="sticky top-0 z-30"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,17,30,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          padding: "20px 32px",
        }}
      >
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon" className="btn-ghost">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 flex items-center gap-4 min-w-0">
            {editingName ? (
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="input text-xl font-bold max-w-xs"
                autoFocus
              />
            ) : (
              <h1
                className="text-2xl font-bold cursor-pointer"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                onClick={() => setEditingName(true)}
              >
                {roomName}
              </h1>
            )}
            <Select value={roomType} onValueChange={(v: RoomType) => saveType(v)}>
              <SelectTrigger className="input w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSaveMeasurements}
            disabled={updateMeasurement.isPending || createMeasurement.isPending}
            className="btn-primary"
          >
            {updateMeasurement.isPending || createMeasurement.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="px-8 pt-6 pb-8 animate-fade-up">
        <div className="grid grid-cols-5 gap-6">
          {/* LEFT: Measurements + Line Items */}
          <div className="col-span-3 space-y-6">
            {/* Measurements Card */}
            <Card className="card">
              <CardHeader className="pb-4">
                <CardTitle
                  className="flex items-center gap-2 text-base"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <Ruler className="h-4 w-4" style={{ color: "var(--accent-gold)" }} />
                  Measurements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Wall Measurements */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm" style={{ color: "var(--text-secondary)" }}>Walls</Label>
                    <Button variant="ghost" size="sm" onClick={() => addMeasurementRow("wall")} className="btn-ghost">
                      <Plus className="h-3 w-3" />
                      Add Wall
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {wallMeasurements.map((m, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-1 text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                          <GripVertical className="h-3 w-3" />
                          W{m.wall_index}
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder="Length"
                            value={m.length}
                            onChange={(e) => {
                              const updated = [...measurementsState]
                              const i = measurementsState.indexOf(m)
                              updated[i] = { ...updated[i], length: e.target.value }
                              setMeasurementsState(updated)
                            }}
                            className="input h-8 text-sm"
                          />
                        </div>
                        <span className="col-span-1 text-center text-xs" style={{ color: "var(--text-muted)" }}>×</span>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder="Height"
                            value={m.height}
                            onChange={(e) => {
                              const updated = [...measurementsState]
                              const i = measurementsState.indexOf(m)
                              updated[i] = { ...updated[i], height: e.target.value }
                              setMeasurementsState(updated)
                            }}
                            className="input h-8 text-sm"
                          />
                        </div>
                        <span className="col-span-1 text-xs text-center" style={{ color: "var(--text-muted)" }}>=</span>
                        <div
                          className="col-span-3 px-2 py-1 text-center text-sm rounded"
                          style={{
                            background: "rgba(226,178,74,0.04)",
                            border: "1px solid rgba(255,255,255,0.05)",
                            color: "var(--accent-gold)",
                          }}
                        >
                          {((parseFloat(m.length) || 0) * (parseFloat(m.height) || 0) * (parseInt(m.quantity) || 1)).toFixed(1)} sq ft
                        </div>
                        <div className="col-span-1">
                          <span className={sourceBadgeClass(m.source)}>
                            {m.source === "ai_extracted" ? "AI" : m.source === "calculated" ? "Calc" : "Manual"}
                          </span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {m.id && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                deleteMeasurement.mutate(m.id!)
                                setMeasurementsState((prev) => prev.filter((s) => s !== m))
                              }}
                              className="btn-ghost"
                              style={{ color: "var(--text-muted)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ceiling */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm" style={{ color: "var(--text-secondary)" }}>Ceiling</Label>
                  </div>
                  {ceilingMeasurement && (
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-1 text-xs" style={{ color: "var(--text-muted)" }}>CL</div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Length"
                          value={ceilingMeasurement.length}
                          onChange={(e) => {
                            setMeasurementsState((prev) =>
                              prev.map((m) =>
                                m === ceilingMeasurement ? { ...m, length: e.target.value } : m
                              )
                            )
                          }}
                          className="input h-8 text-sm"
                        />
                      </div>
                      <span className="col-span-1 text-center text-xs" style={{ color: "var(--text-muted)" }}>×</span>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Width"
                          value={ceilingMeasurement.width}
                          onChange={(e) => {
                            setMeasurementsState((prev) =>
                              prev.map((m) =>
                                m === ceilingMeasurement ? { ...m, width: e.target.value } : m
                              )
                            )
                          }}
                          className="input h-8 text-sm"
                        />
                      </div>
                      <span className="col-span-1 text-xs text-center" style={{ color: "var(--text-muted)" }}>=</span>
                      <div
                        className="col-span-3 px-2 py-1 text-center text-sm rounded"
                        style={{
                          background: "rgba(226,178,74,0.04)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          color: "var(--accent-gold)",
                        }}
                      >
                        {totalCeilingSqFt.toFixed(1)} sq ft
                      </div>
                      <div className="col-span-1">
                        <span className={sourceBadgeClass(ceilingMeasurement.source)}>
                          {ceilingMeasurement.source === "ai_extracted" ? "AI" : "Manual"}
                        </span>
                      </div>
                      <div className="col-span-1" />
                    </div>
                  )}
                </div>

                {/* Openings */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm" style={{ color: "var(--text-secondary)" }}>Doors</Label>
                      <Button variant="ghost" size="sm" onClick={() => addMeasurementRow("opening", "door")} className="btn-ghost">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {doorMeasurements.map((m, idx) => (
                        <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                          <div className="col-span-1">
                            <Input
                              type="number"
                              placeholder="H"
                              value={m.height}
                              onChange={(e) => {
                                const updated = [...measurementsState]
                                const i = measurementsState.indexOf(m)
                                updated[i] = { ...updated[i], height: e.target.value }
                                setMeasurementsState(updated)
                              }}
                              className="input h-8 text-sm"
                            />
                          </div>
                          <span className="col-span-1 text-center text-xs" style={{ color: "var(--text-muted)" }}>×</span>
                          <div className="col-span-1">
                            <Input
                              type="number"
                              placeholder="W"
                              value={m.width}
                              onChange={(e) => {
                                const updated = [...measurementsState]
                                const i = measurementsState.indexOf(m)
                                updated[i] = { ...updated[i], width: e.target.value }
                                setMeasurementsState(updated)
                              }}
                              className="input h-8 text-sm"
                            />
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="badge badge-error text-xs">Deduction</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm" style={{ color: "var(--text-secondary)" }}>Windows</Label>
                      <Button variant="ghost" size="sm" onClick={() => addMeasurementRow("opening", "window")} className="btn-ghost">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {windowMeasurements.map((m, idx) => (
                        <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                          <div className="col-span-1">
                            <Input
                              type="number"
                              placeholder="H"
                              value={m.height}
                              onChange={(e) => {
                                const updated = [...measurementsState]
                                const i = measurementsState.indexOf(m)
                                updated[i] = { ...updated[i], height: e.target.value }
                                setMeasurementsState(updated)
                              }}
                              className="input h-8 text-sm"
                            />
                          </div>
                          <span className="col-span-1 text-center text-xs" style={{ color: "var(--text-muted)" }}>×</span>
                          <div className="col-span-1">
                            <Input
                              type="number"
                              placeholder="W"
                              value={m.width}
                              onChange={(e) => {
                                const updated = [...measurementsState]
                                const i = measurementsState.indexOf(m)
                                updated[i] = { ...updated[i], width: e.target.value }
                                setMeasurementsState(updated)
                              }}
                              className="input h-8 text-sm"
                            />
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="badge badge-error text-xs">Deduction</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-4 space-y-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Wall Area</span>
                    <span style={{ color: "var(--text-primary)" }}>{totalWallSqFt.toFixed(1)} sq ft</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Ceiling Area</span>
                    <span style={{ color: "var(--text-primary)" }}>{totalCeilingSqFt.toFixed(1)} sq ft</span>
                  </div>
                  <div className="flex justify-between text-sm" style={{ color: "var(--error)", opacity: 0.7 }}>
                    <span>Openings Deduction</span>
                    <span>-{(totalDoorSqFt + totalWindowSqFt).toFixed(1)} sq ft</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span style={{ color: "var(--text-primary)" }}>Net Surface Area</span>
                    <span style={{ color: "var(--accent-gold)" }}>{netSqFt.toFixed(1)} sq ft</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items Card */}
            <Card className="card">
              <CardHeader className="pb-4">
                <CardTitle
                  className="flex items-center gap-2 text-base"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <DollarSign className="h-4 w-4" style={{ color: "var(--accent-gold)" }} />
                  Line Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing line items */}
                {roomLineItems.length > 0 && (
                  <div className="space-y-2">
                    {roomLineItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <div className="flex-1">
                          <p className="text-sm" style={{ color: "var(--text-primary)" }}>{item.description}</p>
                          {item.category && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.category}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm" style={{ color: "var(--accent-gold)" }}>
                            {formatCurrency(item.total_cost)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {item.unit && `${item.unit} × `}{item.quantity}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteLineItem(item.id)}
                          className="btn-ghost"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add line item form */}
                <form onSubmit={handleAddLineItem} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Description"
                      value={lineForm.description}
                      onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                      className="input text-sm"
                    />
                    <Input
                      placeholder="Category (optional)"
                      value={lineForm.category}
                      onChange={(e) => setLineForm({ ...lineForm, category: e.target.value })}
                      className="input text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Input
                      type="number"
                      placeholder="Unit Cost $"
                      value={lineForm.unit_cost}
                      onChange={(e) => setLineForm({ ...lineForm, unit_cost: e.target.value })}
                      className="input text-sm"
                    />
                    <Input
                      placeholder="Unit (sqft/lf/ea)"
                      value={lineForm.unit}
                      onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })}
                      className="input text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={lineForm.quantity}
                      onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                      className="input text-sm"
                    />
                    <Button type="submit" size="sm" disabled={!lineForm.description} className="btn-primary">
                      <Plus className="h-3 w-3" />
                      Add
                    </Button>
                  </div>
                </form>

                {/* Room subtotal */}
                {roomLineItems.length > 0 && (
                  <div className="border-t pt-3 flex justify-between font-semibold" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "var(--text-primary)" }}>Room Subtotal</span>
                    <span style={{ color: "var(--accent-gold)" }}>{formatCurrency(roomSubtotal)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Photos + Visualizer */}
          <div className="col-span-2 space-y-6">
            <Card className="card">
              <CardHeader className="pb-4">
                <CardTitle
                  className="flex items-center gap-2 text-base"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <Upload className="h-4 w-4" style={{ color: "var(--accent-gold)" }} />
                  Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUploader projectId={projectId} roomId={roomId} />

                {imageFiles.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {imageFiles.map((file) => (
                      <div
                        key={file.id}
                        className="relative aspect-square rounded-lg overflow-hidden group"
                        style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        <Image
                          src={file.storage_path}
                          alt={file.file_name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.5)" }}
                        >
                          <Button
                            size="sm"
                            variant="secondary"
                            className="btn-primary"
                            onClick={() =>
                              setVisualizerImage({
                                url: file.storage_path,
                                name: file.file_name,
                              })
                            }
                          >
                            <Wand2 className="h-3 w-3" />
                            AI Visualizer
                          </Button>
                        </div>
                        <div className="absolute bottom-1 right-1">
                          {file.processing_status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                          ) : file.processing_status === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#3b82f6" }} />
                          ) : file.processing_status === "failed" ? (
                            <AlertCircle className="h-4 w-4" style={{ color: "var(--error)" }} />
                          ) : (
                            <Clock className="h-4 w-4" style={{ color: "#f59e0b" }} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* AI Visualizer Modal */}
      {visualizerImage && (
        <AiVisualizerModal
          open={!!visualizerImage}
          onOpenChange={(open) => !open && setVisualizerImage(null)}
          imageUrl={visualizerImage.url}
          imageName={visualizerImage.name}
          roomId={roomId}
          onApply={(outputUrl) => {
            toast({ title: "Visualization applied to room" })
          }}
        />
      )}
    </div>
  )
}
