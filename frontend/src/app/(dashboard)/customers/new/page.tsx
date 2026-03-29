"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function NewCustomerPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name || !form.last_name) {
      setError("First and last name are required")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create customer")
      }
      router.push("/customers")
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
          <Link href="/customers">
            <button className="btn-ghost" style={{ height: "36px", width: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
              Add New Customer
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              Add a client to your roster
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

          {/* Name row */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "#ffffff", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
              Contact Information
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    First Name *
                  </label>
                  <input
                    className="input"
                    placeholder="John"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    Last Name *
                  </label>
                  <input
                    className="input"
                    placeholder="Doe"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Company Name
                </label>
                <input
                  className="input"
                  placeholder="Acme Construction LLC"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Contact row */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "16px" }}>
              Contact Details
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Email
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Phone
                </label>
                <input
                  className="input"
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Address row */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "16px" }}>
              Address
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Street Address
                </label>
                <input
                  className="input"
                  placeholder="123 Main St"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-1">
                  <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    City
                  </label>
                  <input
                    className="input"
                    placeholder="Hardeeville"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    State
                  </label>
                  <input
                    className="input"
                    placeholder="SC"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label style={{ fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    ZIP
                  </label>
                  <input
                    className="input"
                    placeholder="29927"
                    value={form.zip_code}
                    onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/customers">
              <button type="button" className="btn-secondary">
                Cancel
              </button>
            </Link>
            <button type="submit" className="btn-primary" disabled={isLoading} style={{ height: "40px", padding: "0 20px", fontSize: "14px" }}>
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
