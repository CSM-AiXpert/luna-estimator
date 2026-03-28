"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Eye, EyeOff, ArrowRight, Mail } from "lucide-react"
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
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0f111e' }}
    >
      {/* Subtle background gradient */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 600px 600px at 30% 30%, rgba(226,178,74,0.04) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Luna mark + wordmark */}
          <div className="inline-flex items-center gap-3 mb-6">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: '52px', height: '52px', background: '#e2b24a', boxShadow: '0 4px 16px rgba(226,178,74,0.3)' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M12 3C7.5 3 3.5 7 3.5 12C3.5 17 7.5 21 12.5 21C14 21 15.5 20.5 16.5 19.5C14.5 18.5 13 16.5 13 14.5C13 12 15 10 17.5 10.5C18 7 15 3 12 3Z" fill="#0f111e"/>
              </svg>
            </div>
            <div className="text-left">
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#f0f4ff', lineHeight: 1 }}>LUNA</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#e2b24a', marginTop: '3px' }}>Estimator</div>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.4)', fontFamily: 'var(--font-body)' }}>
            Professional drywall & paint estimation
          </p>
        </div>

        {/* Card */}
        <div
          className="card animate-fade-up"
          style={{ animationDelay: '0.08s', animationFillMode: 'both', overflow: 'hidden' }}
        >
          {/* Top accent line */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #e2b24a60, transparent)' }} />

          <div style={{ padding: '28px 32px' }}>
            <div className="mb-6">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: '#f0f4ff', marginBottom: '4px' }}>
                Sign in to your account
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.4)' }}>
                Enter your credentials to continue
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: '13px', color: '#ef4444',
                }}>
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(240,244,255,0.5)' }}>
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
                  <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '3px' }}>{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(240,244,255,0.5)' }}>
                    Password
                  </Label>
                  <Link href="/forgot-password" style={{ fontSize: '12px', color: '#e2b24a', opacity: 0.85, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
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
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,244,255,0.25)', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,244,255,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,244,255,0.25)'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '3px' }}>{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                style={{ height: '44px', justifyContent: 'center', marginTop: '8px', fontSize: '14px', gap: '8px' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                ) : (
                  <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ position: 'relative', margin: '20px 0' }}>
              <div style={{ position: 'absolute', inset: '50% auto auto auto', width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', transform: 'translateY(-50%)' }} />
              <div style={{ position: 'relative', width: '28px', height: '28px', borderRadius: '50%', background: '#1a1d2c', border: '1px solid rgba(255,255,255,0.06)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail className="h-3 w-3" style={{ color: 'rgba(240,244,255,0.2)' }} />
              </div>
            </div>

            {/* Magic link */}
            <Link href="/magic-link" style={{ display: 'block' }}>
              <button type="button" className="btn-secondary w-full" style={{ height: '44px', justifyContent: 'center', fontSize: '14px' }}>
                Continue with Magic Link
              </button>
            </Link>
          </div>

          {/* Card footer */}
          <div style={{ padding: '14px 32px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.4)' }}>
              No account yet?{' '}
              <Link href="/signup" style={{ color: '#e2b24a', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Create one
              </Link>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(240,244,255,0.15)', marginTop: '24px' }}>
          Coastal Solutions Media · lunaestimator.com
        </p>
      </div>
    </div>
  )
}
