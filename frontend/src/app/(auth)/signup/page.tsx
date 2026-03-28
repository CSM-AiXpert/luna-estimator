"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
      // Create organization first
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] px-4">
        <Card className="max-w-md w-full border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#00d4ff]/10">
              <Mail className="h-6 w-6 text-[#00d4ff]" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
            <p className="text-white/50 text-sm">
              We&apos;ve sent a magic link to your email. Click the link to sign in.
            </p>
            <Link href="/login" className="mt-4 block">
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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] px-4 py-8">
      <div className="fixed inset-0 bg-gradient-to-br from-[#00d4ff]/5 via-transparent to-[#3b82f6]/5 pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#3b82f6]">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-white tracking-tight">
                LUNA
              </div>
              <div className="text-xs text-white/40 uppercase tracking-widest">
                Estimator
              </div>
            </div>
          </div>
        </div>

        <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription className="text-white/50">
              Start estimating projects with Luna AI
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
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Drywall"
                  {...register("orgName")}
                  className={errors.orgName ? "border-red-500/50" : ""}
                />
                {errors.orgName && (
                  <p className="text-xs text-red-400">{errors.orgName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Smith"
                  {...register("fullName")}
                  className={errors.fullName ? "border-red-500/50" : ""}
                />
                {errors.fullName && (
                  <p className="text-xs text-red-400">{errors.fullName.message}</p>
                )}
              </div>

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

              {!useMagicLink && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register("password")}
                    className={errors.password ? "border-red-500/50" : ""}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
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
                <span className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0d1224] px-2 text-white/30">
                  Or
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                // Toggle magic link mode by updating form value
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

            <p className="text-center text-sm text-white/50">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-[#00d4ff] hover:text-[#00d4ff]/80 transition-colors"
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
