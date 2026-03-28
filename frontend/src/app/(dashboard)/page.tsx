"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  FolderKanban,
  Users,
  Clock,
  TrendingUp,
  Plus,
  Upload,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import type { Project, Customer } from "@/lib/supabase/types"

interface ProjectWithCustomer extends Project {
  customer?: { name: string; email: string }
}

interface DashboardStats {
  activeProjects: number
  pendingEstimates: number
  totalCustomers: number
  recentActivity: number
}

export default function DashboardPage() {
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to fetch projects")
      return res.json() as Promise<ProjectWithCustomer[]>
    },
  })

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers")
      if (!res.ok) throw new Error("Failed to fetch customers")
      return res.json() as Promise<Customer[]>
    },
  })

  const stats: DashboardStats = {
    activeProjects: projects?.filter((p) => p.status === "active").length ?? 0,
    pendingEstimates: projects?.filter((p) => p.status === "bid").length ?? 0,
    totalCustomers: customers?.length ?? 0,
    recentActivity: projects?.length ?? 0,
  }

  const recentProjects = projects?.slice(0, 5) ?? []

  const statCards = [
    {
      title: "Active Projects",
      value: stats.activeProjects,
      icon: FolderKanban,
      color: "text-[#00d4ff]",
      bgColor: "bg-[#00d4ff]/10",
    },
    {
      title: "Pending Estimates",
      value: stats.pendingEstimates,
      icon: Clock,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
    },
    {
      title: "Total Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
    },
    {
      title: "Recent Activity",
      value: stats.recentActivity,
      icon: TrendingUp,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
  ]

  const getStatusBadge = (status: Project["status"]) => {
    const variants: Record<Project["status"], "pending" | "active" | "completed" | "cancelled"> = {
      lead: "pending",
      bid: "pending",
      active: "active",
      completed: "completed",
      cancelled: "cancelled",
    }
    return variants[status] ?? "default"
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0a0e1a]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-8">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-white/40">
              Welcome back — here&apos;s what&apos;s happening
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/projects/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                New Project
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="border-white/8 bg-white/[0.03]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/50">{stat.title}</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {projectsLoading || customersLoading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                        ) : (
                          stat.value
                        )}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/projects/new">
            <Card className="border-white/8 bg-white/[0.03] hover:bg-white/[0.05] transition-colors cursor-pointer h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#00d4ff]/10">
                  <FolderKanban className="h-6 w-6 text-[#00d4ff]" />
                </div>
                <div>
                  <h3 className="font-medium text-white">New Project</h3>
                  <p className="text-sm text-white/40">
                    Create a fresh estimate
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/20 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/customers/new">
            <Card className="border-white/8 bg-white/[0.03] hover:bg-white/[0.05] transition-colors cursor-pointer h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-400/10">
                  <Users className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">New Customer</h3>
                  <p className="text-sm text-white/40">
                    Add a client to your roster
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/20 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/projects">
            <Card className="border-white/8 bg-white/[0.03] hover:bg-white/[0.05] transition-colors cursor-pointer h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-400/10">
                  <Upload className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Upload Files</h3>
                  <p className="text-sm text-white/40">
                    Add project documents
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/20 ml-auto" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Projects */}
        <Card className="border-white/8 bg-white/[0.03]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Projects</CardTitle>
            <Link href="/projects">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-white/20" />
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center py-12">
                <FolderKanban className="h-12 w-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/40">No projects yet</p>
                <Link href="/projects/new">
                  <Button variant="secondary" size="sm" className="mt-3">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create your first project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 rounded-lg bg-[#00d4ff]/10">
                        <FolderKanban className="h-4 w-4 text-[#00d4ff]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">
                          {project.name}
                        </p>
                        <p className="text-sm text-white/40 truncate">
                          {project.customer?.name ?? "No customer"} •{" "}
                          {project.address ?? "No address"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusBadge(project.status)}>
                        {project.status.replace("_", " ")}
                      </Badge>
                      <span className="text-sm text-white/30">
                        {formatDate(project.created_at)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
