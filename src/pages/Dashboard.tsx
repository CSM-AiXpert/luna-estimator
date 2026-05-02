import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/hooks/useAuth';
import { siteConfig, statusLabels } from '@/config';
import {
  Plus, Search, Settings, FileText,
  ChevronRight, Clock, CheckCircle,
  AlertCircle, Moon, Sun
} from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const config = statusLabels[status] || statusLabels.draft;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showMenu, setShowMenu] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        !search ||
        p.customerName.toLowerCase().includes(search.toLowerCase()) ||
        p.propertyAddress.toLowerCase().includes(search.toLowerCase()) ||
        p.estimateNumber.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filterStatus === 'all' || p.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [projects, search, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: projects.length,
      draft: projects.filter((p) => p.status === 'draft').length,
      signed: projects.filter((p) => p.status === 'signed').length,
      thisMonth: projects.filter((p) => {
        const d = new Date(p.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [projects]);

  const statusFilters = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'ready_for_review', label: 'Ready' },
    { key: 'sent', label: 'Sent' },
    { key: 'signed', label: 'Signed' },
  ];

  return (
    <div className={`min-h-screen w-full transition-colors ${isDark ? 'bg-black text-[#e0e0e0]' : 'bg-[#f5f5f0] text-[#1a1a1a]'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 ${isDark ? 'liquid-glass' : 'bg-white/80 backdrop-blur-md border-b border-black/5'}`}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black/30 border border-amber-400/20 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.12)]">
              <img src="/brand/luna-moon.png" alt="Luna moon mark" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">{siteConfig.title}</h1>
              <p className="text-[10px] text-[#888] leading-tight">{siteConfig.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]"
            >
              <Settings className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-[10px] text-white font-medium"
              >
                {user?.name?.[0] || 'U'}
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className={`absolute right-0 top-9 z-50 w-40 rounded-xl py-1.5 shadow-2xl border ${isDark ? 'bg-[#111] border-white/[0.06]' : 'bg-white border-black/5'}`}>
                    <div className="px-3 py-2 border-b border-white/[0.06]">
                      <p className="text-xs font-medium">{user?.name}</p>
                      <p className="text-[10px] text-[#888]">{user?.email}</p>
                    </div>
                    <button onClick={() => { logout(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-[#c45a5a] hover:bg-white/5 transition-colors">
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-2">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: stats.total, icon: FileText, color: '#c8956c' },
            { label: 'Drafts', value: stats.draft, icon: Clock, color: '#888' },
            { label: 'Signed', value: stats.signed, icon: CheckCircle, color: '#7dac5a' },
            { label: 'This Month', value: stats.thisMonth, icon: AlertCircle, color: '#5a9fd4' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-white border border-black/5'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className="w-3 h-3" style={{ color: stat.color }} />
                <span className="text-[10px] text-[#888] uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-xl font-semibold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex gap-2 mb-3">
          <div className={`flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5 ${isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-white border border-black/5'}`}>
            <Search className="w-4 h-4 text-[#555]" />
            <input
              type="text"
              placeholder="Search estimates, customers, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#555]"
            />
          </div>
          <button
            onClick={() => navigate('/new-estimate')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterStatus === f.key
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isDark ? 'bg-white/[0.03] text-[#888] border border-white/[0.06]' : 'bg-white text-[#666] border border-black/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects List */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#555] text-sm">Loading estimates...</div>
        ) : filteredProjects.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 rounded-2xl ${isDark ? 'bg-white/[0.02] border border-white/[0.04]' : 'bg-white border border-black/5'}`}>
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-amber-500/50" />
            </div>
            <p className="text-sm text-[#888] mb-1">{search || filterStatus !== 'all' ? 'No matching estimates' : 'No estimates yet'}</p>
            <p className="text-xs text-[#555] mb-4">Create your first estimate to get started</p>
            <button
              onClick={() => navigate('/new-estimate')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Estimate
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className={`w-full text-left rounded-xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  isDark ? 'bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12]' : 'bg-white border border-black/5 hover:border-black/10'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={project.status} />
                      <span className="text-[10px] text-[#555] font-mono">{project.estimateNumber}</span>
                    </div>
                    <h3 className="text-sm font-medium truncate">{project.customerName}</h3>
                    <p className="text-xs text-[#888] truncate">{project.propertyAddress}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[#555]">
                    {project.total && Number(project.total) > 0 && (
                      <span className="text-xs font-medium mr-1">${Number(project.total).toLocaleString()}</span>
                    )}
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[#555]">
                  <span>{project.projectType || 'Interior Painting'}</span>
                  <span>{project.propertyType || 'Single Family'}</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
