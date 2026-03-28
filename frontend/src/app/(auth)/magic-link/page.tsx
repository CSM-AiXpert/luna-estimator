"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Mail } from "lucide-react"
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent-gold)" }} />
      </div>
    )
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
        <Card className="max-w-md w-full card">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(226,178,74,0.1)" }}>
              <Mail className="h-8 w-8" style={{ color: "var(--accent-gold)" }} />
            </div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
              Check your email
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              We&apos;ve sent a magic sign-in link to your email. The link expires in 1 hour.
            </p>
            <Link href="/login" className="block">
              <Button variant="secondary" className="w-full btn-secondary">
                Back to login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, var(--accent-gold), var(--accent-gold-bright))" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3Z" fill="#0f111e" />
                <path d="M12 3C12 3 8 6 8 12C8 15 9 16 9 16C9 16 9.5 15.5 12 15C14.5 14.5 15 16 15 16C15 16 16 15 16 12C16 6 12 3 12 3Z" fill="#f0f4ff" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
                LUNA
              </div>
              <div className="text-xs uppercase tracking-widest" style={{ color: "var(--accent-gold)" }}>
                Estimator
              </div>
            </div>
          </div>
        </div>

        <Card className="card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              Sign in with Magic Link
            </CardTitle>
            <CardDescription>
              Enter your email to receive a sign-in link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div
                  className="rounded-lg p-3 text-sm"
                  style={{
                    background: "var(--error-bg)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "var(--error)",
                  }}
                >
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
                  className={`input ${errors.email ? "border-red-500/50" : ""}`}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="btn-primary w-full" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Sending link...</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" />Send Magic Link</>
                )}
              </Button>
            </form>
            <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
              <Link
                href="/login"
                style={{ color: "var(--accent-gold)" }}
              >
                Back to login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
