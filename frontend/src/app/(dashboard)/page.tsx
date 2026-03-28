"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  FolderKanban,
  Users,
  Clock,
  Plus,
  ArrowRight,
  Loader2,
  Building2,
  Ruler,
  FileText,
  TrendingUp,
  Sparkles,
} from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import type { Project, Customer } from "@/lib/supabase/types"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface ProjectWithCustomer extends Project {
  customer?: { name: string; email: string }
}

// Sample pipeline data for chart (would come from GHL in production)
const pipelineData = [
  { month: "Jan", value: 42 },
  { month: "Feb", value: 58 },
  { month: "Mar", value: 51 },
  { month: "Apr", value: 67 },
  { month: "May", value: 73 },
  { month: "Jun", value: 89 },
]

const statusColors: Record<string, string> = {
  lead: "#f59e0b",
  bid: "#3b82f6",
  active: "#10b981",
  completed: "#00d4ff",
  cancelled: "#6b7280",
}

export default function DashboardPage() {
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed")
      return res.json() as Promise<ProjectWithCustomer[]>
    },
  })

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers")
      if (!res.ok) throw new Error("Failed")
      return res.json() as Promise<Customer[]>
    },
  })

  const isLoading = projectsLoading || customersLoading

  const activeCount = projects?.filter((p) => p.status === "active").length ?? 0
  const bidCount = projects?.filter((p) => p.status === "bid").length ?? 0
  const leadCount = projects?.filter((p) => p.status === "lead").length ?? 0
  const completedCount = projects?.filter((p) => p.status === "completed").length ?? 0

  const pieData = [
    { name: "Active", value: activeCount, color: "#10b981" },
    { name: "Bid", value: bidCount, color: "#3b82f6" },
    { name: "Lead", value: leadCount, color: "#f59e0b" },
    { name: "Completed", value: completedCount, color: "#00d4ff" },
  ].filter((d) => d.value > 0)

  const recentProjects = projects?.slice(0, 6) ?? []

  const statCards = [
    {
      title: "Active Projects",
      value: activeCount,
      icon: FolderKanban,
      color: "#10b981",
      gradient: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.04))",
      border: "rgba(16,185,129,0.2)",
      description: "Currently in progress",
    },
    {
      title: "Pending Bids",
      value: bidCount,
      icon: Clock,
      color: "#f59e0b",
      gradient: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.04))",
      border: "rgba(245,158,11,0.2)",
      description: "Awaiting client response",
    },
    {
      title: "Total Customers",
      value: customers?.length ?? 0,
      icon: Users,
      color: "#00d4ff",
      gradient: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.04))",
      border: "rgba(0,212,255,0.2)",
      description: "In your roster",
    },
    {
      title: "Deals Won",
      value: completedCount,
      icon: Sparkles,
      color: "#7c3aed",
      gradient: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.04))",
      border: "rgba(124,58,237,0.2)",
      description: "Successfully closed",
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10,14,26,0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div
          className="flex items-center justify-between px-8"
          style={{ height: '68px' }}
        >
          <div>
            <h1
              className="font-bold"
              style={{ fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}
            >
              Dashboard
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/projects/new">
              <button className="btn-primary" style={{ height: '36px', padding: '0 16px', fontSize: '13px' }}>
                <Plus className="h-3.5 w-3.5" />
                New Project
              </button>
            </Link>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-8">
        {/* Animated stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.title}
                className="glass glass-hover stat-card"
                style={{
                  padding: '20px',
                  background: stat.gradient,
                  borderColor: stat.border,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top accent line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, ${stat.color}80, transparent)`,
                  }}
                />
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}
                    >
                      {stat.title}
                    </p>
                    <p
                      className="font-bold"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '32px',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        color: 'var(--text-primary)',
                        marginTop: '6px',
                        lineHeight: 1,
                      }}
                    >
                      {isLoading ? (
                        <span className="skeleton" style={{ display: 'inline-block', width: '48px', height: '32px', borderRadius: '6px' }} />
                      ) : (
                        stat.value
                      )}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {stat.description}
                    </p>
                  </div>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: `${stat.color}15`,
                      border: `1px solid ${stat.color}25`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: stat.color }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger-children">
          {/* Pipeline trend chart */}
          <div
            className="glass"
            style={{ padding: '24px', gridColumn: 'span 2' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3
                  className="font-bold"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--text-primary)' }}
                >
                  Project Pipeline
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Active projects over time
                </p>
              </div>
              <div
                className="badge badge-cyan"
                style={{ fontSize: '11px' }}
              >
                <TrendingUp className="h-3 w-3" />
                +18% this month
              </div>
            </div>
            <div style={{ height: '180px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pipelineData}>
                  <defs>
                    <linearGradient id="pipelineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'rgba(240,244,255,0.4)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(240,244,255,0.4)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(13,18,36,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      color: '#f0f4ff',
                      fontFamily: 'var(--font-body)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                    cursor={{ stroke: 'rgba(0,212,255,0.3)', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#00d4ff"
                    strokeWidth={2}
                    fill="url(#pipelineGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#00d4ff', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3
              className="font-bold mb-1"
              style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--text-primary)' }}
            >
              Project Status
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Current distribution
            </p>

            {pieData.length === 0 ? (
              <div className="text-center py-8">
                <FolderKanban className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--text-disabled)' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No projects yet</p>
              </div>
            ) : (
              <>
                <div style={{ height: '120px', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={52}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Projects + Quick Actions row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 stagger-children">
          {/* Recent projects table */}
          <div className="glass" style={{ padding: '24px', gridColumn: 'span 3' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3
                  className="font-bold"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--text-primary)' }}
                >
                  Recent Projects
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Latest activity across all projects
                </p>
              </div>
              <Link href="/projects" style={{ textDecoration: 'none' }}>
                <button className="btn-ghost" style={{ fontSize: '12px' }}>
                  View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </button>
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton" style={{ height: '14px', width: '60%', borderRadius: '4px' }} />
                      <div className="skeleton" style={{ height: '12px', width: '40%', borderRadius: '4px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center py-10">
                <div
                  className="inline-flex items-center justify-center mb-3"
                  style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.1)',
                  }}
                >
                  <FolderKanban className="h-6 w-6" style={{ color: 'var(--text-disabled)' }} />
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  No projects created yet
                </p>
                <Link href="/projects/new" style={{ display: 'inline-block', textDecoration: 'none' }}>
                  <button className="btn-primary" style={{ fontSize: '13px', height: '36px', padding: '0 16px' }}>
                    <Plus className="h-3.5 w-3.5" />
                    Create first project
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      className="flex items-center gap-4 p-3 rounded-xl transition-all duration-200"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = 'transparent'
                      }}
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                          background: `${statusColors[project.status] ?? '#6b7280'}15`,
                          border: `1px solid ${statusColors[project.status] ?? '#6b7280'}25`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <FolderKanban
                          className="h-4.5 w-4.5"
                          style={{ color: statusColors[project.status] ?? '#6b7280' }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-semibold truncate"
                          style={{ fontFamily: 'var(--font-display)', fontSize: '13.5px', color: 'var(--text-primary)' }}
                        >
                          {project.name}
                        </p>
                        <p
                          className="truncate"
                          style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}
                        >
                          {project.customer?.name ?? 'No customer'} · {project.city ?? ''}{project.state ? `, ${project.state}` : ''}
                        </p>
                      </div>

                      {/* Status + date */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span
                          className="badge"
                          style={{
                            fontSize: '10px',
                            background: `${statusColors[project.status] ?? '#6b7280'}15`,
                            color: statusColors[project.status] ?? '#6b7280',
                            border: `1px solid ${statusColors[project.status] ?? '#6b7280'}25`,
                            padding: '2px 8px',
                            borderRadius: '99px',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          {project.status}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>
                          {formatDate(project.created_at)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="glass" style={{ padding: '24px', gridColumn: 'span 2' }}>
            <h3
              className="font-bold mb-1"
              style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--text-primary)' }}
            >
              Quick Actions
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Common tasks at your fingertips
            </p>

            <div className="space-y-2">
              {[
                { href: '/projects/new', icon: FolderKanban, label: 'New Project', sub: 'Start a fresh estimate', color: '#00d4ff' },
                { href: '/customers/new', icon: Users, label: 'Add Customer', sub: 'Add to your roster', color: '#10b981' },
                { href: '/projects', icon: FileText, label: 'All Projects', sub: 'Browse & manage', color: '#7c3aed' },
                { href: '/settings/ghl', icon: Building2, label: 'GHL Setup', sub: 'Integrate your CRM', color: '#f59e0b' },
              ].map((action) => (
                <Link key={action.href} href={action.href} style={{ textDecoration: 'none' }}>
                  <div
                    className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.borderColor = `${action.color}30`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = 'transparent'
                    }}
                  >
                    <div
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                        background: `${action.color}12`,
                        border: `1px solid ${action.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <action.icon className="h-4 w-4" style={{ color: action.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {action.label}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{action.sub}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-disabled)' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
