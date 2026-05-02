import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { siteConfig, appConfig } from '@/config';
import { ArrowLeft, Moon, Sun, Bell, Shield, Database, Globe, Paintbrush, ChevronRight } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  const sections = [
    {
      title: 'Appearance',
      items: [
        {
          icon: isDark ? Moon : Sun,
          label: 'Theme',
          value: isDark ? 'Dark' : 'Light',
          action: () => setIsDark(!isDark),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: Bell,
          label: 'Notifications',
          value: notifications ? 'Enabled' : 'Disabled',
          action: () => setNotifications(!notifications),
        },
        {
          icon: Database,
          label: 'Auto-Save',
          value: autoSave ? 'On' : 'Off',
          action: () => setAutoSave(!autoSave),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: Shield,
          label: 'Signed in as',
          value: user?.name || 'User',
          action: undefined,
        },
        {
          icon: Globe,
          label: 'Region',
          value: siteConfig.state,
          action: undefined,
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          icon: Paintbrush,
          label: 'App Version',
          value: appConfig.version,
          action: undefined,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold">Settings</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-8">
        {/* Profile */}
        <div className="flex items-center gap-4 mb-8 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-lg font-bold text-white">
            {user?.name?.[0] || 'U'}
          </div>
          <div>
            <h2 className="text-base font-semibold">{user?.name}</h2>
            <p className="text-xs text-[#888]">{user?.email}</p>
            <p className="text-[10px] text-amber-400 mt-0.5 capitalize">{user?.role || 'Estimator'}</p>
          </div>
        </div>

        {/* Settings Sections */}
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-2 px-1">{section.title}</h3>
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              {section.items.map((item, idx) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 transition-colors ${
                    item.action ? 'hover:bg-white/[0.03]' : ''
                  } ${idx < section.items.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                >
                  <item.icon className="w-4 h-4 text-amber-400/70 shrink-0" />
                  <span className="text-sm flex-1">{item.label}</span>
                  <span className="text-xs text-[#888]">{item.value}</span>
                  {item.action && <ChevronRight className="w-3.5 h-3.5 text-[#555]" />}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Company Info */}
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-2">
            <Paintbrush className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm font-medium">{siteConfig.company}</p>
          <p className="text-[10px] text-[#555]">{siteConfig.title} v{appConfig.version}</p>
          <p className="text-[10px] text-[#444]">Built for {siteConfig.state} contractors</p>
        </div>

        {/* Sign Out */}
        <button
          onClick={logout}
          className="w-full py-3 rounded-xl border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/5 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
