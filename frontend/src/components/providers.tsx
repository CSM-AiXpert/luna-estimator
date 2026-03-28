"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createContext, useContext, useState, ReactNode, useEffect } from "react"
import { Toaster } from "@/components/ui/toaster"
import { supabase } from "@/lib/supabase/client"
import type { User, Organization } from "@/lib/supabase/types"

const DEMO_ORG: Organization = {
  id: "demo-org-id",
  name: "Luna Drywall & Paint",
  ghl_location_id: null,
  ghl_pipeline_id: null,
  default_currency: "USD",
  timezone: "America/New_York",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const DEMO_USER: User = {
  id: "demo-user-id",
  email: "demo@lunadrywallandpaint.com",
  full_name: "Demo User",
  organization_id: "demo-org-id",
  role: "owner",
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

interface OrgContextType {
  organization: Organization | null
  setOrganization: (org: Organization | null) => void
  isDemo: boolean
}

const OrgContext = createContext<OrgContextType>({
  organization: null,
  setOrganization: () => {},
  isDemo: false,
})

export function useOrganization() {
  return useContext(OrgContext)
}

interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
  isDemo: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isDemo: false,
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

  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Fetch user profile
          const { data: profile } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle()
          if (profile) {
            setUser(profile as User)
            // Fetch org
            if (profile.organization_id) {
              const { data: org } = await supabase
                .from("organizations")
                .select("*")
                .eq("id", profile.organization_id)
                .maybeSingle()
              if (org) setOrganization(org as Organization)
            }
          }
        } else {
          // No session — use demo mode for preview
          setUser(DEMO_USER)
          setOrganization(DEMO_ORG)
          setIsDemo(true)
        }
      } catch {
        // Supabase not configured — demo mode
        setUser(DEMO_USER)
        setOrganization(DEMO_ORG)
        setIsDemo(true)
      } finally {
        setLoaded(true)
      }
    }
    loadSession()
  }, [])

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-white/50">Loading...</div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, setUser, isDemo }}>
        <OrgContext.Provider value={{ organization, setOrganization, isDemo }}>
          {children}
          <Toaster />
          {isDemo && (
            <div className="fixed bottom-4 right-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-2 rounded-lg z-50">
              Demo mode — connect Supabase to enable real data
            </div>
          )}
        </OrgContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}
