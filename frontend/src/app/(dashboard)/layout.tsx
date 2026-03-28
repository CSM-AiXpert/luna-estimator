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
    <div className="flex min-h-screen">
      <Sidebar user={user} organization={organization} />
      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  )
}
