"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createContext, useContext, useState, ReactNode } from "react"
import { Toaster } from "@/components/ui/toaster"
import type { User, Organization } from "@/lib/supabase/types"

interface OrgContextType {
  organization: Organization | null
  setOrganization: (org: Organization | null) => void
}

const OrgContext = createContext<OrgContextType>({
  organization: null,
  setOrganization: () => {},
})

export function useOrganization() {
  return useContext(OrgContext)
}

interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user: null, setUser: () => {} }}>
        <OrgContext.Provider value={{ organization: null, setOrganization: () => {} }}>
          {children}
          <Toaster />
        </OrgContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}
