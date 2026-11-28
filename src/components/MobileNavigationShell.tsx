import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Banknote,
  Briefcase,
  Camera,
  Cloud,
  Landmark,
  LayoutGrid,
  Lock,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import type { NavSection } from '../types/recovery';
import { PWAInstallButton } from './PWAInstallButton';

export interface MobileNavItem {
  id: NavSection;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MobileNavigationShellProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  primaryNavItems: MobileNavItem[];
  secondaryNavItems: MobileNavItem[];
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  isAdmin: boolean;
  isSyncingCloud: boolean;
  onSyncLive: () => void;
  onOpenAdminModal: () => void;
  onUploadAersFile: (file: File) => void;
  onStartSnapPick: () => void;
  borderlineBadge?: number;
  assignBadge?: number;
  moreBadgeCount?: number;
  labels: {
    overview: string;
    belowThree: string;
    borderline: string;
    assign: string;
    menu: string;
    adminActive: string;
    adminLogin: string;
    uploadAers: string;
    refreshLive: string;
    snapExport: string;
  };
}

const PINNED_MOBILE_TABS: NavSection[] = [
  'overview',
  'below_three',
  'borderline',
  'assign_user',
];

export function MobileNavigationShell({
  activeNav,
  onSelectNav,
  primaryNavItems,
  secondaryNavItems,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  isDark,
  onToggleDark,
  isAdmin,
  isSyncingCloud,
  onSyncLive,
  onOpenAdminModal,
  onUploadAersFile,
  onStartSnapPick,
  borderlineBadge,
  assignBadge,
  moreBadgeCount = 0,
  labels,
}: MobileNavigationShellProps) {
  // Lock body scroll when mobile drawer is open & allow Escape to close
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMenu();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen, onCloseMenu]);

  const isMoreSectionActive = !PINNED_MOBILE_TABS.includes(activeNav);

  const handleNavigate = (id: NavSection) => {
    onSelectNav(id);
    onCloseMenu();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const bottomTabs: {
    id: NavSection | 'more';
    label: string;
    icon: React.ReactNode;
    active: boolean;
    badge?: number;
    onClick: () => void;
  }[] = [
    {
      id: 'overview',
      label: labels.overview,
      icon: <Landmark className="w-[20px] h-[20px]" />,
      active: activeNav === 'overview' && !menuOpen,
      onClick: () => handleNavigate('overview'),
    },
    {
      id: 'below_three',
      label: labels.belowThree,
      icon: <Banknote className="w-[20px] h-[20px]" />,
      active: activeNav === 'below_three' && !menuOpen,
      onClick: () => handleNavigate('below_three'),
    },
    {
      id: 'borderline',
      label: labels.borderline,
      icon: <ShieldAlert className="w-[20px] h-[20px]" />,
      active: activeNav === 'borderline' && !menuOpen,
      badge: borderlineBadge,
      onClick: () => handleNavigate('borderline'),
    },
    {
      id: 'assign_user',
      label: labels.assign,
      icon: <Briefcase className="w-[20px] h-[20px]" />,
      active: activeNav === 'assign_user' && !menuOpen,
      badge: assignBadge,
      onClick: () => handleNavigate('assign_user'),
    },
    {
      id: 'more',
      label: labels.menu,
      icon: <LayoutGrid className="w-[20px] h-[20px]" />,
      active: menuOpen || isMoreSectionActive,
      badge: moreBadgeCount > 0 ? moreBadgeCount : undefined,
      onClick: () => (menuOpen ? onCloseMenu() : onOpenMenu()),
    },
  ];

  return (
    <>
      {/* Mobile Native-Style Fixed Bottom Tab Bar (Thumb Zone) */}
      <nav
        aria-label="Mobile Primary Navigation"
        data-snapshot-ignore="true"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#14171d]/95 backdrop-blur-xl border-t border-zinc-200/90 dark:border-zinc-800/90 shadow-[0_-6px_24px_-8px_rgba(0,0,0,0.16)] pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-[60px] px-1">
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              aria-current={tab.active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center min-h-[48px] px-1 rounded-xl transition-colors ${
                tab.active
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-zinc-500 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800/70'
              }`}
            >
              <span className="relative flex items-center justify-center">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white font-mono text-[9px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </span>
              <span
                className={`mt-1 text-[10px] leading-none tracking-tight truncate max-w-full ${
                  tab.active ? 'font-bold' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
              {tab.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 w-6 h-0.5 rounded-full bg-red-700 dark:bg-red-500"
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile Slide-Up Bottom Sheet Drawer (All Modules + Quick Controls) */}
      <AnimatePresence>
        {menuOpen && (
          <div
            className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="WG Pulse Mobile Menu & Controls"
            data-snapshot-ignore="true"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onCloseMenu}
              className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="relative z-10 w-full max-h-[86dvh] bg-white dark:bg-[#16181e] rounded-t-3xl border-t border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden pb-safe"
            >
              {/* Drag Handle & Sheet Header */}
              <div className="pt-2.5 pb-3 px-5 border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0">
                <div
                  aria-hidden="true"
                  className="w-10 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mb-3"
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                      WG Pulse Modules &amp; Controls
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Jump to any dashboard section or quick action
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseMenu}
                    aria-label="Close mobile menu"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 active:scale-95 transition-transform"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {/* All 11 Dashboard Sections Grid */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1">
                    Recovery Modules
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[...primaryNavItems, ...secondaryNavItems].map((item) => {
                      const isActive = activeNav === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigate(item.id)}
                          className={`flex items-center justify-between gap-2 min-h-[48px] px-3 py-2.5 rounded-2xl border text-left transition-colors active:scale-[0.98] ${
                            isActive
                              ? 'bg-red-700 border-red-700 text-white shadow-sm'
                              : 'bg-zinc-50/90 dark:bg-zinc-900/80 border-zinc-200/80 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={
                                isActive
                                  ? 'text-white'
                                  : 'text-red-700 dark:text-red-400'
                              }
                            >
                              {item.icon}
                            </span>
                            <span className="text-xs font-semibold truncate">
                              {item.shortLabel}
                            </span>
                          </span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span
                              className={`font-mono text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md shrink-0 ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-red-600/15 text-red-700 dark:text-red-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Display Appearance Control */}
                <div className="space-y-2.5 pt-1 border-t border-zinc-200/80 dark:border-zinc-800/80">
                  <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1 pt-2">
                    Display Theme
                  </div>
                  <button
                    type="button"
                    onClick={onToggleDark}
                    aria-label={
                      isDark ? 'Switch to light mode' : 'Switch to dark mode'
                    }
                    className="w-full min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 active:scale-[0.99] transition-transform"
                  >
                    <span className="flex items-center gap-2">
                      {isDark ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-zinc-600" />
                      )}
                      <span>{isDark ? 'Dark Mode Active' : 'Light Mode Active'}</span>
                    </span>
                    <span className="text-[11px] font-medium text-red-700 dark:text-red-400">
                      Switch to {isDark ? 'Light' : 'Dark'}
                    </span>
                  </button>
                </div>

                {/* Quick Actions (Sync, Snap Export, Upload AERS, Admin, Install App) */}
                <div className="space-y-2.5 pt-1 border-t border-zinc-200/80 dark:border-zinc-800/80">
                  <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1 pt-2">
                    Quick Actions
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onSyncLive();
                      }}
                      disabled={isSyncingCloud}
                      className="min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <Cloud
                        className={`w-4 h-4 text-emerald-600 shrink-0 ${
                          isSyncingCloud ? 'animate-pulse' : ''
                        }`}
                      />
                      <span className="truncate">{labels.refreshLive}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onStartSnapPick();
                      }}
                      className="min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                    >
                      <Camera className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
                      <span className="truncate">{labels.snapExport}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onOpenAdminModal();
                      }}
                      className={`min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${
                        isAdmin
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {isAdmin ? (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">{labels.adminActive}</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="truncate">{labels.adminLogin}</span>
                        </>
                      )}
                    </button>

                    {isAdmin ? (
                      <label className="min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-700 text-white text-xs font-bold cursor-pointer">
                        <Upload className="w-4 h-4 shrink-0" />
                        <span className="truncate">{labels.uploadAers}</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              onCloseMenu();
                              onUploadAersFile(file);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    ) : (
                      <div className="flex items-stretch">
                        <PWAInstallButton fullWidth showLabelAlways />
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="pt-1">
                      <PWAInstallButton fullWidth showLabelAlways />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
