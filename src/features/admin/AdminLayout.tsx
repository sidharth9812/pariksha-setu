import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  FileCheck2,
  Radio,
  Award,
  Users,
  Settings,
  GraduationCap,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';

interface AdminLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onExitToStudentPortal: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  onExitToStudentPortal,
  children,
}) => {
  const { user, logout } = useAuth();
  const { settings } = useInstitute();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'series', label: 'Test Series', icon: FolderKanban },
    { id: 'tests', label: 'Tests Management', icon: FileCheck2 },
    { id: 'live', label: 'Live Exams', icon: Radio, badge: 'Real-time' },
    { id: 'results', label: 'Results & Merit', icon: Award },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'settings', label: 'Settings & Branding', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold truncate max-w-[180px]">{settings.instituteName}</div>
            <div className="text-[10px] text-indigo-300">Admin Control Panel</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-slate-800 cursor-pointer flex items-center gap-1 text-xs"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            {mobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar for Desktop & Mobile Overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Sidebar Header */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold truncate text-white">{settings.instituteName}</h2>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-900 text-indigo-300 border border-indigo-700">
                Examination Controller
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <button
            onClick={() => {
              onExitToStudentPortal();
              setMobileSidebarOpen(false);
            }}
            className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Switch to Student View</span>
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <div className="truncate max-w-[140px]">
              <div className="font-semibold text-white truncate">{user?.name || 'Admin'}</div>
              <div className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@portal'}</div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
};
