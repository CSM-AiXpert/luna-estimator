"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { useAuth, useOrganization } from "@/components/providers"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const { organization } = useOrganization()

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar user={user} organization={organization} />
      <main className="flex-1 ml-64 relative z-10">
        {children}
      </main>
    </div>
  )
}
