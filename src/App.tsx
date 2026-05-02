import { Routes, Route } from 'react-router';
import { useAuth } from './hooks/useAuth';
import Dashboard from './pages/Dashboard';
import NewEstimate from './pages/NewEstimate';
import ProjectSetup from './pages/ProjectSetup';
import RoomList from './pages/RoomList';
import RoomDetail from './pages/RoomDetail';
import AIVisualizer from './pages/AIVisualizer';
import EstimateBuilder from './pages/EstimateBuilder';
import MaterialsList from './pages/MaterialsList';
import PDFPreview from './pages/PDFPreview';
import SignatureScreen from './pages/SignatureScreen';
import EstimateDetail from './pages/EstimateDetail';
import Settings from './pages/Settings';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import { siteConfig } from './config';
import { useEffect } from 'react';
import { isSupabaseConfigured, signInWithSupabaseGoogle } from './lib/supabase';

function LoginPrompt() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-black/30 border border-amber-400/20 mx-auto mb-4 flex items-center justify-center overflow-hidden shadow-[0_0_32px_rgba(251,191,36,0.14)]">
          <img src="/brand/luna-moon.png" alt="Luna moon mark" className="w-12 h-12 object-contain" />
        </div>
        <h1 className="text-2xl font-semibold text-[#e0e0e0] mb-1">{siteConfig.title}</h1>
        <p className="text-sm text-[#666]">{siteConfig.description}</p>
      </div>
      {isSupabaseConfigured ? (
        <button
          onClick={() => void signInWithSupabaseGoogle()}
          className="liquid-glass-strong rounded-xl px-8 py-3 text-sm text-[#c8956c] hover:text-[#d4a574] transition-colors"
        >
          Sign In to Luna Estimator
        </button>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-[#888]">
          Configure Supabase keys to enable sign-in.
        </div>
      )}
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    document.title = siteConfig.title;
    document.documentElement.lang = siteConfig.language;
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <div className="text-[#555] text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/new-estimate" element={<NewEstimate />} />
      <Route path="/project/:projectId/setup" element={<ProjectSetup />} />
      <Route path="/project/:projectId/rooms" element={<RoomList />} />
      <Route path="/project/:projectId/room/:roomId" element={<RoomDetail />} />
      <Route path="/project/:projectId/room/:roomId/visualize" element={<AIVisualizer />} />
      <Route path="/project/:projectId/estimate" element={<EstimateBuilder />} />
      <Route path="/project/:projectId/materials" element={<MaterialsList />} />
      <Route path="/project/:projectId/pdf" element={<PDFPreview />} />
      <Route path="/project/:projectId/signature" element={<SignatureScreen />} />
      <Route path="/project/:projectId" element={<EstimateDetail />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
