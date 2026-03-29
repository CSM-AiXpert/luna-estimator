"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"

interface CustomerOption {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
}

const PROJECT_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "intake", label: "Intake" },
  { value: "bid", label: "Bid" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

export default function NewProjectPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [form, setForm] = useState({
    customer_id: "",
    name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    status: "lead",
    estimated_start_date: "",
    estimated_end_date: "",
  })

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomers(data)
        setLoadingCustomers(false)
      })
      .catch(() => setLoadingCustomers(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { setError("Project name is required"); return }
    if (!form.customer_id) { setError("Please select a customer"); return }
    setIsLoading(true)
    setError(null)
    try {
      const payload = {
        customer_id: form.customer_id,
        name: form.name,
        address: [form.address, form.city, form.state, form.zip_code].filter(Boolean).join(", ") || null,
        status: form.status,
        estimated_start_date: form.estimated_start_date || null,
        estimated_end_date: form.estimated_end_date || null,
      }
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create project")
      }
      router.push("/projects")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(15,17,30,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "20px 32px",
        }}
      >
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <button className="btn-ghost" style={{ height: "36px", width: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
              New Project
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              Create a new construction project
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: "680px" }}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div style={{
              padding: "12px 16px",
              borderRadius: "8px",
              background: "rgba(235,87,87,0.08)",
              border: "1px solid rgba(235,87,87,0.2)",
              fontSize: "14px",
              color: "#eb5757",
            }}>
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "16px" }}>
              Project Details
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Project Name *
                </label>
                <input
                  className="input"
                  placeholder="Kitchen Renovation — 123 Main St"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Customer *
                </label>
                <select
                  className="input"
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  style={{ cursor: "pointer" }}
                  disabled={loadingCustomers}
                >
                  <option value="">{loadingCustomers ? "Loading customers…" : "Select a customer…"}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name ?? `${c.first_name} ${c.last_name}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Status
                </label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={{ cursor: "pointer" }}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "16px" }}>
              Project Address
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Street Address
                </label>
                <input className="input" placeholder="123 Main St" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>City</label>
                  <input className="input" placeholder="Hardeeville" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>State</label>
                  <input className="input" placeholder="SC" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>ZIP</label>
                  <input className="input" placeholder="29927" value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "16px" }}>
              Estimated Timeline
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Est. Start Date
                </label>
                <input type="date" className="input" value={form.estimated_start_date} onChange={(e) => setForm({ ...form, estimated_start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Est. End Date
                </label>
                <input type="date" className="input" value={form.estimated_end_date} onChange={(e) => setForm({ ...form, estimated_end_date: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/projects">
              <button type="button" className="btn-secondary">Cancel</button>
            </Link>
            <button type="submit" className="btn-primary" disabled={isLoading} style={{ height: "40px", padding: "0 20px", fontSize: "14px" }}>
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
