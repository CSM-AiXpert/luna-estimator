"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { useAuth, useOrganization } from "@/components/providers"
import { Menu, X } from "lucide-react"

const SIDEBAR_W = 220

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const { organization } = useOrganization()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: `${SIDEBAR_W}px`,
          zIndex: 40,
          transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`,
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="md:!transform-none md:!relative"
      >
        <Sidebar user={user} organization={organization} />
      </div>

      {/* Main content — offset by sidebar width on desktop */}
      <main
        className="flex-1"
        style={{
          marginLeft: `${SIDEBAR_W}px`,
          minHeight: '100vh',
        }}
      >
        {/* Sticky top bar — hamburger on mobile, subtle on desktop */}
        <div
          className="flex items-center gap-3 px-6"
          style={{
            height: '56px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(15,17,30,0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}
        >
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#f0f4ff',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '7px',
                  background: '#e2b24a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3C7.5 3 3.5 7 3.5 12C3.5 17 7.5 21 12.5 21C14 21 15.5 20.5 16.5 19.5C14.5 18.5 13 16.5 13 14.5C13 12 15 10 17.5 10.5C18 7 15 3 12 3Z" fill="#0f111e"/>
                </svg>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '13px', color: '#f0f4ff', letterSpacing: '-0.01em' }}>LUNA</span>
            </div>
          </div>

          {/* Desktop: org breadcrumb */}
          <div className="hidden md:flex items-center gap-2" style={{ fontSize: '13px', color: 'rgba(240,244,255,0.3)' }}>
            <span>{organization?.name ?? 'Luna Drywall & Painting'}</span>
          </div>

          <div className="flex-1" />
        </div>

        {children}
      </main>
    </div>
  )
}
