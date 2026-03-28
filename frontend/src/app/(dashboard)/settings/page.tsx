"use client"

import { useState } from "react"
import { useOrganization } from "@/components/providers"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Globe, Clock, Settings } from "lucide-react"

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Pacific/Honolulu",
]

export default function SettingsPage() {
  const { organization, setOrganization } = useOrganization()
  const { toast } = useToast()
  const [orgName, setOrgName] = useState(organization?.name ?? "")
  const [timezone, setTimezone] = useState("America/New_York")
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    setOrganization({ ...organization!, name: orgName })
    setSaving(false)
    toast({ title: "Settings saved" })
  }

  return (
    <div className="min-h-screen">
      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/[0.05] bg-[#0a0e1a]/80 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
              Settings
            </h1>
            <p className="text-sm text-[rgba(240,244,255,0.4)] mt-0.5">Manage your organization settings</p>
          </div>
        </div>
      </div>

      <div className="px-8 pt-6 pb-8 max-w-2xl animate-fade-up">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Organization Card */}
          <Card className="glass">
            <CardHeader className="pb-4">
              <CardTitle
                className="flex items-center gap-2 text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <Globe className="h-4 w-4 text-[#00d4ff]" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Organization Name</Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your company name"
                  className="input"
                />
              </div>
            </CardContent>
          </Card>

          {/* Timezone Card */}
          <Card className="glass">
            <CardHeader className="pb-4">
              <CardTitle
                className="flex items-center gap-2 text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <Clock className="h-4 w-4 text-[#00d4ff]" />
                Timezone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Default Timezone</Label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="input"
                  style={{ appearance: "none" }}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} style={{ background: "#0d1224" }}>
                      {tz.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
