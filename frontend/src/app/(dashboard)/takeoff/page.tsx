"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  Ruler,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  Home,
  Loader2,
  DollarSign,
} from "lucide-react"

interface RoomWithProject {
  id: string
  name: string
  room_type: string
  status: string
  total_sqft: number | null
  updated_at: string
  project: {
    id: string
    name: string
    status: string
    customer: { first_name: string; last_name: string } | null
  } | null
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  pending:  { label: "Pending",  icon: Clock,        color: "#8a92a6", bg: "rgba(138,146,166,0.12)" },
  measured: { label: "Measured", icon: Ruler,          color: "#4f70f0", bg: "rgba(79,112,240,0.12)" },
  estimated:{ label: "Estimated",icon: DollarSign,    color: "#fab52e", bg: "rgba(250,181,46,0.12)" },
  complete: { label: "Complete",  icon: CheckCircle2, color: "#27ae60", bg: "rgba(39,174,96,0.12)" },
}

const ROOM_TYPE_ICONS: Record<string, string> = {
  living:    "Living",
  bedroom:   "Bed",
  kitchen:   "Kitchen",
  bathroom:  "Bath",
  basement:  "Base",
  garage:    "Garage",
  attic:     "Attic",
  office:    "Office",
  other:     "Room",
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Ruler; color: string }) {
  return (
    <div
      className="card"
      style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: "16px" }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          background: `${color}18`,
          border: `1px solid ${color}28`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            lineHeight: 1,
            marginTop: "4px",
          }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function RoomCard({ room }: { room: RoomWithProject }) {
  const statusCfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.pending
  const StatusIcon = statusCfg.icon
  const sqft = room.total_sqft ?? 0

  return (
    <Link
      href={`/projects/${room.project?.id}/rooms/${room.id}`}
      style={{ textDecoration: "none" }}
    >
      <div
        className="card card-hover"
        style={{ padding: "16px 20px", cursor: "pointer" }}
      >
        {/* Room type badge */}
        <div className="flex items-start justify-between mb-3">
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(250,181,46,0.12)",
              border: "1px solid rgba(250,181,46,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Home className="h-4 w-4" style={{ color: "#fab52e" }} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "99px",
              background: statusCfg.bg,
              border: `1px solid ${statusCfg.color}28`,
            }}
          >
            <StatusIcon className="h-3 w-3" style={{ color: statusCfg.color }} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: statusCfg.color,
              }}
            >
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Room name */}
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "15px",
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: "4px",
          }}
        >
          {room.name}
        </p>

        {/* Room type */}
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            marginBottom: "12px",
          }}
        >
          {ROOM_TYPE_ICONS[room.room_type] ?? room.room_type}
        </p>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            paddingTop: "12px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>
              {room.project?.name ?? "No project"}
            </p>
            {room.project?.customer && (
              <p style={{ fontSize: "12px", color: "rgba(240,244,255,0.5)" }}>
                {room.project.customer.first_name} {room.project.customer.last_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {sqft > 0 && (
              <div className="text-right">
                <p style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                  {sqft.toLocaleString()}
                </p>
                <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>sq ft</p>
              </div>
            )}
            <ArrowRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function TakeoffPage() {
  const { data: rooms, isLoading } = useQuery<RoomWithProject[]>({
    queryKey: ["rooms-takoff"],
    queryFn: async () => {
      const res = await fetch("/api/rooms?include=project")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const pending = rooms?.filter((r) => r.status === "pending").length ?? 0
  const measured = rooms?.filter((r) => r.status === "measured").length ?? 0
  const estimated = rooms?.filter((r) => r.status === "estimated").length ?? 0
  const complete = rooms?.filter((r) => r.status === "complete").length ?? 0
  const totalSqft = rooms?.reduce((sum, r) => sum + (r.total_sqft ?? 0), 0) ?? 0

  // Group rooms by project
  const byProject: Record<string, { project: NonNullable<RoomWithProject["project"]>; rooms: RoomWithProject[] }> = {}
  rooms?.forEach((room) => {
    if (!room.project) return
    if (!byProject[room.project.id]) {
      byProject[room.project.id] = { project: room.project, rooms: [] }
    }
    byProject[room.project.id].rooms.push(room)
  })

  return (
    <div>
      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(15,17,30,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "20px 32px",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "20px",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.02em",
              }}
            >
              Takeoff
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              Material takeoffs across all projects
            </p>
          </div>
          <Link href="/projects/new">
            <button className="btn-primary" style={{ height: "36px", padding: "0 16px", fontSize: "13px" }}>
              <Plus className="h-3.5 w-3.5" />
              New Project
            </button>
          </Link>
        </div>
      </div>

      <div style={{ padding: "28px 32px" }}>
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Rooms" value={rooms?.length ?? 0} icon={Ruler} color="#fab52e" />
          <StatCard label="Pending" value={pending} icon={Clock} color="#8a92a6" />
          <StatCard label="Measured" value={measured} icon={Ruler} color="#4f70f0" />
          <StatCard label="Estimated" value={estimated} icon={CheckCircle2} color="#fab52e" />
          <StatCard label="Total Sq Ft" value={totalSqft} icon={FolderKanban} color="#27ae60" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#fab52e" }} />
          </div>
        ) : rooms?.length === 0 ? (
          /* Empty state */
          <div
            className="card"
            style={{
              padding: "60px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                background: "rgba(250,181,46,0.1)",
                border: "1px solid rgba(250,181,46,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Ruler className="h-7 w-7" style={{ color: "#fab52e" }} />
            </div>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "18px",
                fontWeight: 700,
                color: "#ffffff",
                marginBottom: "8px",
              }}
            >
              No takeoffs yet
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "24px" }}>
              Create a project to start capturing room measurements
            </p>
            <Link href="/projects/new">
              <button className="btn-primary" style={{ height: "40px", padding: "0 20px", fontSize: "14px" }}>
                <Plus className="h-4 w-4" />
                Start Your First Takeoff
              </button>
            </Link>
          </div>
        ) : (
          /* Rooms grouped by project */
          <div className="space-y-8">
            {Object.entries(byProject).map(([projectId, { project, rooms: projectRooms }]) => {
              const projectSqft = projectRooms.reduce((s, r) => s + (r.total_sqft ?? 0), 0)
              return (
                <div key={projectId}>
                  {/* Project header */}
                  <div
                    className="flex items-center justify-between mb-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#fab52e",
                          boxShadow: "0 0 8px rgba(250,181,46,0.4)",
                        }}
                      />
                      <h2
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#ffffff",
                        }}
                      >
                        {project.name}
                      </h2>
                      {project.customer && (
                        <span
                          style={{
                            fontSize: "13px",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-display)",
                          }}
                        >
                          · {project.customer.first_name} {project.customer.last_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
                          {projectRooms.length} {projectRooms.length === 1 ? "room" : "rooms"}
                        </p>
                        {projectSqft > 0 && (
                          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {projectSqft.toLocaleString()} sq ft total
                          </p>
                        )}
                      </div>
                      <Link href={`/projects/${projectId}`}>
                        <button className="btn-secondary" style={{ height: "30px", padding: "0 12px", fontSize: "12px" }}>
                          View Project
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    </div>
                  </div>

                  {/* Room grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {projectRooms.map((room) => (
                      <RoomCard key={room.id} room={room} />
                    ))}

                    {/* Add room CTA */}
                    <Link
                      href={`/projects/${projectId}/rooms/new`}
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        style={{
                          border: "1px dashed #31333f",
                          borderRadius: "12px",
                          padding: "20px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          cursor: "pointer",
                          minHeight: "140px",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(250,181,46,0.3)"
                          e.currentTarget.style.background = "rgba(250,181,46,0.03)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#31333f"
                          e.currentTarget.style.background = "transparent"
                        }}
                      >
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: "rgba(250,181,46,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Plus className="h-4 w-4" style={{ color: "#fab52e" }} />
                        </div>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                          Add Room
                        </p>
                      </div>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
