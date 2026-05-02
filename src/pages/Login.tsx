import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { siteConfig } from '@/config';
import { isSupabaseConfigured, signInWithSupabaseEmail, signInWithSupabaseGoogle } from '@/lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  const handleEmailSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setMessage('');
    try {
      await signInWithSupabaseEmail(email.trim());
      setMessage('Check your email for the Luna Estimator sign-in link.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start email sign-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-[#e0e0e0]">
      <div className="w-16 h-16 rounded-2xl bg-black/30 border border-amber-400/20 flex items-center justify-center mb-6 overflow-hidden shadow-[0_0_32px_rgba(251,191,36,0.14)]">
        <img src="/brand/luna-moon.png" alt="Luna moon mark" className="w-12 h-12 object-contain" />
      </div>
      <h1 className="text-2xl font-bold mb-2">{siteConfig.title}</h1>
      <p className="text-sm text-[#888] mb-8">{siteConfig.description}</p>
      {isSupabaseConfigured ? (
        <div className="w-full max-w-sm space-y-3">
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Estimator email"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-amber-500/40"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-8 py-3 rounded-xl liquid-glass-strong text-amber-400 font-medium hover:text-amber-300 transition-colors disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {isSubmitting ? 'Sending link...' : 'Email Magic Link'}
              </span>
            </button>
          </form>
          <button
            onClick={() => void signInWithSupabaseGoogle()}
            className="w-full px-8 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-[#e0e0e0] font-medium hover:bg-white/[0.06] transition-colors"
          >
            Continue with Google
          </button>
          {message && <p className="text-center text-xs text-[#9e9e9e]">{message}</p>}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center">
          <p className="text-sm text-amber-300">Supabase is not configured yet.</p>
          <p className="mt-1 text-xs text-[#888]">Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to activate sign-in.</p>
        </div>
      )}
    </div>
  );
}
