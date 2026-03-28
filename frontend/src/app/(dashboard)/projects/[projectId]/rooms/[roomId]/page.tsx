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
  Camera,
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

  // Measurements state
  const [measurementsState, setMeasurementsState] = useState<Array<{
    id?: string
    category: "wall" | "ceiling" | "floor" | "trim" | "opening" | "misc"
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
      // Initialize with 4 walls
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

  function addMeasurementRow(newCategory: typeof measurementsState[0]["category"]) {
    setMeasurementsState((prev) => [
      ...prev,
      {
        category: newCategory,
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

  // Calculate totals
  const wallMeasurements = measurementsState.filter((m) => m.category === "wall")
  const ceilingMeasurement = measurementsState.find((m) => m.category === "ceiling")
  const openingMeasurements = measurementsState.filter((m) => m.category === "opening")

  const totalWallSqFt = wallMeasurements.reduce((sum, m) => {
    const l = parseFloat(m.length) || 0
    const h = parseFloat(m.height) || 0
    return sum + l * h * (parseInt(m.quantity) || 1)
  }, 0)

  const totalCeilingSqFt = ceilingMeasurement
    ? (parseFloat(ceilingMeasurement.length) || 0) *
      (parseFloat(ceilingMeasurement.width) || 0)
    : 0

  const totalDoorSqFt = openingMeasurements.reduce((sum, m) => {
    const h = parseFloat(m.height) || 0
    const w = parseFloat(m.width) || 0
    return sum + h * w * (parseInt(m.quantity) || 1)
  }, 0)

  const totalWindowSqFt = openingMeasurements.reduce((sum, m) => {
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
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-white/[0.05] rounded" />
          <div className="h-96 bg-white/[0.03] rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 flex items-center gap-4">
          {editingName ? (
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="text-xl font-bold max-w-xs"
              autoFocus
            />
          ) : (
            <h1
              className="text-2xl font-bold text-white cursor-pointer hover:text-[#00d4ff] transition-colors"
              onClick={() => setEditingName(true)}
            >
              {roomName}
            </h1>
          )}
          <Select value={roomType} onValueChange={(v: RoomType) => saveType(v)}>
            <SelectTrigger className="w-40">
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
        <Button onClick={handleSaveMeasurements} disabled={updateMeasurement.isPending || createMeasurement.isPending}>
          {updateMeasurement.isPending || createMeasurement.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* LEFT: Measurements Panel */}
        <div className="col-span-3 space-y-6">
          {/* Measurements Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ruler className="h-4 w-4 text-[#00d4ff]" />
                Measurements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Wall Measurements */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-white/60">Walls</Label>
                  <Button variant="ghost" size="sm" onClick={() => addMeasurementRow("wall")}>
                    <Plus className="h-3 w-3" />
                    Add Wall
                  </Button>
                </div>
                <div className="space-y-2">
                  {wallMeasurements.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-1 text-xs text-white/30 flex items-center gap-1">
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
                          className="h-8 text-sm"
                        />
                      </div>
                      <span className="col-span-1 text-center text-xs text-white/30">×</span>
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
                          className="h-8 text-sm"
                        />
                      </div>
                      <span className="col-span-1 text-xs text-white/30">=</span>
                      <div className="col-span-3 bg-white/[0.03] rounded px-2 py-1 text-center text-sm text-[#00d4ff]">
                        {((parseFloat(m.length) || 0) * (parseFloat(m.height) || 0) * (parseInt(m.quantity) || 1)).toFixed(1)} sq ft
                      </div>
                      <div className="col-span-1">
                        <Badge className={`badge-${m.source === "ai_extracted" ? "ai" : m.source === "calculated" ? "calculated" : "manual"} text-xs`}>
                          {m.source === "ai_extracted" ? "AI" : m.source === "calculated" ? "Calc" : "Manual"}
                        </Badge>
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
                            className="text-white/20 hover:text-red-400"
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
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-white/60">Ceiling</Label>
                </div>
                {ceilingMeasurement && (
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1 text-xs text-white/30">CL</div>
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
                        className="h-8 text-sm"
                      />
                    </div>
                    <span className="col-span-1 text-center text-xs text-white/30">×</span>
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
                        className="h-8 text-sm"
                      />
                    </div>
                    <span className="col-span-1 text-xs text-white/30">=</span>
                    <div className="col-span-3 bg-white/[0.03] rounded px-2 py-1 text-center text-sm text-[#00d4ff]">
                      {totalCeilingSqFt.toFixed(1)} sq ft
                    </div>
                    <div className="col-span-1">
                      <Badge className={`badge-${ceilingMeasurement.source === "ai_extracted" ? "ai" : "manual"} text-xs`}>
                        {ceilingMeasurement.source === "ai_extracted" ? "AI" : "Manual"}
                      </Badge>
                    </div>
                    <div className="col-span-1" />
                  </div>
                )}
              </div>

              {/* Openings */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-white/60">Doors</Label>
                    <Button variant="ghost" size="sm" onClick={() => addMeasurementRow("opening")}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {openingMeasurements.map((m, idx) => (
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
                            className="h-8 text-sm"
                          />
                        </div>
                        <span className="col-span-1 text-center text-xs text-white/30">×</span>
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
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <Badge className="badge-manual text-xs">Deduction</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-white/60">Windows</Label>
                    <Button variant="ghost" size="sm" onClick={() => addMeasurementRow("opening")}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {openingMeasurements.map((m, idx) => (
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
                            className="h-8 text-sm"
                          />
                        </div>
                        <span className="col-span-1 text-center text-xs text-white/30">×</span>
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
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <Badge className="badge-manual text-xs">Deduction</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Wall Area</span>
                  <span className="text-white">{totalWallSqFt.toFixed(1)} sq ft</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Ceiling Area</span>
                  <span className="text-white">{totalCeilingSqFt.toFixed(1)} sq ft</span>
                </div>
                <div className="flex justify-between text-sm text-red-400/70">
                  <span>Openings Deduction</span>
                  <span>-{(totalDoorSqFt + totalWindowSqFt).toFixed(1)} sq ft</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                  <span className="text-white">Net Surface Area</span>
                  <span className="text-[#00d4ff]">{netSqFt.toFixed(1)} sq ft</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4 text-[#00d4ff]" />
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
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5"
                    >
                      <div className="flex-1">
                        <p className="text-sm text-white">{item.description}</p>
                        {item.category && (
                          <p className="text-xs text-white/30">{item.category}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[#00d4ff]">
                          {formatCurrency(item.total_cost)}
                        </p>
                        <p className="text-xs text-white/30">
                          {item.unit && `${item.unit} × `}{item.quantity}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteLineItem(item.id)}
                        className="text-white/20 hover:text-red-400"
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
                    className="text-sm"
                  />
                  <Input
                    placeholder="Category (optional)"
                    value={lineForm.category}
                    onChange={(e) => setLineForm({ ...lineForm, category: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Input
                    type="number"
                    placeholder="Unit Cost $"
                    value={lineForm.unit_cost}
                    onChange={(e) => setLineForm({ ...lineForm, unit_cost: e.target.value })}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Unit (sqft/lf/ea)"
                    value={lineForm.unit}
                    onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })}
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={lineForm.quantity}
                    onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                    className="text-sm"
                  />
                  <Button type="submit" size="sm" disabled={!lineForm.description}>
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
              </form>

              {/* Room subtotal */}
              {roomLineItems.length > 0 && (
                <div className="border-t border-white/10 pt-3 flex justify-between font-semibold">
                  <span className="text-white">Room Subtotal</span>
                  <span className="text-[#00d4ff]">{formatCurrency(roomSubtotal)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Photos + Visualizer Panel */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4 text-[#00d4ff]" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <FileUploader projectId={projectId} roomId={roomId} />
              </div>

              {imageFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {imageFiles.map((file) => (
                    <div
                      key={file.id}
                      className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group"
                    >
                      <Image
                        src={file.storage_path}
                        alt={file.file_name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          size="sm"
                          variant="secondary"
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
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : file.processing_status === "processing" ? (
                          <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                        ) : file.processing_status === "failed" ? (
                          <AlertCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-400" />
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
