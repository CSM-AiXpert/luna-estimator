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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-white/50 text-sm mt-1">{allProjects.length} total</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === tab.value
                ? "bg-white/10 text-white"
                : "text-white/50 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            {tab.label}
            <span className="ml-2 text-xs text-white/30">({counts[tab.value as keyof typeof counts]})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No projects found</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const typedProject = project as typeof project & { customer?: { name: string; email?: string | null } }
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:bg-white/[0.06] transition-colors h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#00d4ff]/15 to-[#3b82f6]/15 flex-shrink-0">
                        <FolderKanban className="h-5 w-5 text-[#00d4ff]" />
                      </div>
                      <Badge className={`status-${project.status}`}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-white mb-1 flex items-center gap-2">
                      {project.name}
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    </h3>
                    {typedProject.customer && (
                      <p className="text-xs text-[#00d4ff] mb-1">{typedProject.customer.name}</p>
                    )}
                    {project.address && (
                      <p className="text-xs text-white/40 flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3" />
                        {project.address}
                      </p>
                    )}
                    <p className="text-xs text-white/30">{formatDate(project.created_at)}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger>
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
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Project address (optional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: typeof form.status) => setForm({ ...form, status: v })}>
                <SelectTrigger>
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
              <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>
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
