"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Settings,
  LogOut,
  Building2,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User, Organization } from "@/lib/supabase/types"

interface SidebarProps {
  user: User | null
  organization: Organization | null
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar({ user, organization }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-screen flex flex-col"
      style={{
        width: '260px',
        background: 'linear-gradient(180deg, rgba(10,14,26,0.98) 0%, rgba(6,11,31,0.98) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5"
        style={{ height: '68px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Luna mark */}
        <div
          className="flex items-center justify-center rounded-xl"
          style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 100%)',
            boxShadow: '0 4px 16px rgba(0,212,255,0.3), 0 0 0 1px rgba(0,212,255,0.2) inset',
          }}
        >
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <div
            className="font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--text-primary)' }}
          >
            LUNA
          </div>
          <div
            className="uppercase tracking-widest"
            style={{ fontSize: '9px', color: 'rgba(0,212,255,0.6)', letterSpacing: '0.15em' }}
          >
            Estimator
          </div>
        </div>
        {/* Ambient glow dot */}
        <div
          style={{
            marginLeft: 'auto',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 8px #10b981',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Org context */}
      <div
        className="px-3 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-left h-auto py-1.5 px-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span style={{ fontSize: '10px', color: 'rgba(240,244,255,0.35)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Organization
                </span>
                <span
                  className="text-sm truncate"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 500 }}
                >
                  {organization?.name ?? "No org"}
                </span>
              </div>
              <ChevronDown
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: 'rgba(240,244,255,0.35)' }}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="rounded-xl p-1"
            style={{ background: 'rgba(13,18,36,0.98)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)' }}
          >
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: 'var(--text-secondary)' }}
            >
              Switch Organization
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: 'var(--text-secondary)' }}
            >
              Organization Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200"
              style={
                active
                  ? {
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(59,130,246,0.08) 100%)',
                      border: '1px solid rgba(0,212,255,0.2)',
                      boxShadow: '0 0 16px rgba(0,212,255,0.06)',
                      color: 'var(--text-primary)',
                    }
                  : {
                      background: 'transparent',
                      border: '1px solid transparent',
                      color: 'rgba(240,244,255,0.5)',
                    }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = 'rgba(240,244,255,0.8)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(240,244,255,0.5)'
                }
              }}
            >
              <Icon
                className="h-4 w-4 flex-shrink-0"
                style={active ? { color: 'var(--accent-cyan)' } : {}}
              />
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '14px',
                }}
              >
                {item.label}
              </span>
              {active && (
                <div
                  style={{
                    marginLeft: 'auto',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: 'var(--accent-cyan)',
                    boxShadow: '0 0 6px var(--accent-cyan)',
                  }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User menu */}
      <div
        className="p-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 rounded-xl"
              style={{
                height: 'auto',
                padding: '10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: '34px',
                  height: '34px',
                  background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: 'var(--font-display)',
                  boxShadow: '0 2px 12px rgba(0,212,255,0.2)',
                }}
              >
                {user?.full_name
                  ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                  : user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span
                  className="text-sm truncate"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 500 }}
                >
                  {user?.full_name ?? user?.email ?? 'User'}
                </span>
                <span
                  className="text-xs capitalize"
                  style={{ color: 'rgba(240,244,255,0.35)' }}
                >
                  {user?.role ?? 'member'}
                </span>
              </div>
              <ChevronDown
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: 'rgba(240,244,255,0.35)' }}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="rounded-xl p-1"
            style={{ background: 'rgba(13,18,36,0.98)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)', minWidth: '180px' }}
          >
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: 'var(--text-secondary)' }}
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: 'var(--text-secondary)' }}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: 'rgba(239,68,68,0.8)' }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
