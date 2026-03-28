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
import { ArrowLeft, Plus, Mail, Phone, MapPin, FolderKanban, ChevronRight, User } from "lucide-react"
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
      <div className="min-h-screen">
        <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/[0.05] bg-[#0a0e1a]/80 px-8 py-5">
          <div className="skeleton h-8 w-48 rounded" />
        </div>
        <div className="px-8 pt-6">
          <div className="grid gap-4 grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[rgba(240,244,255,0.4)]">Customer not found</p>
      </div>
    )
  }

  const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }

  return (
    <div className="min-h-screen">
      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/[0.05] bg-[#0a0e1a]/80 px-8 py-5">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="ghost" size="icon" className="btn-ghost">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {customer.first_name} {customer.last_name}
            </h1>
          </div>
          <Button onClick={() => setIsAddProjectOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      <div className="px-8 pt-6 pb-8 animate-fade-up">
        {/* Contact Info Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card className="glass">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(0,212,255,0.1)]">
                  <Mail className="h-5 w-5 text-[#00d4ff]" />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[10px] uppercase tracking-[0.08em] text-[rgba(240,244,255,0.4)] mb-0.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Email
                  </p>
                  <p className="text-sm text-white truncate">{customer.email ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(0,212,255,0.1)]">
                  <Phone className="h-5 w-5 text-[#00d4ff]" />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[10px] uppercase tracking-[0.08em] text-[rgba(240,244,255,0.4)] mb-0.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Phone
                  </p>
                  <p className="text-sm text-white truncate">{customer.phone ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(0,212,255,0.1)]">
                  <MapPin className="h-5 w-5 text-[#00d4ff]" />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[10px] uppercase tracking-[0.08em] text-[rgba(240,244,255,0.4)] mb-0.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Address
                  </p>
                  <p className="text-sm text-white truncate">{customer.address_line1 ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <div className="mb-6">
          <h2
            className="text-lg font-semibold text-white flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <FolderKanban className="h-5 w-5 text-[#00d4ff]" />
            Projects ({projects.length})
          </h2>
        </div>

        {projectsLoading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 stagger-children">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="glass text-center py-24 rounded-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(0,212,255,0.08)] mx-auto mb-5">
              <FolderKanban className="h-8 w-8 text-[rgba(0,212,255,0.4)]" />
            </div>
            <h3
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No projects yet
            </h3>
            <p className="text-sm text-[rgba(240,244,255,0.4)] mb-6">
              Create a project for this customer to get started
            </p>
            <Button variant="secondary" className="btn-secondary" onClick={() => setIsAddProjectOpen(true)}>
              <Plus className="h-4 w-4" />
              Create First Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 stagger-children">
            {projects.map((project) => {
              const statusClass =
                project.status === "completed"
                  ? "badge badge-success"
                  : project.status === "in_progress" || project.status === "active"
                  ? "badge badge-cyan"
                  : project.status === "cancelled"
                  ? "badge badge-error"
                  : "badge badge-muted"
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="glass glass-hover h-full cursor-pointer transition-all duration-200">
                    <CardContent className="p-5">
                      <h3
                        className="font-semibold text-white flex items-center gap-2 mb-2"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {project.name}
                        <ChevronRight className="h-4 w-4 text-[rgba(240,244,255,0.3)]" />
                      </h3>
                      {project.address && (
                        <p className="text-xs text-[rgba(240,244,255,0.4)] mb-3">{project.address}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={statusClass}>
                          {STATUS_LABELS[project.status] ?? project.status}
                        </span>
                        <span className="text-xs text-[rgba(240,244,255,0.3)]">
                          {formatDate(project.created_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
        <DialogContent className="glass border border-white/[0.09]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Kitchen Renovation"
                className="input"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={projectAddress}
                onChange={(e) => setProjectAddress(e.target.value)}
                placeholder="Project address (optional)"
                className="input"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsAddProjectOpen(false)} className="btn-secondary">
                Cancel
              </Button>
              <Button type="submit" disabled={createProject.isPending} className="btn-primary">
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
