"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useCustomer } from "@/lib/api/hooks/use-customers"
import { useProjectsByCustomer, useCreateProject } from "@/lib/api/hooks/use-projects"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Mail, Phone, MapPin, FolderKanban, ChevronRight } from "lucide-react"
import { formatDate } from "@/lib/utils"

const ORG_ID = "demo-org"

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const [customerId, setCustomerId] = useState<string | null>(null)

  useEffect(() => {
    params.then((p) => setCustomerId(p.customerId))
  }, [params])

  if (!customerId) return null

  return <CustomerDetailInner customerId={customerId} />
}

function CustomerDetailInner({ customerId }: { customerId: string }) {
  const { toast } = useToast()
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [projectAddress, setProjectAddress] = useState("")

  const { data: customer, isLoading: customerLoading } = useCustomer(customerId)
  const { data: projects = [], isLoading: projectsLoading } = useProjectsByCustomer(customerId)
  const createProject = useCreateProject()

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createProject.mutateAsync({
        organization_id: ORG_ID,
        customer_id: customerId,
        name: projectName,
        address: projectAddress || null,
        status: "lead",
      })
      toast({ title: "Project created" })
      setIsAddProjectOpen(false)
      setProjectName("")
      setProjectAddress("")
    } catch {
      toast({ title: "Failed to create project", variant: "error" })
    }
  }

  if (customerLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-white/[0.05] rounded" />
          <div className="h-32 bg-white/[0.03] rounded-xl" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return <div className="p-8 text-white/50">Customer not found</div>
  }

  const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{customer.first_name} {customer.last_name}</h1>
        </div>
        <Button onClick={() => setIsAddProjectOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00d4ff]/10">
                <Mail className="h-4 w-4 text-[#00d4ff]" />
              </div>
              <div>
                <p className="text-xs text-white/40">Email</p>
                <p className="text-sm text-white">{customer.email ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00d4ff]/10">
                <Phone className="h-4 w-4 text-[#00d4ff]" />
              </div>
              <div>
                <p className="text-xs text-white/40">Phone</p>
                <p className="text-sm text-white">{customer.phone ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00d4ff]/10">
                <MapPin className="h-4 w-4 text-[#00d4ff]" />
              </div>
              <div>
                <p className="text-xs text-white/40">Address</p>
                <p className="text-sm text-white">{customer.address_line1 ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-[#00d4ff]" />
          Projects ({projects.length})
        </h2>
      </div>

      {projectsLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-white/30 border border-dashed border-white/10 rounded-xl">
          <p>No projects yet</p>
          <Button variant="secondary" className="mt-4" onClick={() => setIsAddProjectOpen(true)}>
            <Plus className="h-4 w-4" />
            Create First Project
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:bg-white/[0.05] transition-colors h-full">
                <CardContent className="p-5">
                  <h3 className="font-medium text-white flex items-center gap-2">
                    {project.name}
                    <ChevronRight className="h-4 w-4 text-white/30" />
                  </h3>
                  {project.address && (
                    <p className="text-xs text-white/40 mt-1">{project.address}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`status-${project.status}`}>
                      {STATUS_LABELS[project.status] ?? project.status}
                    </Badge>
                    <span className="text-xs text-white/30">
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Kitchen Renovation"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={projectAddress}
                onChange={(e) => setProjectAddress(e.target.value)}
                placeholder="Project address (optional)"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsAddProjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
