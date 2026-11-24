import React from 'react';
import { User } from 'firebase/auth';
import { StudioView } from '../types/studio';
import { Box, BookOpen, Code2, Layers, Shield, LogIn, UserCheck } from 'lucide-react';

interface TopNavProps {
  activeView: StudioView;
  onSelectView: (view: StudioView) => void;
  user: User | null;
  onOpenAuth: () => void;
}

const NAV_ITEMS: { id: StudioView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'simulator', label: '3D Simulator', icon: Box },
  { id: 'infographics', label: 'Infographics', icon: BookOpen },
  { id: 'cpp', label: 'C++20 Engine', icon: Code2 },
  { id: 'workspace', label: 'Workspace', icon: Layers },
  { id: 'admin', label: 'Admin', icon: Shield },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeView,
  onSelectView,
  user,
  onOpenAuth,
}) => {
  return (
    <header className="h-14 shrink-0 bg-[#0D131F] border-b border-slate-800/90 px-4 lg:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-400 font-display font-bold text-sm">
          H
        </div>
        <span className="font-display font-semibold text-sm sm:text-base tracking-tight text-slate-100 whitespace-nowrap">
          Helios C++ Studio
        </span>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Studio modules">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              data-testid={`nav-${item.id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-400/35'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="shrink-0">
        <button
          type="button"
          onClick={onOpenAuth}
          data-testid="auth-cta-button"
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
            user
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold'
          }`}
        >
          {user ? (
            <>
              <UserCheck className="w-4 h-4 text-sky-400" />
              <span className="max-w-[130px] truncate">{user.displayName || user.email || 'Account'}</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
