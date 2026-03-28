"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useOrganization } from "@/components/providers"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Link2,
  Unlink,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Settings,
  Zap,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface GHLIntegration {
  id: string
  organization_id: string
  is_active: boolean
  auth_type: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  location_id: string
  pipeline_id: string | null
  default_stage_id: string | null
  field_mappings: Record<string, string>
  auto_sync_contacts: boolean
  auto_sync_estimates: boolean
  webhook_secret: string | null
  created_at: string
  updated_at: string
}

export default function GHLPage() {
  const { organization } = useOrganization()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [connectForm, setConnectForm] = useState({
    clientId: "",
    clientSecret: "",
    locationId: "",
    authType: "private_integration",
  })
  const [connecting, setConnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Fetch GHL integration settings
  const { data: settings, isLoading } = useQuery<GHLIntegration | null>({
    queryKey: ["ghl-settings", organization?.id],
    queryFn: async () => {
      const res = await fetch(`/api/ghl-settings`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    enabled: !!organization?.id,
  })

  const isConnected = settings?.is_active && !!settings?.access_token

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<GHLIntegration>) => {
      const res = await fetch(`/api/ghl-settings`, {
        method: isConnected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Save failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-settings", organization?.id] })
      toast({ title: "Settings saved" })
    },
    onError: () => toast({ title: "Save failed", description: "Try again" }),
  })

  // Connect to GHL
  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnecting(true)
    try {
      const res = await fetch("/api/ghl-settings/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...connectForm,
          organizationId: organization?.id,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Connection failed")
      }
      toast({ title: "GHL Connected!", description: "Your GoHighLevel account is now linked." })
      setConnectDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["ghl-settings", organization?.id] })
    } catch (err) {
      toast({ title: "Connection failed", description: err instanceof Error ? err.message : "Check your credentials" })
    } finally {
      setConnecting(false)
    }
  }

  // Disconnect
  async function handleDisconnect() {
    if (!confirm("Disconnect GHL? This won't delete your synced data.")) return
    saveMutation.mutate({ is_active: false, access_token: null, refresh_token: null })
  }

  // Test connection
  async function handleTestConnection() {
    setTesting(true)
    try {
      const res = await fetch("/api/ghl-settings/test", { method: "POST" })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast({ title: "✅ GHL Connection OK", description: `Location: ${data.locationName ?? "connected"}` })
      } else {
        toast({ title: "❌ Connection test failed", description: data.error ?? "Check your settings" })
      }
    } catch {
      toast({ title: "Connection test failed" })
    } finally {
      setTesting(false)
    }
  }

  // Trigger a manual sync
  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/ghl-settings/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "Sync started", description: `${data.records_synced ?? 0} records synced` })
      } else {
        toast({ title: "Sync failed", description: data.error })
      }
    } catch {
      toast({ title: "Sync failed" })
    } finally {
      setSyncing(false)
    }
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
            <Link href="/settings" style={{ textDecoration: "none" }}>
              <button className="btn-ghost" style={{ width: "36px", height: "36px", padding: 0, justifyContent: "center" }}>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            <div>
              <h1 className="font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "18px", letterSpacing: "-0.02em" }}>
                GoHighLevel Integration
              </h1>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                Connect your GHL account to sync contacts and deals
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn-secondary"
                  style={{ height: "34px", fontSize: "13px" }}
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Test
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn-secondary"
                  style={{ height: "34px", fontSize: "13px" }}
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync Now
                </Button>
              </>
            )}
            {isConnected ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDisconnect}
                className="btn-secondary"
                style={{ height: "34px", fontSize: "13px", color: "rgba(239,68,68,0.8)" }}
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setConnectDialogOpen(true)}
                className="btn-primary"
                style={{ height: "34px", fontSize: "13px" }}
              >
                <Link2 className="h-4 w-4" />
                Connect GHL
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="p-8 max-w-2xl space-y-6">
        {/* Status */}
        <div
          className="card"
          style={{
            padding: "20px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            border: isConnected ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(245,158,11,0.25)",
          }}
        >
          <div
            style={{
              width: "48px", height: "48px", borderRadius: "14px", flexShrink: 0,
              background: isConnected ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
              border: `1px solid ${isConnected ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {isConnected ? (
              <CheckCircle className="h-6 w-6" style={{ color: "#10b981" }} />
            ) : (
              <XCircle className="h-6 w-6" style={{ color: "#f59e0b" }} />
            )}
          </div>
          <div>
            <p
              style={{
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "15px",
                color: isConnected ? "#10b981" : "rgba(245,158,11,0.9)",
              }}
            >
              {isConnected ? "Connected to GoHighLevel" : "Not Connected"}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              {isConnected
                ? `Location ID: ${settings?.location_id} · Last updated ${settings?.updated_at ? format(new Date(settings.updated_at), "MMM d, yyyy") : "—"}`
                : "Link your GHL account to sync contacts and pipeline data"}
            </p>
          </div>
        </div>

        {/* Auto-sync toggles */}
        {isConnected && (
          <>
            <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>
                  Auto-Sync
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Automatically sync data when changes are made
                </p>
              </div>
              {[
                { key: "auto_sync_contacts", label: "Contacts", desc: "Sync new and updated customers" },
                { key: "auto_sync_estimates", label: "Estimates", desc: "Push estimates to GHL opportunities" },
              ].map(({ key, label, desc }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{desc}</p>
                  </div>
                  <Switch
                    checked={(settings as unknown as Record<string, boolean>)?.[key] ?? false}
                    onCheckedChange={(checked) => saveMutation.mutate({ [key]: checked })}
                    disabled={saveMutation.isPending}
                  />
                </div>
              ))}
            </div>

            {/* Field mappings */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>
                  Field Mappings
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  How GHL contact fields map to Luna customer fields
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { ghl: "contact.name", luna: "Customer name" },
                  { ghl: "contact.email", luna: "Email" },
                  { ghl: "contact.phone", luna: "Phone" },
                  { ghl: "contact.address", luna: "Address" },
                  { ghl: "opportunity.name", luna: "Project name" },
                  { ghl: "opportunity.value", luna: "Estimate total" },
                  { ghl: "opportunity.stage", luna: "Project status" },
                ].map((mapping) => (
                  <div key={mapping.ghl} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <code
                      style={{
                        flex: 1, fontFamily: "var(--font-mono)", fontSize: "12px",
                        padding: "6px 10px", borderRadius: "6px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#e2b4a",
                      }}
                    >
                      {mapping.ghl}
                    </code>
                    <span style={{ color: "var(--text-disabled)", fontSize: "12px" }}>→</span>
                    <span style={{ flex: 1, fontSize: "13px", color: "var(--text-secondary)" }}>
                      {mapping.luna}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline info */}
            {settings?.pipeline_id && (
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Zap className="h-4 w-4" style={{ color: "#e2b4a" }} />
                  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "14px" }}>
                    Active Pipeline
                  </h3>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Pipeline ID: <code style={{ fontFamily: "var(--font-mono)", color: "#e2b4a" }}>{settings.pipeline_id}</code>
                </p>
              </div>
            )}
          </>
        )}

        {/* Help text */}
        {!isConnected && (
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>
              How to connect
            </h3>
            <ol style={{ fontSize: "13px", color: "var(--text-muted)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Log in to your GoHighLevel account</li>
              <li>Go to <strong style={{ color: "var(--text-secondary)" }}>Settings → Integrations → Private Integrations</strong></li>
              <li>Create a new Private Integration with read/write access</li>
              <li>Copy the <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#e2b4a" }}>Client ID</code>, <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#e2b4a" }}>Client Secret</code>, and your <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#e2b4a" }}>Location ID</code></li>
              <li>Paste those values here and click <strong style={{ color: "var(--text-secondary)" }}>Connect GHL</strong></li>
            </ol>
            <a
              href="https://help.gohighlevel.com/support/solutions/articles/48001071023-private-integration"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "12px", fontSize: "13px", color: "#e2b4a" }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              GHL Private Integration Guide
            </a>
          </div>
        )}
      </div>

      {/* Connect Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent
          style={{
            background: "rgba(13,18,36,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--radius-xl)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div
            style={{
              height: "2px",
              borderRadius: "18px 18px 0 0",
              background: "linear-gradient(90deg, transparent, rgba(226, 178, 74,0.5), transparent)",
              margin: "-16px -16px 0",
            }}
          />
          <DialogHeader style={{ paddingTop: "8px" }}>
            <DialogTitle style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px" }}>
              Connect GoHighLevel
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConnect} className="space-y-4">
            {[
              { id: "locationId", label: "Location ID", placeholder: "Your GHL Location ID", type: "text" },
              { id: "clientId", label: "Client ID", placeholder: "Your GHL Client ID", type: "text" },
              { id: "clientSecret", label: "Client Secret", placeholder: "Your GHL Client Secret", type: "password" },
            ].map(({ id, label, placeholder, type }) => (
              <div key={id} className="space-y-1.5">
                <Label
                  htmlFor={id}
                  style={{ fontSize: "12px", fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}
                >
                  {label}
                </Label>
                <Input
                  id={id}
                  type={type}
                  value={(connectForm as Record<string, string>)[id]}
                  onChange={(e) => setConnectForm({ ...connectForm, [id]: e.target.value })}
                  placeholder={placeholder}
                  className="input"
                  required
                />
              </div>
            ))}
            <DialogFooter style={{ gap: "8px", marginTop: "8px" }}>
              <Button type="button" variant="secondary" onClick={() => setConnectDialogOpen(false)} className="btn-secondary">
                Cancel
              </Button>
              <Button type="submit" disabled={connecting} className="btn-primary">
                {connecting ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</> : <><Link2 className="h-4 w-4" /> Connect</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
