"use client"

import { useState } from "react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Link2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react"

export default function GhLSettingsPage() {
  const { toast } = useToast()
  const [connected, setConnected] = useState(false)
  const [locationId, setLocationId] = useState("")
  const [pipelineId, setPipelineId] = useState("")
  const [token, setToken] = useState("")
  const [fieldMappings, setFieldMappings] = useState(
    JSON.stringify({ customer_name: "name", customer_email: "email", estimate_total: "total" }, null, 2)
  )
  const [autoSyncContacts, setAutoSyncContacts] = useState(false)
  const [autoSyncEstimates, setAutoSyncEstimates] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  async function handleSave() {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    toast({ title: "GHL settings saved" })
  }

  async function handleTestConnection() {
    setTesting(true)
    await new Promise((r) => setTimeout(r, 1200))
    setTesting(false)
    const success = token.length > 0 && locationId.length > 0
    if (success) {
      setConnected(true)
      toast({ title: "Connection successful" })
    } else {
      setConnected(false)
      toast({ title: "Connection failed — check your credentials", variant: "error" })
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Go High Level Integration</h1>
          <p className="text-white/50 text-sm mt-1">Connect your GHL account to sync contacts and estimates</p>
        </div>
      </div>

      {/* Connection Status */}
      <Card className="mb-6">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              connected ? "bg-green-500/10" : "bg-white/5"
            }`}>
              {connected ? (
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              ) : (
                <Link2 className="h-5 w-5 text-white/30" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">Connection Status</p>
              <Badge className={connected ? "status-approved mt-1" : "status-draft mt-1"}>
                {connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
          {connected && (
            <Button variant="secondary" size="sm" onClick={() => setConnected(false)}>
              Disconnect
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Location ID</Label>
              <Input
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder="0y2jUMFpRTn2Fsae9LzE"
              />
              <p className="text-xs text-white/30">Found in GHL → Settings → Business Info</p>
            </div>
            <div className="space-y-1.5">
              <Label>Pipeline ID</Label>
              <Input
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                placeholder="Optional"
              />
              <p className="text-xs text-white/30">Found in GHL → Opportunities → Pipelines</p>
            </div>
            <div className="space-y-1.5">
              <Label>Private Integration Token</Label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="••••••••••••••••"
              />
              <p className="text-xs text-white/30">
                Generate in GHL → Settings → Integrations → API Keys
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Field Mappings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Field Mappings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/50">
              Map Luna fields to GHL custom fields. Uses JSON format.
            </p>
            <textarea
              value={fieldMappings}
              onChange={(e) => setFieldMappings(e.target.value)}
              className="w-full h-40 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white font-mono"
            />
          </CardContent>
        </Card>

        {/* Auto-sync */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white">Sync Contacts</p>
                <p className="text-xs text-white/30">Automatically sync new customers to GHL</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoSyncContacts(!autoSyncContacts)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoSyncContacts ? "bg-[#00d4ff]" : "bg-white/10"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoSyncContacts ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white">Sync Estimates</p>
                <p className="text-xs text-white/30">Push approved estimates to GHL opportunities</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoSyncEstimates(!autoSyncEstimates)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoSyncEstimates ? "bg-[#00d4ff]" : "bg-white/10"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoSyncEstimates ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleTestConnection} disabled={testing}>
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  )
}
