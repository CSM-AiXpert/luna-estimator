import { useNavigate } from 'react-router';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-[#e0e0e0]">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <span className="text-2xl font-bold text-amber-400">404</span>
      </div>
      <h1 className="text-lg font-semibold mb-1">Page Not Found</h1>
      <p className="text-sm text-[#888] mb-6">The page you are looking for does not exist.</p>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-[#888] hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </button>
      </div>
    </div>
  );
}
