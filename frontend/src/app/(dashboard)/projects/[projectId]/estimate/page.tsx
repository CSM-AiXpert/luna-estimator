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
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-white/[0.05] rounded" />
          <div className="h-96 bg-white/[0.03] rounded-xl" />
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            Estimate
            {typedProject?.name && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-lg font-normal text-white/50">{typedProject.name}</span>
              </>
            )}
          </h1>
          {typedProject?.customer && (
            <p className="text-sm text-[#00d4ff]">{typedProject.customer.name}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {estimate && (
            <>
              <Badge className={`status-${estimate.status}`}>
                {STATUS_LABELS[estimate.status] ?? estimate.status}
              </Badge>
              <Button variant="secondary" size="sm" onClick={handleSave} disabled={updateEstimate.isPending}>
                {updateEstimate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save Draft
              </Button>
              {estimate.status === "draft" && (
                <Button size="sm" onClick={() => handleStatusChange("sent")}>
                  <Send className="h-3 w-3" />
                  Send
                </Button>
              )}
              {estimate.status === "sent" && (
                <Button size="sm" onClick={() => handleStatusChange("approved")}>
                  <Check className="h-3 w-3" />
                  Approve
                </Button>
              )}
              <Button variant="secondary" size="sm">
                <FileDown className="h-3 w-3" />
                Export PDF
              </Button>
              <Link href={`/projects/${projectId}/materials-order`}>
                <Button variant="secondary" size="sm">
                  <Package className="h-3 w-3" />
                  Materials Order
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {!estimate ? (
        <div className="text-center py-20 text-white/30 border border-dashed border-white/10 rounded-xl">
          <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No estimate yet</p>
          <p className="text-xs text-white/20 mt-1">Add rooms and line items to build your estimate</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            {/* Rooms Accordion */}
            {rooms.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <p>No rooms added to this project</p>
                <Link href={`/projects/${projectId}`}>
                  <Button variant="secondary" className="mt-4" size="sm">
                    Add Rooms
                  </Button>
                </Link>
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
                  <Card key={room.id}>
                    <button
                      className="w-full text-left"
                      onClick={() => toggleRoom(room.id)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-white/40" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-white/40" />
                          )}
                          <Ruler className="h-4 w-4 text-[#00d4ff]" />
                          <span className="font-medium text-white">{room.name}</span>
                          <Badge className="text-xs">{items.length} items</Badge>
                        </div>
                        <span className="text-[#00d4ff] font-medium">
                          {formatCurrency(roomTotal)}
                        </span>
                      </CardContent>
                    </button>

                    {isExpanded && items.length > 0 && (
                      <div className="border-t border-white/5">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/5">
                              <th className="text-left px-4 py-2 text-white/40 font-normal text-xs">Description</th>
                              <th className="text-right px-4 py-2 text-white/40 font-normal text-xs">Material</th>
                              <th className="text-right px-4 py-2 text-white/40 font-normal text-xs">Labor</th>
                              <th className="text-right px-4 py-2 text-white/40 font-normal text-xs">Qty</th>
                              <th className="text-right px-4 py-2 text-white/40 font-normal text-xs">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr key={item.id} className="border-b border-white/5 last:border-0">
                                <td className="px-4 py-2 text-white">
                                  {item.description}
                                  {item.category && (
                                    <span className="text-white/30 text-xs ml-2">{item.category}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right text-white/70">
                                  {formatCurrency(item.total_cost)}
                                </td>
                                <td className="px-4 py-2 text-right text-white/70">
                                  {formatCurrency(0)}
                                </td>
                                <td className="px-4 py-2 text-right text-white/50">
                                  {item.unit && <span className="mr-1">{item.unit} × </span>}
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-2 text-right text-[#00d4ff] font-medium">
                                  {formatCurrency(item.total_cost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </div>

          {/* Totals Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Subtotal</span>
                  <span className="text-white">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40 flex items-center gap-2">
                    Markup
                    <Input
                      type="number"
                      value={markupRate}
                      onChange={(e) => setMarkupPercent(e.target.value)}
                      className="w-16 h-7 text-xs text-right"
                      onBlur={handleSave}
                    />
                    %
                  </span>
                  <span className="text-white">{formatCurrency(markupAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40 flex items-center gap-2">
                    Tax
                    <Input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxPercent(e.target.value)}
                      className="w-16 h-7 text-xs text-right"
                      onBlur={handleSave}
                    />
                    %
                  </span>
                  <span className="text-white">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between font-semibold text-base">
                  <span className="text-white">Grand Total</span>
                  <span className="text-[#00d4ff]">{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[#00d4ff]" />
                  GHL Sync
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="text-sm text-white/40">Not connected</span>
                </div>
              </CardContent>
            </Card>

            {estimate.sent_at && (
              <Card>
                <CardContent className="p-4 text-xs text-white/30 space-y-1">
                  <p>Sent: {formatDate(estimate.sent_at)}</p>
                  {estimate.approved_at && <p>Approved: {formatDate(estimate.approved_at)}</p>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
