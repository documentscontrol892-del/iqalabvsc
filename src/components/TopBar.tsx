import React from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { ROLE_LABELS, UserProfile, WorkspaceTab } from '../types/iso17025';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  isCloudMode: boolean;
  currentUser: UserProfile;
  onSignIn: () => void;
  onSignOut: () => void;
  activeAlertCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  isCloudMode,
  currentUser,
  onSignIn,
  onSignOut,
}) => {
  return (
    <header className="no-print h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-8 sticky top-0 z-30">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('dashboard')}
        className="text-left text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
      >
        Vet Superior ISO/IEC 17025
      </button>

      {/* Zone 2: 4 Concise Single-Line Nav Links */}
      <nav aria-label="หลัก" className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'dashboard'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          ภาพรวมและแจ้งเตือน
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('program_schedule')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'program_schedule'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          แผนตรวจติดตาม
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('audit_execution')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'audit_execution'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          ตรวจประเมิน
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('car_par')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'car_par'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          CAR / NC / PAR
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('equipment_trends')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'equipment_trends'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          เครื่องมือและแนวโน้ม
        </button>
      </nav>

      {/* Zone 3: 1 Primary Action (Session Sign-Out) */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onSignOut}
          aria-label={`ออกจากระบบ (${currentUser.displayName})`}
          className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span className="max-w-[100px] sm:max-w-[140px] truncate">{currentUser.displayName}</span>
          <span className="text-slate-500 hidden sm:inline">· ออกจากระบบ</span>
        </button>
      </div>
    </header>
  );
};

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  currentUser: UserProfile;
  isCloudMode: boolean;
  activeAlertCount: number;
  openCarCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  isCloudMode,
  activeAlertCount,
  openCarCount,
}) => {
  const navItems: {
    id: WorkspaceTab;
    label: string;
    sub: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
  }[] = [
    {
      id: 'dashboard',
      label: 'แดชบอร์ดเรียลไทม์',
      sub: 'ภาพรวมความสอดคล้อง & แจ้งเตือน',
      icon: Activity,
      count: activeAlertCount > 0 ? activeAlertCount : undefined,
    },
    {
      id: 'program_schedule',
      label: 'โปรแกรมและกำหนดการ',
      sub: 'FM-LB-023 · FM-LB-022',
      icon: CalendarDays,
    },
    {
      id: 'audit_execution',
      label: 'ตรวจประเมินและสรุปผล',
      sub: 'FM-LB-024 · FM-LB-025',
      icon: ClipboardCheck,
    },
    {
      id: 'car_par',
      label: 'จัดการ CAR / NC / PAR',
      sub: 'FM-LB-011 ถึง FM-LB-014',
      icon: CheckSquare,
      count: openCarCount > 0 ? openCarCount : undefined,
    },
    {
      id: 'equipment_trends',
      label: 'เครื่องมือและวิเคราะห์แนวโน้ม',
      sub: 'หมวด 6.4 · 6.5 · 7.7 · แนวโน้ม',
      icon: BarChart3,
    },
    {
      id: 'security_trail',
      label: 'สิทธิ์ RBAC · ประวัติ · ส่งออก',
      sub: 'ความปลอดภัย & ตรวจสอบย้อนกลับ',
      icon: ShieldCheck,
    },
  ];

  return (
    <aside className="no-print w-full md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between">
      <div className="p-3 md:p-4 space-y-3 md:space-y-6">
        <div className="hidden md:block px-2 space-y-1">
          <div className="text-xs font-medium text-slate-500">ห้องปฏิบัติการสมุทรสาคร</div>
          <div className="text-xs text-slate-600 font-mono-tabular">PD-LB-021 Rev.02 · Testing & Calibration</div>
        </div>

        <nav aria-label="เมนูระบบคุณภาพ" className="flex md:flex-col gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`shrink-0 md:w-full text-left px-3 py-2 md:py-2.5 rounded-md flex items-center md:items-start justify-between gap-2 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center md:items-start gap-2 min-w-0">
                  <Icon className={`w-4 h-4 md:mt-0.5 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                  <div className="min-w-0">
                    <div className="text-xs md:text-sm font-medium leading-tight whitespace-nowrap md:whitespace-normal md:truncate">
                      {item.label}
                    </div>
                    <div className={`hidden md:block text-[11px] mt-0.5 truncate ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                      {item.sub}
                    </div>
                  </div>
                </div>
                {typeof item.count === 'number' && (
                  <span
                    className={`text-xs font-mono-tabular font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                      active ? 'bg-slate-700 text-white' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden md:block p-4 border-t border-slate-200 space-y-2 text-xs">
        <div className="text-slate-500">ผู้ใช้งานปัจจุบัน</div>
        <div className="font-semibold text-slate-900 truncate">{currentUser.displayName}</div>
        <div className="text-slate-600 truncate">{ROLE_LABELS[currentUser.role].th}</div>
        <div className="text-slate-500 font-mono-tabular">
          {isCloudMode ? 'Cloud Firestore Sync · ปลอดภัย' : 'โหมดออฟไลน์ (Local Storage)'}
        </div>
      </div>
    </aside>
  );
};
