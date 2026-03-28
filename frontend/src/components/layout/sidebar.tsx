"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Settings,
  LogOut,
  ChevronDown,
  Ruler,
} from "lucide-react"
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
  { href: "/takeoff", label: "Takeoff", icon: Ruler },
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
      className="h-screen flex flex-col"
      style={{
        width: '220px',
        background: '#1a1d2c',
        borderRight: '1px solid #31333f',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5"
        style={{ height: '64px', borderBottom: '1px solid #31333f' }}
      >
        {/* Luna mark — gold crescent */}
        <div
          className="flex items-center justify-center rounded-xl"
          style={{
            width: '34px',
            height: '34px',
            background: '#fab52e',
            boxShadow: '0 2px 8px rgba(250,181,46,0.3)',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 3C7.5 3 3.5 7 3.5 12C3.5 17 7.5 21 12.5 21C14 21 15.5 20.5 16.5 19.5C14.5 18.5 13 16.5 13 14.5C13 12 15 10 17.5 10.5C18 7 15 3 12 3Z" fill="#080d21"/>
          </svg>
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#ffffff',
              lineHeight: 1,
            }}
          >
            LUNA
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '9px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#fab52e',
              marginTop: '3px',
            }}
          >
            Estimator
          </div>
        </div>
      </div>

      {/* Org context */}
      <div
        className="px-3 py-3"
        style={{ borderBottom: '1px solid #31333f' }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #31333f',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a92a6' }}>
                  Organization
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: '#ffffff', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {organization?.name ?? 'Luna Drywall & Painting'}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#8a92a6' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="rounded-xl p-1"
            style={{ background: '#1a1d2c', border: '1px solid #31333f', minWidth: '180px' }}
          >
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: '#e1e7f0' }}
            >
              Switch Organization
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: '#31333f', margin: '4px 0' }} />
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: '#e1e7f0' }}
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
                      background: '#fab52e',
                      color: '#080d21',
                    }
                  : {
                      background: 'transparent',
                      color: '#8a92a6',
                    }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = '#e1e7f0'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#8a92a6'
                }
              }}
            >
              <Icon
                className="h-4 w-4 flex-shrink-0"
              />
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: active ? 700 : 600,
                  fontSize: '14px',
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* User menu */}
      <div
        className="p-3"
        style={{ borderTop: '1px solid #31333f' }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #31333f',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: '32px',
                  height: '32px',
                  background: '#31333f',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#ffffff',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {user?.full_name
                  ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                  : user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span
                  className="text-sm truncate"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: '#ffffff' }}
                >
                  {user?.full_name ?? user?.email ?? 'User'}
                </span>
                <span
                  className="text-xs capitalize"
                  style={{ color: '#8a92a6', fontFamily: 'var(--font-display)', fontWeight: 500 }}
                >
                  {user?.role ?? 'member'}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#8a92a6' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="rounded-xl p-1"
            style={{ background: '#1a1d2c', border: '1px solid #31333f', minWidth: '180px' }}
          >
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: '#e1e7f0' }}
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: '#e1e7f0' }}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: '#31333f', margin: '4px 0' }} />
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer"
              style={{ fontSize: '14px', color: '#eb5757' }}
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
