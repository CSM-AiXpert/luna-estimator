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
  Link2,
  UsersRound,
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/8 bg-[#0d1224] flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#3b82f6]">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-tight">
            LUNA
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-widest">
            Estimator
          </div>
        </div>
      </div>

      {/* Org context */}
      <div className="px-4 py-3 border-b border-white/8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-left h-auto py-1 px-2"
            >
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs text-white/40">Organization</span>
                <span className="text-sm text-white truncate">
                  {organization?.name ?? "No org"}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-white/40 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem>Switch Organization</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Organization Settings</DropdownMenuItem>
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/70"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-[#00d4ff]" : "")} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User menu */}
      <div className="p-3 border-t border-white/8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#00d4ff] to-[#3b82f6] text-xs font-bold text-white">
                {user?.full_name
                  ? user.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                  : user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="text-sm text-white truncate">
                  {user?.full_name ?? user?.email ?? "User"}
                </span>
                <span className="text-xs text-white/40 capitalize">
                  {user?.role ?? "member"}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-white/40 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-400 focus:text-red-400">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
