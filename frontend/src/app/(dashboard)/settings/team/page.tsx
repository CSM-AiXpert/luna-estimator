"use client"

import { useState } from "react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ArrowLeft, Plus, Mail, Shield, Crown } from "lucide-react"
import { formatDate } from "@/lib/utils"

const MOCK_MEMBERS = [
  { id: "1", email: "brian@csm.media", full_name: "Brian Pierce", role: "owner" as const, created_at: "2025-01-15" },
  { id: "2", email: "alex@csm.media", full_name: "Alex Chen", role: "admin" as const, created_at: "2025-02-01" },
  { id: "3", email: "jordan@csm.media", full_name: "Jordan Lee", role: "member" as const, created_at: "2025-03-10" },
]

const ROLE_COLORS: Record<string, string> = {
  owner: "text-yellow-400",
  admin: "text-purple-400",
  member: "text-white/50",
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3 text-yellow-400" />,
  admin: <Shield className="h-3 w-3 text-purple-400" />,
}

export default function TeamPage() {
  const { toast } = useToast()
  const [members] = useState(MOCK_MEMBERS)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [inviting, setInviting] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    await new Promise((r) => setTimeout(r, 600))
    setInviting(false)
    toast({ title: `Invitation sent to ${inviteEmail}` })
    setIsInviteOpen(false)
    setInviteEmail("")
    setInviteRole("member")
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-white/50 text-sm mt-1">{members.length} members</p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <Plus className="h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <Card key={member.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#00d4ff]/20 to-[#3b82f6]/20 text-[#00d4ff] font-bold text-sm flex-shrink-0">
                {member.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{member.full_name}</p>
                  {ROLE_ICONS[member.role]}
                </div>
                <p className="text-xs text-white/40 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {member.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${ROLE_COLORS[member.role]} bg-current/10 border-current/20 capitalize`}>
                  {member.role}
                </Badge>
                <span className="text-xs text-white/30">{formatDate(member.created_at)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v: typeof inviteRole) => setInviteRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                  <SelectItem value="member">Member — Standard access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
