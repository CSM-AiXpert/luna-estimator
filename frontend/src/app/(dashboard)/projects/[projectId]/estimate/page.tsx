"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useProject } from "@/lib/api/hooks/use-projects"
import { useRooms } from "@/lib/api/hooks/use-rooms"
import { useEstimate, useUpdateEstimate, useUpdateEstimateStatus, useRecalculateEstimateTotals } from "@/lib/api/hooks/use-estimates"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, DollarSign, Send, Check, FileDown, Loader2, Ruler, Link2, Package } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function EstimatePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const [projectId, setProjectId] = useState<string | null>(null)
  useEffect(() => {
    params.then((p) => setProjectId(p.projectId))
  }, [params])
  if (!projectId) return null
  return <EstimatePageInner projectId={projectId} />
}

function EstimatePageInner({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data: project } = useProject(projectId)
  const { data: rooms = [] } = useRooms(projectId)
  const { data: estimate, isLoading } = useEstimate(projectId)
  const updateEstimate = useUpdateEstimate()
  const updateStatus = useUpdateEstimateStatus()
  const recalculate = useRecalculateEstimateTotals()

  const [markupRate, setMarkupPercent] = useState("")
  const [taxRate, setTaxPercent] = useState("")
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (estimate) {
      setMarkupPercent(String(estimate.markup_rate ?? 0))
      setTaxPercent(String(estimate.tax_rate ?? 0))
    }
  }, [estimate])

  function toggleRoom(roomId: string) {
    setExpandedRooms((prev) => {
      const next = new Set(prev)
      if (next.has(roomId)) next.delete(roomId)
      else next.add(roomId)
      return next
    })
  }

  async function handleSave() {
    if (!estimate) return
    const mp = parseFloat(markupRate) || 0
    const tp = parseFloat(taxRate) || 0
    try {
      await updateEstimate.mutateAsync({
        id: estimate.id,
        updates: {
          markup_rate: mp,
          tax_rate: tp,
        },
      })
      await recalculate.mutateAsync(estimate.id)
      toast({ title: "Estimate saved" })
    } catch {
      toast({ title: "Failed to save estimate", variant: "error" })
    }
  }

  async function handleStatusChange(status: "sent" | "approved") {
    if (!estimate) return
    try {
      await updateStatus.mutateAsync({ id: estimate.id, status })
      toast({ title: `Estimate ${status}` })
    } catch {
      toast({ title: "Failed to update status", variant: "error" })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/[0.05] bg-[#0a0e1a]/80 px-8 py-5">
          <div className="skeleton h-8 w-64 rounded" />
        </div>
        <div className="px-8 pt-6">
          <div className="skeleton h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  const typedProject = project as typeof project & { customer?: { name: string; email?: string | null } }
  const lineItems = estimate?.line_items ?? []

  // Group line items by room
  const roomItems: Record<string, typeof lineItems> = {}
  for (const item of lineItems) {
    const roomId = item.room_id ?? "unassigned"
    if (!roomItems[roomId]) roomItems[roomId] = []
    roomItems[roomId].push(item)
  }

  const subtotal = estimate?.subtotal ?? 0
  const markupAmount = estimate?.markup_amount ?? 0
  const taxAmount = estimate?.tax_amount ?? 0
  const total = estimate?.total ?? 0

  const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    pending: "Pending",
    sent: "Sent",
    approved: "Approved",
    rejected: "Rejected",
  }

  const estimateStatusClass =
    estimate?.status === "approved"
      ? "badge badge-success"
      : estimate?.status === "sent"
      ? "badge badge-cyan"
      : estimate?.status === "rejected"
      ? "badge badge-error"
      : estimate?.status === "pending"
      ? "badge badge-warning"
      : "badge badge-muted"

  return (
    <div className="min-h-screen">
      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/[0.05] bg-[#0a0e1a]/80 px-8 py-5">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon" className="btn-ghost">
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1
              className="text-2xl font-bold text-white flex items-center gap-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Estimate
              {typedProject?.name && (
                <>
                  <span className="text-[rgba(240,244,255,0.3)]">·</span>
                  <span className="text-lg font-normal text-[rgba(240,244,255,0.5)]">{typedProject.name}</span>
                </>
              )}
            </h1>
            {typedProject?.customer && (
              <p className="text-sm text-[#00d4ff]">{typedProject.customer.name}</p>
            )}
          </div>
          {estimate && (
            <div className="flex items-center gap-3">
              <span className={estimateStatusClass}>
                {STATUS_LABELS[estimate.status] ?? estimate.status}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSave}
                disabled={updateEstimate.isPending}
                className="btn-secondary"
              >
                {updateEstimate.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save Draft
              </Button>
              {estimate.status === "draft" && (
                <Button size="sm" onClick={() => handleStatusChange("sent")} className="btn-primary">
                  <Send className="h-3 w-3" />
                  Send
                </Button>
              )}
              {estimate.status === "sent" && (
                <Button size="sm" onClick={() => handleStatusChange("approved")} className="btn-primary">
                  <Check className="h-3 w-3" />
                  Approve
                </Button>
              )}
              <Button variant="secondary" size="sm" className="btn-secondary">
                <FileDown className="h-3 w-3" />
                Export PDF
              </Button>
              <Link href={`/projects/${projectId}/materials-order`}>
                <Button variant="secondary" size="sm" className="btn-secondary">
                  <Package className="h-3 w-3" />
                  Materials Order
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 pt-6 pb-8 animate-fade-up">
        {!estimate ? (
          <div className="glass text-center py-24 rounded-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(0,212,255,0.08)] mx-auto mb-5">
              <DollarSign className="h-8 w-8 text-[rgba(0,212,255,0.4)]" />
            </div>
            <h3
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No estimate yet
            </h3>
            <p className="text-sm text-[rgba(240,244,255,0.4)] mb-6">
              Add rooms and line items to build your estimate
            </p>
            <Link href={`/projects/${projectId}`}>
              <Button variant="secondary" className="btn-secondary" size="sm">
                Add Rooms
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Rooms Accordion */}
            <div className="col-span-2 space-y-4">
              {rooms.length === 0 ? (
                <div className="glass text-center py-16 rounded-xl">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(0,212,255,0.08)] mx-auto mb-5">
                    <Ruler className="h-8 w-8 text-[rgba(0,212,255,0.4)]" />
                  </div>
                  <h3
                    className="text-lg font-semibold text-white mb-2"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    No rooms added yet
                  </h3>
                  <p className="text-sm text-[rgba(240,244,255,0.4)]">
                    Add rooms to the project to start building your estimate
                  </p>
                </div>
              ) : (
                rooms.map((room) => {
                  const items = roomItems[room.id] ?? []
                  const roomTotal = items.reduce(
                    (sum, item) => sum + item.total_cost,
                    0
                  )
                  const isExpanded = expandedRooms.has(room.id)
                  return (
                    <Card key={room.id} className="glass overflow-hidden">
                      <button
                        className="w-full text-left"
                        onClick={() => toggleRoom(room.id)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-[rgba(240,244,255,0.4)]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-[rgba(240,244,255,0.4)]" />
                            )}
                            <Ruler className="h-4 w-4 text-[#00d4ff]" />
                            <span className="font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                              {room.name}
                            </span>
                            <Badge className="badge badge-muted text-xs">{items.length} items</Badge>
                          </div>
                          <span className="text-[#00d4ff] font-semibold">
                            {formatCurrency(roomTotal)}
                          </span>
                        </CardContent>
                      </button>

                      {isExpanded && items.length > 0 && (
                        <div className="border-t border-white/[0.05]">
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr className="border-b border-white/[0.05]">
                                  <th className="text-left px-4 py-2 text-[rgba(240,244,255,0.4)] font-normal text-xs uppercase tracking-[0.08em]" style={{ fontFamily: "var(--font-display)" }}>
                                    Description
                                  </th>
                                  <th className="text-right px-4 py-2 text-[rgba(240,244,255,0.4)] font-normal text-xs uppercase tracking-[0.08em]" style={{ fontFamily: "var(--font-display)" }}>
                                    Unit Cost
                                  </th>
                                  <th className="text-right px-4 py-2 text-[rgba(240,244,255,0.4)] font-normal text-xs uppercase tracking-[0.08em]" style={{ fontFamily: "var(--font-display)" }}>
                                    Qty
                                  </th>
                                  <th className="text-right px-4 py-2 text-[rgba(240,244,255,0.4)] font-normal text-xs uppercase tracking-[0.08em]" style={{ fontFamily: "var(--font-display)" }}>
                                    Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => (
                                  <tr key={item.id} className="border-b border-white/[0.03] last:border-0">
                                    <td className="px-4 py-3 text-white text-sm">
                                      {item.description}
                                      {item.category && (
                                        <span className="text-[rgba(240,244,255,0.3)] text-xs ml-2">{item.category}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[rgba(240,244,255,0.7)] text-sm">
                                      {formatCurrency(item.unit_cost)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[rgba(240,244,255,0.5)] text-sm">
                                      {item.unit && <span className="mr-1">{item.unit} × </span>}
                                      {item.quantity}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[#00d4ff] font-medium text-sm">
                                      {formatCurrency(item.total_cost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })
              )}
            </div>

            {/* Totals Sidebar */}
            <div className="space-y-4">
              <Card className="glass stat-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base" style={{ fontFamily: "var(--font-display)" }}>
                    Totals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[rgba(240,244,255,0.4)]">Subtotal</span>
                    <span className="text-white">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[rgba(240,244,255,0.4)] flex items-center gap-2">
                      Markup
                      <Input
                        type="number"
                        value={markupRate}
                        onChange={(e) => setMarkupPercent(e.target.value)}
                        className="input w-16 h-7 text-xs text-right"
                        onBlur={handleSave}
                      />
                      %
                    </span>
                    <span className="text-white">{formatCurrency(markupAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[rgba(240,244,255,0.4)] flex items-center gap-2">
                      Tax
                      <Input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxPercent(e.target.value)}
                        className="input w-16 h-7 text-xs text-right"
                        onBlur={handleSave}
                      />
                      %
                    </span>
                    <span className="text-white">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="border-t border-white/[0.08] pt-2 flex justify-between font-semibold text-base">
                    <span className="text-white">Grand Total</span>
                    <span className="text-[#00d4ff]">{formatCurrency(total)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader className="pb-3">
                  <CardTitle
                    className="text-base flex items-center gap-2"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    <Link2 className="h-4 w-4 text-[#00d4ff]" />
                    GHL Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[rgba(240,244,255,0.2)]" />
                    <span className="text-sm text-[rgba(240,244,255,0.4)]">Not connected</span>
                  </div>
                </CardContent>
              </Card>

              {estimate.sent_at && (
                <Card className="glass">
                  <CardContent className="p-4 text-xs text-[rgba(240,244,255,0.3)] space-y-1">
                    <p>Sent: {formatDate(estimate.sent_at)}</p>
                    {estimate.approved_at && <p>Approved: {formatDate(estimate.approved_at)}</p>}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
