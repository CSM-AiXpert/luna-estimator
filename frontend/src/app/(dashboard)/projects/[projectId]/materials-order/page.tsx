"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  Package,
  Loader2,
  FileDown,
  Check,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Printer,
  Edit3,
  Save,
  X,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface OrderItem {
  id?: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  supplier_part_number?: string
  brand?: string
  in_stock?: boolean
  notes?: string
  ordered?: boolean
  sort_order?: number
}

interface MaterialsOrder {
  id: string
  project_id: string
  version: number
  status: "draft" | "finalized" | "ordered" | "cancelled"
  total_cost: number
  notes: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

const CATEGORY_ORDER = ["Drywall", "Paint", "Trim & Molding", "Fasteners", "Prep & Misc"]

const CATEGORY_ICONS: Record<string, string> = {
  "Drywall": "📋",
  "Paint": "🎨",
  "Trim & Molding": "📏",
  "Fasteners": "🔩",
  "Prep & Misc": "🧱",
}

function categoryGradient(category: string): string {
  const map: Record<string, string> = {
    "Drywall": "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(59,130,246,0.06))",
    "Paint": "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(236,72,153,0.06))",
    "Trim & Molding": "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(234,179,8,0.06))",
    "Fasteners": "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.06))",
    "Prep & Misc": "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(249,115,22,0.06))",
  }
  return map[category] ?? "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))"
}

export default function MaterialsOrderPage({
  params,
}: {
  params: { projectId: string }
}) {
  const { projectId } = params
  const queryClient = useQueryClient()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Fetch existing orders
  const { data: orders, isLoading: ordersLoading } = useQuery<MaterialsOrder[]>({
    queryKey: ["materials-orders", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/materials-orders?project_id=${projectId}`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const latestOrder = orders?.[0]

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      setGenerateError(null)
      const res = await fetch("/api/materials-order/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Generation failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials-orders", projectId] })
    },
  })

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Partial<OrderItem> }) => {
      const res = await fetch(`/api/materials-orders/${latestOrder?.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Update failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials-orders", projectId] })
      setEditingId(null)
      setEditValue(null)
    },
  })

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const groupedItems = latestOrder?.items
    ? CATEGORY_ORDER.reduce((acc, cat) => {
        const catItems = (latestOrder.items ?? []).filter((i) => i.category === cat)
        if (catItems.length) acc[cat] = catItems
        return acc
      }, {} as Record<string, OrderItem[]>)
    : {}

  const handleQtyEdit = (item: OrderItem) => {
    setEditingId(item.id!)
    setEditValue(item.quantity)
  }

  const handleQtySave = (item: OrderItem) => {
    if (editValue !== null && editValue !== item.quantity) {
      updateItemMutation.mutate({
        itemId: item.id!,
        updates: { quantity: editValue, total_cost: editValue * item.unit_cost },
      })
    } else {
      setEditingId(null)
      setEditValue(null)
    }
  }

  const handlePrint = () => window.print()

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; bg: string }> = {
      draft: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
      finalized: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
      ordered: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
      cancelled: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
    }
    const s = map[status] ?? map.draft
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: "4px",
          padding: "3px 10px", borderRadius: "99px",
          fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 600,
          textTransform: "capitalize",
          background: s.bg, color: s.color,
          border: `1px solid ${s.color}25`,
        }}
      >
        {status === "ordered" && <Check className="h-3 w-3" />}
        {status}
      </span>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,14,26,0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          position: "sticky", top: 0, zIndex: 30,
        }}
      >
        <div className="flex items-center justify-between px-8" style={{ height: "68px" }}>
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`} style={{ textDecoration: "none" }}>
              <button className="btn-ghost" style={{ width: "36px", height: "36px", padding: 0, justifyContent: "center" }}>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1
                  className="font-bold"
                  style={{ fontFamily: "var(--font-display)", fontSize: "17px", letterSpacing: "-0.02em" }}
                >
                  Materials Order
                </h1>
                {latestOrder && statusBadge(latestOrder.status)}
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                {project?.name ?? "—"} · Generated {latestOrder ? new Date(latestOrder.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {latestOrder && (
              <>
                <button className="btn-ghost" onClick={handlePrint} style={{ height: "36px" }}>
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  className="btn-secondary"
                  style={{ height: "36px", fontSize: "13px" }}
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Regenerate
                </button>
              </>
            )}
            <button
              className="btn-primary"
              style={{ height: "36px", fontSize: "13px" }}
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              {latestOrder ? "Regenerate" : "Generate Order"}
            </button>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-5xl mx-auto">
        {generateError && (
          <div
            style={{
              padding: "12px 16px", borderRadius: "var(--radius)", marginBottom: "20px",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              display: "flex", alignItems: "center", gap: "8px",
              fontSize: "13px", color: "rgba(239,68,68,0.9)",
            }}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {generateError}
          </div>
        )}

        {!latestOrder && !ordersLoading && (
          <div
            className="glass text-center py-16"
            style={{ padding: "48px" }}
          >
            <div
              style={{
                width: "72px", height: "72px", borderRadius: "20px",
                background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Package className="h-8 w-8" style={{ color: "var(--accent-cyan)" }} />
            </div>
            <h3
              className="font-bold mb-2"
              style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}
            >
              No materials order yet
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", maxWidth: "320px", margin: "0 auto 24px" }}>
              Generate a full materials purchase order based on your project measurements and estimate.
            </p>
            <button
              className="btn-primary"
              style={{ height: "44px", padding: "0 24px", fontSize: "14px" }}
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Generate Materials Order
            </button>
          </div>
        )}

        {latestOrder && (
          <>
            {/* Order summary bar */}
            <div
              className="glass mb-6"
              style={{
                padding: "16px 24px",
                display: "flex",
                alignItems: "center",
                gap: "24px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ fontSize: "10px", fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                  Total Items
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  {latestOrder.items?.length ?? 0}
                </p>
              </div>
              <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.06)" }} />
              <div>
                <p style={{ fontSize: "10px", fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                  Categories
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  {Object.keys(groupedItems).length}
                </p>
              </div>
              <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.06)" }} />
              <div>
                <p style={{ fontSize: "10px", fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                  Grand Total
                </p>
                <p
                  className="text-gradient"
                  style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em" }}
                >
                  {formatCurrency(latestOrder.total_cost)}
                </p>
              </div>
              <div style={{ flex: 1 }} />
              {latestOrder.notes && (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "300px", textAlign: "right" }}>
                  {latestOrder.notes}
                </p>
              )}
            </div>

            {/* Category sections */}
            <div className="space-y-4">
              {CATEGORY_ORDER.map((category) => {
                const items = groupedItems[category]
                if (!items?.length) return null
                const catTotal = items.reduce((s, i) => s + i.total_cost, 0)
                const expanded = expandedCategories.has(category)

                return (
                  <div key={category} className="glass" style={{ overflow: "hidden" }}>
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      style={{
                        width: "100%",
                        padding: "16px 20px",
                        background: categoryGradient(category),
                        border: "none",
                        borderBottom: expanded ? "1px solid rgba(255,255,255,0.05)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <span style={{ fontSize: "18px" }}>{CATEGORY_ICONS[category]}</span>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "14px",
                          color: "var(--text-primary)",
                          flex: 1,
                          textAlign: "left",
                        }}
                      >
                        {category}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 600,
                          fontSize: "12px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {items.length} item{items.length !== 1 ? "s" : ""}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "13px",
                          color: "var(--accent-cyan)",
                        }}
                      >
                        {formatCurrency(catTotal)}
                      </span>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                      ) : (
                        <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>

                    {/* Items */}
                    {expanded && (
                      <div>
                        <table style={{ width: "100%" }}>
                          <thead>
                            <tr>
                              {["Description", "Qty", "Unit", "Unit Cost", "Total", "Brand / SKU", ""].map((h) => (
                                <th key={h} style={{ padding: "10px 16px", textAlign: h === "Total" || h === "Qty" || h === "Unit Cost" ? "right" : "left" }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr key={item.id}>
                                <td style={{ padding: "12px 16px" }}>
                                  <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                                    {item.description}
                                  </p>
                                  {item.supplier_part_number && (
                                    <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                                      #{item.supplier_part_number}
                                    </p>
                                  )}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  {editingId === item.id ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                                      <input
                                        type="number"
                                        value={editValue ?? item.quantity}
                                        onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => e.key === "Enter" && handleQtySave(item)}
                                        autoFocus
                                        style={{
                                          width: "64px", padding: "4px 8px",
                                          background: "rgba(0,212,255,0.06)",
                                          border: "1px solid rgba(0,212,255,0.3)",
                                          borderRadius: "6px",
                                          color: "var(--text-primary)",
                                          fontSize: "13px",
                                          textAlign: "right",
                                          outline: "none",
                                        }}
                                      />
                                      <button
                                        onClick={() => handleQtySave(item)}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success)", padding: "2px" }}
                                      >
                                        <Save className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => { setEditingId(null); setEditValue(null) }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                                      <span
                                        style={{
                                          fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500,
                                          color: "var(--text-primary)",
                                        }}
                                      >
                                        {item.quantity}
                                      </span>
                                      <button
                                        onClick={() => handleQtyEdit(item)}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-disabled)", padding: "1px", borderRadius: "3px" }}
                                        title="Edit quantity"
                                      >
                                        <Edit3 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{item.unit}</span>
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)" }}>
                                    {formatCurrency(item.unit_cost)}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  <span
                                    style={{
                                      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "13px",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    {formatCurrency(item.total_cost)}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                    {item.brand ?? "—"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Grand total footer */}
            <div
              className="glass mt-6"
              style={{
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "2px solid rgba(0,212,255,0.15)",
              }}
            >
              <div>
                <p style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                  Grand Total
                </p>
                <p
                  className="text-gradient"
                  style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.03em" }}
                >
                  {formatCurrency(latestOrder.total_cost)}
                </p>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn-secondary" style={{ height: "40px" }}>
                  <Printer className="h-4 w-4" />
                  Print Order
                </button>
                <button className="btn-primary" style={{ height: "40px" }}>
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
