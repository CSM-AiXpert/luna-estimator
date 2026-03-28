"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useProject, useUpdateProject } from "@/lib/api/hooks/use-projects"
import { useRooms, useCreateRoom } from "@/lib/api/hooks/use-rooms"
import { useEstimate } from "@/lib/api/hooks/use-estimates"
import { useProjectFiles } from "@/lib/api/hooks/use-files"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUploader } from "@/components/files/file-uploader"
import {
  ArrowLeft,
  Plus,
  Layers,
  DollarSign,
  FileText,
  Activity,
  Ruler,
  Home,
  Package,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    params.then((p) => setProjectId(p.projectId))
  }, [params])

  if (!projectId) return null

  return <ProjectDetailInner projectId={projectId} activeTab={activeTab} setActiveTab={setActiveTab} />
}

function ProjectDetailInner({
  projectId,
  activeTab,
  setActiveTab,
}: {
  projectId: string
  activeTab: string
  setActiveTab: (v: string) => void
}) {
  const { toast } = useToast()
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false)
  const [roomName, setRoomName] = useState("")
  const [roomType, setRoomType] = useState<"living" | "bedroom" | "kitchen" | "bathroom" | "basement" | "garage" | "attic" | "office" | "other">("living")

  const { data: project, isLoading } = useProject(projectId)
  const { data: rooms = [] } = useRooms(projectId)
  const { data: estimate } = useEstimate(projectId)
  const { data: files = [] } = useProjectFiles(projectId)
  const createRoom = useCreateRoom()
  const updateProject = useUpdateProject()

  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createRoom.mutateAsync({
        project_id: projectId,
        name: roomName,
        room_type: roomType,
      })
      toast({ title: "Room added" })
      setIsAddRoomOpen(false)
      setRoomName("")
      setRoomType("living")
    } catch {
      toast({ title: "Failed to add room", variant: "error" })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div
          className="sticky top-0 z-30"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(15,17,30,0.9)",
            backdropFilter: "blur(24px)",
            padding: "20px 32px",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="skeleton h-8 w-64 rounded" />
          </div>
        </div>
        <div className="px-8 pt-6">
          <div className="grid gap-4 grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <p style={{ color: "var(--text-muted)" }}>Project not found</p>
      </div>
    )
  }

  const typedProject = project as typeof project & { customer?: { name: string; email?: string | null } }
  const subtotal = estimate?.subtotal ?? 0
  const total = estimate?.total ?? 0

  const statusBadgeClass = (status: string) => {
    if (status === "completed") return "badge badge-success"
    if (status === "in_progress" || status === "active") return "badge badge-gold"
    if (status === "cancelled") return "badge badge-error"
    return "badge badge-muted"
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Sticky Glass Header */}
      <div
        className="sticky top-0 z-30"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,17,30,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          padding: "20px 32px",
        }}
      >
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="icon" className="btn-ghost">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl font-bold text-white truncate"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {project.name}
            </h1>
            {typedProject.customer && (
              <p className="text-sm" style={{ color: "var(--accent-gold)" }}>{typedProject.customer.name}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={statusBadgeClass(project.status)}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
            <Link href={`/projects/${projectId}/estimate`}>
              <Button variant="secondary" className="btn-secondary">
                <DollarSign className="h-4 w-4" />
                View Estimate
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/materials-order`}>
              <Button variant="secondary" className="btn-secondary">
                <Package className="h-4 w-4" />
                Materials Order
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-8 pt-6 pb-8 animate-fade-up">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList
            className="rounded-xl gap-1"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "4px",
            }}
          >
            <TabsTrigger
              value="overview"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:text-white"
              style={{
                fontFamily: "var(--font-display)",
                background: activeTab === "overview" ? "rgba(226,178,74,0.12)" : "transparent",
                color: activeTab === "overview" ? "var(--accent-gold)" : "var(--text-muted)",
                border: activeTab === "overview" ? "1px solid rgba(226,178,74,0.2)" : "1px solid transparent",
              }}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="rooms"
              className="rounded-lg px-4 py-2 text-sm"
              style={{
                fontFamily: "var(--font-display)",
                background: activeTab === "rooms" ? "rgba(226,178,74,0.12)" : "transparent",
                color: activeTab === "rooms" ? "var(--accent-gold)" : "var(--text-muted)",
                border: activeTab === "rooms" ? "1px solid rgba(226,178,74,0.2)" : "1px solid transparent",
              }}
            >
              Rooms
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="rounded-lg px-4 py-2 text-sm"
              style={{
                fontFamily: "var(--font-display)",
                background: activeTab === "files" ? "rgba(226,178,74,0.12)" : "transparent",
                color: activeTab === "files" ? "var(--accent-gold)" : "var(--text-muted)",
                border: activeTab === "files" ? "1px solid rgba(226,178,74,0.2)" : "1px solid transparent",
              }}
            >
              Files
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-lg px-4 py-2 text-sm"
              style={{
                fontFamily: "var(--font-display)",
                background: activeTab === "activity" ? "rgba(226,178,74,0.12)" : "transparent",
                color: activeTab === "activity" ? "var(--accent-gold)" : "var(--text-muted)",
                border: activeTab === "activity" ? "1px solid rgba(226,178,74,0.2)" : "1px solid transparent",
              }}
            >
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-6">
              <Card className="card stat-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: "rgba(226,178,74,0.1)", border: "1px solid rgba(226,178,74,0.2)" }}
                    >
                      <Layers className="h-6 w-6" style={{ color: "var(--accent-gold)" }} />
                    </div>
                    <div>
                      <p
                        className="text-[10px] uppercase tracking-[0.08em] mb-0.5"
                        style={{ fontFamily: "var(--font-display)", color: "var(--text-muted)" }}
                      >
                        Rooms
                      </p>
                      <p
                        className="text-3xl font-extrabold tracking-[-0.03em]"
                        style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                      >
                        {rooms.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="card stat-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: "rgba(226,178,74,0.1)", border: "1px solid rgba(226,178,74,0.2)" }}
                    >
                      <DollarSign className="h-6 w-6" style={{ color: "var(--accent-gold)" }} />
                    </div>
                    <div>
                      <p
                        className="text-[10px] uppercase tracking-[0.08em] mb-0.5"
                        style={{ fontFamily: "var(--font-display)", color: "var(--text-muted)" }}
                      >
                        Estimate Total
                      </p>
                      <p
                        className="text-3xl font-extrabold tracking-[-0.03em]"
                        style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                      >
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="card stat-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: "rgba(226,178,74,0.1)", border: "1px solid rgba(226,178,74,0.2)" }}
                    >
                      <FileText className="h-6 w-6" style={{ color: "var(--accent-gold)" }} />
                    </div>
                    <div>
                      <p
                        className="text-[10px] uppercase tracking-[0.08em] mb-0.5"
                        style={{ fontFamily: "var(--font-display)", color: "var(--text-muted)" }}
                      >
                        Files
                      </p>
                      <p
                        className="text-3xl font-extrabold tracking-[-0.03em]"
                        style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                      >
                        {files.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-6">
              <Card className="card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base" style={{ fontFamily: "var(--font-display)" }}>
                    Project Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Address</span>
                    <span style={{ color: "var(--text-primary)" }}>{project.address ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Created</span>
                    <span style={{ color: "var(--text-primary)" }}>{formatDate(project.created_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Last Updated</span>
                    <span style={{ color: "var(--text-primary)" }}>{formatDate(project.updated_at)}</span>
                  </div>
                  {typedProject.customer && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: "var(--text-muted)" }}>Customer</span>
                      <Link
                        href={`/customers/${project.customer_id}`}
                        style={{ color: "var(--accent-gold)" }}
                      >
                        {typedProject.customer.name}
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base" style={{ fontFamily: "var(--font-display)" }}>
                    Estimate Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
                    <span style={{ color: "var(--text-primary)" }}>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Markup</span>
                    <span style={{ color: "var(--text-primary)" }}>{formatCurrency(estimate?.markup_amount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Tax</span>
                    <span style={{ color: "var(--text-primary)" }}>{formatCurrency(estimate?.tax_amount ?? 0)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>Total</span>
                    <span className="font-bold" style={{ color: "var(--accent-gold)" }}>{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Status</span>
                    <Badge className={`status-${estimate?.status ?? "draft"} badge badge-muted`}>
                      {(estimate?.status ?? "draft").charAt(0).toUpperCase() + (estimate?.status ?? "draft").slice(1)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rooms">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2
                  className="text-lg font-semibold flex items-center gap-2"
                  style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                >
                  <Layers className="h-5 w-5" style={{ color: "var(--accent-gold)" }} />
                  Rooms ({rooms.length})
                </h2>
              </div>
              <Button onClick={() => setIsAddRoomOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                Add Room
              </Button>
            </div>

            {rooms.length === 0 ? (
              <div className="card text-center py-24">
                <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-5" style={{ background: "rgba(226,178,74,0.08)" }}>
                  <Home className="h-8 w-8" style={{ color: "rgba(226,178,74,0.4)" }} />
                </div>
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                >
                  No rooms yet
                </h3>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                  Add your first room to start building measurements
                </p>
                <Button variant="secondary" className="btn-secondary" onClick={() => setIsAddRoomOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add First Room
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                {rooms.map((room) => (
                  <Link key={room.id} href={`/projects/${projectId}/rooms/${room.id}`}>
                    <Card className="card card-hover h-full cursor-pointer transition-all duration-200">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                            style={{ background: "rgba(226,178,74,0.1)", border: "1px solid rgba(226,178,74,0.2)" }}
                          >
                            <Ruler className="h-5 w-5" style={{ color: "var(--accent-gold)" }} />
                          </div>
                          <Badge className="badge badge-muted text-xs capitalize">
                            {room.room_type}
                          </Badge>
                        </div>
                        <h3
                          className="font-semibold mb-1"
                          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                        >
                          {room.name}
                        </h3>
                        <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{room.room_type}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {/* Add Room Dialog */}
            <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
              <DialogContent className="card">
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Add Room</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddRoom} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Room Name</Label>
                    <Input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="e.g. Master Bedroom"
                      className="input"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Room Type</Label>
                    <Select value={roomType} onValueChange={(v: typeof roomType) => setRoomType(v)}>
                      <SelectTrigger className="input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="living">Living Room</SelectItem>
                        <SelectItem value="bedroom">Bedroom</SelectItem>
                        <SelectItem value="kitchen">Kitchen</SelectItem>
                        <SelectItem value="bathroom">Bathroom</SelectItem>
                        <SelectItem value="basement">Basement</SelectItem>
                        <SelectItem value="garage">Garage</SelectItem>
                        <SelectItem value="attic">Attic</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setIsAddRoomOpen(false)} className="btn-secondary">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRoom.isPending} className="btn-primary">
                      {createRoom.isPending ? "Adding..." : "Add Room"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="files">
            <div className="mt-2">
              <FileUploader projectId={projectId} roomId={null} />
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="card text-center py-24">
              <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-5" style={{ background: "rgba(226,178,74,0.08)" }}>
                <Activity className="h-8 w-8" style={{ color: "rgba(226,178,74,0.4)" }} />
              </div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
              >
                Activity log coming soon
              </h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Track all project changes and updates here
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
