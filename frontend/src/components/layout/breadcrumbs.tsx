"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
}

export function Breadcrumbs({ items = [] }: BreadcrumbsProps) {
  const pathname = usePathname()

  // Auto-generate from pathname if no items provided
  const autoItems: BreadcrumbItem[] = pathname
    .split("/")
    .filter(Boolean)
    .map((segment, index, arr) => {
      const href = "/" + arr.slice(0, index + 1).join("/")
      const label = segment
        .replace(/-/g, " ")
        .replace(/\[.*\]/, "Details")
        .replace(/\b\w/g, (c) => c.toUpperCase())
      return { label, href }
    })

  const breadcrumbItems = items.length > 0 ? items : autoItems

  return (
    <nav className="flex items-center gap-1.5 text-sm text-white/50">
      <Link
        href="/"
        className="flex items-center gap-1 hover:text-white/70 transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {breadcrumbItems.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-white/20" />
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-white/70 transition-colors capitalize"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-white/30 capitalize">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
