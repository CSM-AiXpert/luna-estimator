"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Building2, Loader2, Eye, EyeOff, ArrowRight, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase/client"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Min 6 characters"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)
    const supabase = getSupabaseClient()
    if (!supabase) { setError("Auth unavailable"); setIsLoading(false); return }
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) { setError(error.message); setIsLoading(false); return }
    router.push("/")
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-void)' }}
    >
      {/* Animated mesh background */}
      <div className="bg-mesh">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 700px 700px at 20% 20%, rgba(0,212,255,0.07) 0%, transparent 60%),
              radial-gradient(ellipse 500px 500px at 80% 80%, rgba(124,58,237,0.06) 0%, transparent 60%),
              radial-gradient(ellipse 400px 400px at 50% 50%, rgba(59,130,246,0.04) 0%, transparent 70%)
            `,
          }}
        />
        <div className="bg-mesh-grid" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-up">
          {/* Mark */}
          <div
            className="inline-flex items-center justify-center mb-6"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(59,130,246,0.1) 100%)',
              border: '1px solid rgba(0,212,255,0.25)',
              boxShadow: '0 8px 32px rgba(0,212,255,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <Building2 className="h-7 w-7" style={{ color: 'var(--accent-cyan)' }} />
          </div>

          {/* Wordmark */}
          <div>
            <div
              className="font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}
            >
              LUNA
            </div>
            <div
              className="uppercase tracking-widest"
              style={{ fontSize: '10px', color: 'rgba(0,212,255,0.6)', letterSpacing: '0.2em', marginTop: '2px' }}
            >
              Estimator Platform
            </div>
          </div>

          {/* Tagline */}
          <p
            className="mt-4"
            style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
          >
            Professional drywall & paint estimation
          </p>
        </div>

        {/* Card */}
        <div
          className="glass animate-fade-up"
          style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
        >
          {/* Card top accent line */}
          <div
            style={{
              height: '2px',
              borderRadius: '18px 18px 0 0',
              background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.5), rgba(124,58,237,0.5), transparent)',
            }}
          />

          <div className="px-7 py-6">
            <div className="mb-6">
              <h2
                className="font-bold"
                style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-primary)', marginBottom: '4px' }}
              >
                Sign in to your account
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Enter your credentials to continue
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    fontSize: '13px',
                    color: 'rgba(239,68,68,0.9)',
                  }}
                >
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  {...register("email")}
                  className="input"
                  style={errors.email ? { borderColor: 'rgba(239,68,68,0.5)' } : {}}
                />
                {errors.email && (
                  <p style={{ fontSize: '11px', color: 'rgba(239,68,68,0.8)', marginTop: '2px' }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  >
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    style={{ fontSize: '12px', color: 'var(--accent-cyan)', opacity: 0.8, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...register("password")}
                    className="input"
                    style={{ paddingRight: '2.75rem', ...(errors.password ? { borderColor: 'rgba(239,68,68,0.5)' } : {}) }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-disabled)', transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-disabled)')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p style={{ fontSize: '11px', color: 'rgba(239,68,68,0.8)', marginTop: '2px' }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                style={{
                  height: '44px',
                  fontSize: '14px',
                  borderRadius: 'var(--radius)',
                  justifyContent: 'center',
                  marginTop: '8px',
                  opacity: isLoading ? 0.7 : 1,
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ position: 'relative', margin: '20px 0' }}>
              <div style={{ position: 'absolute', inset: '50% auto auto auto', width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)', transform: 'translateY(-50%)' }} />
              <div
                className="inline-flex items-center justify-center"
                style={{
                  position: 'relative',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  margin: '0 auto',
                  display: 'flex',
                }}
              >
                <Zap className="h-3 w-3" style={{ color: 'var(--text-disabled)' }} />
              </div>
            </div>

            {/* Magic link */}
            <Link href="/magic-link" style={{ display: 'block' }}>
              <button
                type="button"
                className="btn-secondary w-full"
                style={{ height: '44px', justifyContent: 'center', fontSize: '14px' }}
              >
                Continue with Magic Link
              </button>
            </Link>
          </div>

          {/* Card bottom */}
          <div
            className="px-7 py-4 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              No account yet?{" "}
              <Link
                href="/signup"
                style={{ color: 'var(--accent-cyan)', fontWeight: 500, fontFamily: 'var(--font-display)' }}
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p
          className="text-center mt-6"
          style={{ fontSize: '11px', color: 'rgba(240,244,255,0.2)' }}
        >
          Coastal Solutions Media · lunaestimator.com
        </p>
      </div>
    </div>
  )
}
