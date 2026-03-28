"use client"

import { useState } from "react"
import Link from "next/link"
import { useProjects, useCreateProject } from "@/lib/api/hooks/use-projects"
import { useCustomers } from "@/lib/api/hooks/use-customers"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, FolderKanban, ChevronRight, MapPin } from "lucide-react"
import { formatDate } from "@/lib/utils"

const ORG_ID = "demo-org"

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
]

const STATUS_LABELS: Record<string, string> = {
  draft: "Lead",
  in_progress: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
}

const statusBadgeClass = (status: string) => {
  if (status === "completed") return "badge badge-success"
  if (status === "active" || status === "in_progress") return "badge badge-gold"
  if (status === "cancelled") return "badge badge-error"
  return "badge badge-muted"
}

export default function ProjectsPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    address: "",
    customer_id: "",
    status: "lead" as const,
  })

  const activeStatus = statusFilter === "all" ? undefined : statusFilter
  const { data: allProjects = [], isLoading } = useProjects(ORG_ID, undefined)
  const { data: statusProjects = [] } = useProjects(ORG_ID, activeStatus)
  const { data: customers = [] } = useCustomers(ORG_ID)
  const createProject = useCreateProject()

  const projects = statusFilter === "all" ? allProjects : statusProjects

  const filtered = projects.filter(
    (p) =>
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address?.toLowerCase().includes(search.toLowerCase()) ||
      (p as typeof p & { customer?: { name: string } }).customer?.name.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    all: allProjects.length,
    draft: allProjects.filter((p) => p.status === "lead").length,
    in_progress: allProjects.filter((p) => p.status === "active").length,
    completed: allProjects.filter((p) => p.status === "completed").length,
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_id) {
      toast({ title: "Please select a customer", variant: "error" })
      return
    }
    try {
      await createProject.mutateAsync({
        organization_id: ORG_ID,
        customer_id: form.customer_id,
        name: form.name,
        address: form.address || null,
        status: form.status,
      })
      toast({ title: "Project created" })
      setIsAddOpen(false)
      setForm({ name: "", address: "", customer_id: "", status: "lead" })
    } catch {
      toast({ title: "Failed to create project", variant: "error" })
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Sticky Header */}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
              Projects
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)", marginTop: "2px" }}>{allProjects.length} total</p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      <div className="px-8 pt-6 pb-8 animate-fade-up">
        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 mb-8">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === tab.value
                  ? "text-white"
                  : "text-[rgba(240,244,255,0.5)] hover:text-[rgba(240,244,255,0.7)] border border-transparent"
              }`}
              style={{
                fontFamily: "var(--font-display)",
                background: statusFilter === tab.value ? "rgba(226,178,74,0.12)" : "transparent",
                borderColor: statusFilter === tab.value ? "rgba(226,178,74,0.2)" : "transparent",
              }}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-60">({counts[tab.value as keyof typeof counts]})</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-5" style={{ background: "rgba(226,178,74,0.08)" }}>
              <FolderKanban className="h-8 w-8" style={{ color: "rgba(226,178,74,0.4)" }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
              No projects found
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              {search ? "Try adjusting your search terms" : "Create your first project to get started"}
            </p>
            {!search && (
              <Button onClick={() => setIsAddOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {filtered.map((project) => {
              const typedProject = project as typeof project & { customer?: { name: string; email?: string | null } }
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="card card-hover h-full cursor-pointer transition-all duration-200">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                          style={{ background: "rgba(226,178,74,0.1)", border: "1px solid rgba(226,178,74,0.2)" }}
                        >
                          <FolderKanban className="h-5 w-5" style={{ color: "var(--accent-gold)" }} />
                        </div>
                        <span className={statusBadgeClass(project.status)}>
                          {STATUS_LABELS[project.status] ?? project.status}
                        </span>
                      </div>
                      <h3
                        className="font-semibold mb-1 flex items-center gap-2"
                        style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                      >
                        {project.name}
                        <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                      </h3>
                      {typedProject.customer && (
                        <p className="text-xs mb-1" style={{ color: "var(--accent-gold)" }}>{typedProject.customer.name}</p>
                      )}
                      {project.address && (
                        <p className="text-xs flex items-center gap-1 mb-2" style={{ color: "var(--text-muted)" }}>
                          <MapPin className="h-3 w-3" />
                          {project.address}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(project.created_at)}</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="card">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger className="input">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Kitchen Renovation"
                className="input"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Project address (optional)"
                className="input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: typeof form.status) => setForm({ ...form, status: v })}>
                <SelectTrigger className="input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)} className="btn-secondary">
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
