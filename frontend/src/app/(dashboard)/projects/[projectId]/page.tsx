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
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Home,
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
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-white/[0.05] rounded" />
          <div className="h-48 bg-white/[0.03] rounded-xl" />
        </div>
      </div>
    )
  }

  if (!project) {
    return <div className="p-8 text-white/50">Project not found</div>
  }

  const typedProject = project as typeof project & { customer?: { name: string; email?: string | null } }
  const subtotal = estimate?.subtotal ?? 0
  const total = estimate?.total ?? 0

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          {typedProject.customer && (
            <p className="text-sm text-[#00d4ff]">{typedProject.customer.name}</p>
          )}
        </div>
        <Badge className={`status-${project.status}`}>
          {STATUS_LABELS[project.status] ?? project.status}
        </Badge>
        <Link href={`/projects/${projectId}/estimate`}>
          <Button variant="secondary">
            <DollarSign className="h-4 w-4" />
            View Estimate
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-3 gap-6 mt-6">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00d4ff]/10">
                    <Layers className="h-5 w-5 text-[#00d4ff]" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Rooms</p>
                    <p className="text-2xl font-bold text-white">{rooms.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00d4ff]/10">
                    <DollarSign className="h-5 w-5 text-[#00d4ff]" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Estimate Total</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00d4ff]/10">
                    <FileText className="h-5 w-5 text-[#00d4ff]" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Files</p>
                    <p className="text-2xl font-bold text-white">{files.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Address</span>
                  <span className="text-white">{project.address ?? "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Created</span>
                  <span className="text-white">{formatDate(project.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Last Updated</span>
                  <span className="text-white">{formatDate(project.updated_at)}</span>
                </div>
                {typedProject.customer && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Customer</span>
                    <Link
                      href={`/customers/${project.customer_id}`}
                      className="text-[#00d4ff] hover:underline"
                    >
                      {typedProject.customer.name}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estimate Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Subtotal</span>
                  <span className="text-white">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Markup</span>
                  <span className="text-white">{formatCurrency(estimate?.markup_amount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Tax</span>
                  <span className="text-white">{formatCurrency(estimate?.tax_amount ?? 0)}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="font-medium text-white">Total</span>
                  <span className="font-bold text-[#00d4ff]">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Status</span>
                  <Badge className={`status-${estimate?.status ?? "draft"}`}>
                    {(estimate?.status ?? "draft").charAt(0).toUpperCase() + (estimate?.status ?? "draft").slice(1)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rooms">
          <div className="flex items-center justify-between mb-6 mt-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#00d4ff]" />
              Rooms ({rooms.length})
            </h2>
            <Button onClick={() => setIsAddRoomOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Room
            </Button>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-20 text-white/30 border border-dashed border-white/10 rounded-xl">
              <Home className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No rooms yet</p>
              <Button variant="secondary" className="mt-4" onClick={() => setIsAddRoomOpen(true)}>
                <Plus className="h-4 w-4" />
                Add First Room
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <Link key={room.id} href={`/projects/${projectId}/rooms/${room.id}`}>
                  <Card className="hover:bg-white/[0.06] transition-colors h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#00d4ff]/15 to-[#3b82f6]/15 flex-shrink-0">
                          <Ruler className="h-5 w-5 text-[#00d4ff]" />
                        </div>
                        <Badge className="capitalize text-xs">
                          {room.room_type}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-white mb-1">{room.name}</h3>
                      <p className="text-xs text-white/30 capitalize">{room.room_type}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Room</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddRoom} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Room Name</Label>
                  <Input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g. Master Bedroom"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Room Type</Label>
                  <Select value={roomType} onValueChange={(v: typeof roomType) => setRoomType(v)}>
                    <SelectTrigger>
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
                  <Button type="button" variant="secondary" onClick={() => setIsAddRoomOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRoom.isPending}>
                    {createRoom.isPending ? "Adding..." : "Add Room"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="files">
          <div className="mt-6">
            <FileUploader projectId={projectId} roomId={null} />
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="mt-6 text-center py-20 text-white/30">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Activity log coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
