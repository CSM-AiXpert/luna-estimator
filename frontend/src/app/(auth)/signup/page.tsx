"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

const signupSchema = z.object({
  orgName: z.string().min(2, "Organization name is required"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  useMagicLink: z.boolean().optional(),
})

type SignupForm = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      useMagicLink: false,
    },
  })

  const useMagicLink = watch("useMagicLink")

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true)
    setError(null)

    try {
      const orgResponse = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.orgName }),
      })

      if (!orgResponse.ok) {
        throw new Error("Failed to create organization")
      }

      const { organization } = await orgResponse.json()

      if (data.useMagicLink) {
        const supabase = getSupabaseClient()
        if (!supabase) { setError("Auth not available"); setIsLoading(false); return }
        const { error } = await supabase.auth.signInWithOtp({
          email: data.email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              organization_id: organization.id,
              full_name: data.fullName,
            },
          },
        })

        if (error) throw error
        setMagicLinkSent(true)
        setIsLoading(false)
        return
      }

      const supabase2 = getSupabaseClient()
      if (!supabase2) { setError("Auth not available"); setIsLoading(false); return }
      const { error: signUpError } = await supabase2.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            organization_id: organization.id,
            full_name: data.fullName,
          },
        },
      })

      if (signUpError) throw signUpError

      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Card className="card max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(226,178,74,0.1)] mx-auto">
              <Mail className="h-8 w-8" style={{ color: "var(--accent-gold)" }} />
            </div>
            <div>
              <h2
                className="text-2xl font-bold mb-2"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
              >
                Check your email
              </h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                We&apos;ve sent a magic link to your email. Click the link to sign in.
              </p>
            </div>
            <Link href="/login">
              <Button variant="secondary" className="btn-secondary w-full">
                Back to login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>

      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex justify-center mb-10 animate-fade-up">
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
              <div
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
              >
                LUNA
              </div>
              <div className="text-xs uppercase tracking-widest" style={{ color: "var(--accent-gold)" }}>
                Estimator
              </div>
            </div>
          </div>
        </div>

        <Card className="card animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <CardHeader className="text-center pb-4">
            <CardTitle
              className="text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Create your account
            </CardTitle>
            <CardDescription>
              Start estimating projects with Luna AI
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

              <div className="space-y-1.5">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Drywall"
                  {...register("orgName")}
                  className={`input ${errors.orgName ? "border-red-500/50" : ""}`}
                />
                {errors.orgName && (
                  <p className="text-xs text-red-400">{errors.orgName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Smith"
                  {...register("fullName")}
                  className={`input ${errors.fullName ? "border-red-500/50" : ""}`}
                />
                {errors.fullName && (
                  <p className="text-xs text-red-400">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
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

              {!useMagicLink && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register("password")}
                    className={`input ${errors.password ? "border-red-500/50" : ""}`}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  useMagicLink ? "Send Magic Link" : "Create account"
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span style={{ background: "var(--bg-card)", padding: "0 8px", color: "var(--text-muted)" }}>
                  Or
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="btn-secondary w-full"
              onClick={() => {
                const form = document.querySelector("form")!
                const input = document.createElement("input")
                input.type = "hidden"
                input.name = "useMagicLink"
                input.value = "true"
                form.appendChild(input)
                handleSubmit(onSubmit)()
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Use Magic Link Instead
            </Button>

            <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Already have an account?{" "}
              <Link
                href="/login"
                style={{ color: "var(--accent-gold)", transition: "opacity 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
