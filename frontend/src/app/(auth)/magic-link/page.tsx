"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Building2, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseClient } from "@/lib/supabase/client"

const magicLinkSchema = z.object({
  email: z.string().email("Invalid email address"),
})

type MagicLinkForm = z.infer<typeof magicLinkSchema>

export default function MagicLinkPage() {
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkForm>({
    resolver: zodResolver(magicLinkSchema),
  })

  const onSubmit = async (data: MagicLinkForm) => {
    setIsLoading(true)
    setError(null)

    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Auth not available. Please refresh the page.")
      setIsLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    setMagicLinkSent(true)
    setIsLoading(false)
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
      </div>
    )
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] px-4">
        <Card className="max-w-md w-full border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#00d4ff]/10">
              <Mail className="h-8 w-8 text-[#00d4ff]" />
            </div>
            <h2 className="text-xl font-semibold text-white">Check your email</h2>
            <p className="text-white/50 text-sm">
              We&apos;ve sent a magic sign-in link to your email. The link expires in 1 hour.
            </p>
            <Link href="/login" className="block">
              <Button variant="secondary" className="w-full">
                Back to login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-[#00d4ff]/5 via-transparent to-[#3b82f6]/5 pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#3b82f6]">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-white tracking-tight">LUNA</div>
              <div className="text-xs text-white/40 uppercase tracking-widest">Estimator</div>
            </div>
          </div>
        </div>
        <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Sign in with Magic Link</CardTitle>
            <CardDescription className="text-white/50">
              Enter your email to receive a sign-in link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  {...register("email")}
                  className={errors.email ? "border-red-500/50" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Sending link...</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" />Send Magic Link</>
                )}
              </Button>
            </form>
            <p className="text-center text-sm text-white/50">
              <Link href="/login" className="text-[#00d4ff] hover:text-[#00d4ff]/80 transition-colors">
                Back to login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
