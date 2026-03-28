"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { useAuth, useOrganization } from "@/components/providers"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Mail, Shield, Crown, Loader2, Building2 } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"
import type { User } from "@/lib/supabase/types"

const ROLE_COLORS: Record<string, string> = {
  owner: "#f59e0b",
  admin: "#a855f7",
  member: "rgba(240,244,255,0.5)",
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

export default function TeamPage() {
  const { user } = useAuth()
  const { organization } = useOrganization()
  const { toast } = useToast()
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [inviting, setInviting] = useState(false)

  const { data: members, isLoading } = useQuery<User[]>({
    queryKey: ["org-members", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return []
      const sb = getSupabaseClient()
      if (!sb) throw new Error("Auth unavailable")
      const { data, error } = await sb
        .from("users")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!organization?.id,
  })

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const sb = getSupabaseClient()
      // Call the invite API route
      const res = await fetch("/api/invite-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Invitation failed")
      }
      toast({ title: `Invitation sent to ${inviteEmail}`, description: "They'll receive an email to join your organization." })
      setIsInviteOpen(false)
      setInviteEmail("")
      setInviteRole("member")
    } catch (err) {
      toast({ title: "Invitation failed", description: err instanceof Error ? err.message : "Try again" })
    } finally {
      setInviting(false)
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
              <h1
                className="font-bold"
                style={{ fontFamily: "var(--font-display)", fontSize: "18px", letterSpacing: "-0.02em" }}
              >
                Team
              </h1>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                {organization?.name ?? "Your organization"} · {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button onClick={() => setIsInviteOpen(true)} className="btn-primary" style={{ height: "36px", fontSize: "13px" }}>
            <Plus className="h-3.5 w-3.5" />
            Invite Member
          </Button>
        </div>
      </header>

      <div className="p-8 max-w-2xl">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass" style={{ padding: "16px", display: "flex", gap: "16px", alignItems: "center" }}>
                <div className="skeleton" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                <div className="flex-1 space-y-2">
                  <div className="skeleton" style={{ height: "14px", width: "40%", borderRadius: "4px" }} />
                  <div className="skeleton" style={{ height: "12px", width: "25%", borderRadius: "4px" }} />
                </div>
              </div>
            ))}
          </div>
        ) : members?.length === 0 ? (
          <div className="glass text-center py-12">
            <div
              style={{
                width: "56px", height: "56px", borderRadius: "16px",
                background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              }}
            >
              <Building2 className="h-6 w-6" style={{ color: "var(--accent-cyan)" }} />
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>No team members yet</p>
            <Button onClick={() => setIsInviteOpen(true)} className="btn-primary mt-4" style={{ height: "36px" }}>
              <Plus className="h-3.5 w-3.5" /> Invite first member
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {(members ?? []).map((member) => (
              <div
                key={member.id}
                className="glass glass-hover"
                style={{ padding: "16px", display: "flex", gap: "16px", alignItems: "center" }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                    background: `linear-gradient(135deg, ${ROLE_COLORS[member.role] ?? "#6b7280"}20, ${ROLE_COLORS[member.role] ?? "#6b7280"}10)`,
                    border: `1px solid ${ROLE_COLORS[member.role] ?? "#6b7280"}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", fontWeight: 700,
                    color: ROLE_COLORS[member.role] ?? "var(--text-muted)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {(member.full_name ?? member.email ?? "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      style={{
                        fontFamily: "var(--font-display)", fontWeight: 600,
                        fontSize: "14px", color: "var(--text-primary)",
                      }}
                    >
                      {member.full_name ?? "—"}
                    </p>
                    {member.id === user?.id && (
                      <span style={{ fontSize: "10px", color: "var(--accent-cyan)", fontFamily: "var(--font-display)", fontWeight: 600, background: "rgba(0,212,255,0.08)", padding: "1px 6px", borderRadius: "99px", border: "1px solid rgba(0,212,255,0.2)" }}>
                        You
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                    {member.email}
                  </p>
                </div>

                {/* Role badge + date */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "3px 10px", borderRadius: "99px",
                      fontSize: "11px", fontFamily: "var(--font-display)", fontWeight: 600,
                      background: `${ROLE_COLORS[member.role] ?? "#6b7280"}15`,
                      color: ROLE_COLORS[member.role] ?? "var(--text-muted)",
                      border: `1px solid ${ROLE_COLORS[member.role] ?? "#6b7280"}25`,
                    }}
                  >
                    {member.role === "owner" && <Crown className="h-3 w-3" />}
                    {member.role === "admin" && <Shield className="h-3 w-3" />}
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-disabled)" }}>
                    Joined {formatDate(member.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
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
              background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)",
              margin: "-16px -16px 0",
            }}
          />
          <DialogHeader style={{ paddingTop: "8px" }}>
            <DialogTitle style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px" }}>
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label style={{ fontSize: "12px", fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Email Address
              </Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="input"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ fontSize: "12px", fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Role
              </Label>
              <Select value={inviteRole} onValueChange={(v: "admin" | "member") => setInviteRole(v)}>
                <SelectTrigger className="input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{ background: "rgba(13,18,36,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <SelectItem value="admin" style={{ color: "var(--text-primary)" }}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" style={{ color: "#a855f7" }} />
                      Admin — Full access
                    </div>
                  </SelectItem>
                  <SelectItem value="member" style={{ color: "var(--text-primary)" }}>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" style={{ color: "rgba(240,244,255,0.5)" }} />
                      Member — Standard access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter style={{ gap: "8px" }}>
              <Button type="button" variant="secondary" onClick={() => setIsInviteOpen(false)} className="btn-secondary">
                Cancel
              </Button>
              <Button type="submit" disabled={inviting} className="btn-primary">
                {inviting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Mail className="h-4 w-4" /> Send Invitation</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
