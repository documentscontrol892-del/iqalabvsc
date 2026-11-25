import React, { useMemo, useState } from 'react';
import { Cloud, Download, Lock, Pencil, Plus, RotateCcw, Search, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import {
  AuditChecklistItem,
  AuditProgramItem,
  AuditScheduleItem,
  AuditTrailEntry,
  CarRecord,
  DeviationAlert,
  EquipmentItem,
  ParRecord,
  ROLE_LABELS,
  RoleInvite,
  UserProfile,
  UserRole,
} from '../types/iso17025';
import {
  canPerformAction,
  exportToCsvWithBom,
  exportToJson,
  formatTrailTimestamp,
} from '../utils/isoRules';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface SecurityAuditTrailViewProps {
  isCloudMode: boolean;
  currentUser: UserProfile;
  users: UserProfile[];
  roleInvites: RoleInvite[];
  trail: AuditTrailEntry[];
  programs: AuditProgramItem[];
  schedules: AuditScheduleItem[];
  checklists: AuditChecklistItem[];
  cars: CarRecord[];
  pars: ParRecord[];
  equipment: EquipmentItem[];
  alerts: DeviationAlert[];
  onSetPreviewRole: (role: UserRole) => void;
  onUpdateUserRole: (uid: string, role: UserRole, isActive: boolean) => void;
  onUpdateUserAccount: (
    uid: string,
    patch: { displayName: string; department: string; role: UserRole; isActive: boolean }
  ) => void;
  onAssignUserRole: (input: {
    email: string;
    displayName: string;
    department: string;
    role: UserRole;
    isActive: boolean;
  }) => void;
  onUpdateRoleInvite: (
    inviteId: string,
    patch: { displayName: string; department: string; role: UserRole; isActive: boolean }
  ) => void;
  onDeleteRoleInvite: (inviteId: string) => void;
  onDeleteUserProfile: (uid: string) => void;
  onSignIn: () => void;
  onResetSandbox: () => void;
  onClearAllWorkspaceData: () => Promise<void> | void;
}

type EditModalState =
  | { kind: 'user'; user: UserProfile }
  | { kind: 'invite'; invite: RoleInvite }
  | null;

export const SecurityAuditTrailView: React.FC<SecurityAuditTrailViewProps> = ({
  isCloudMode,
  currentUser,
  users,
  roleInvites,
  trail,
  programs,
  schedules,
  checklists,
  cars,
  pars,
  equipment,
  alerts,
  onSetPreviewRole,
  onUpdateUserRole,
  onUpdateUserAccount,
  onAssignUserRole,
  onUpdateRoleInvite,
  onDeleteRoleInvite,
  onDeleteUserProfile,
  onSignIn,
  onResetSandbox,
  onClearAllWorkspaceData,
}) => {
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'user'; id: string; label: string } | { kind: 'invite'; id: string; label: string } | null
  >(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Add / Pre-assign User Role Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{
    email: string;
    displayName: string;
    department: string;
    role: UserRole;
    isActive: boolean;
  }>({
    email: '',
    displayName: '',
    department: 'ห้องปฏิบัติการทดสอบ',
    role: 'auditee',
    isActive: true,
  });

  // Edit User or Invite Role Modal
  const [editTarget, setEditTarget] = useState<EditModalState>(null);
  const [editForm, setEditForm] = useState<{
    displayName: string;
    department: string;
    role: UserRole;
    isActive: boolean;
  }>({
    displayName: '',
    department: '',
    role: 'auditee',
    isActive: true,
  });

  const canManageUsers = canPerformAction(currentUser.role, 'manage_users');
  const canDelete = canPerformAction(currentUser.role, 'delete_any_record');
  const totalOperationalRecords =
    programs.length +
    schedules.length +
    checklists.length +
    cars.length +
    pars.length +
    equipment.length +
    alerts.length;

  const roleCounts = useMemo(() => {
    const counts: Record<UserRole, number> = {
      quality_manager: 0,
      auditor: 0,
      auditee: 0,
      executive: 0,
    };
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch, roleFilter]);

  const openEditUserModal = (u: UserProfile) => {
    setEditTarget({ kind: 'user', user: u });
    setEditForm({
      displayName: u.displayName,
      department: u.department,
      role: u.role,
      isActive: u.isActive,
    });
  };

  const openEditInviteModal = (inv: RoleInvite) => {
    setEditTarget({ kind: 'invite', invite: inv });
    setEditForm({
      displayName: inv.displayName,
      department: inv.department,
      role: inv.role,
      isActive: inv.isActive,
    });
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email.trim() || !addForm.displayName.trim() || !addForm.department.trim()) return;
    onAssignUserRole(addForm);
    setAddForm({
      email: '',
      displayName: '',
      department: 'ห้องปฏิบัติการทดสอบ',
      role: 'auditee',
      isActive: true,
    });
    setShowAddModal(false);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editForm.displayName.trim() || !editForm.department.trim()) return;
    if (editTarget.kind === 'user') {
      onUpdateUserAccount(editTarget.user.uid, editForm);
    } else {
      onUpdateRoleInvite(editTarget.invite.id, editForm);
    }
    setEditTarget(null);
  };

  const handleExportAllJson = () => {
    exportToJson(`ISO17025_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`, {
      exportedAt: new Date().toISOString(),
      standard: 'ISO/IEC 17025:2017',
      procedure: 'PD-LB-021 Rev.02',
      programs,
      schedules,
      checklists,
      carRecords: cars,
      parRecords: pars,
      equipment,
      auditTrail: trail,
    });
  };

  const handleExportTrailCsv = () => {
    exportToCsvWithBom(
      `ISO17025_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`,
      ['วัน-เวลา', 'ผู้ดำเนินการ', 'บทบาท (RBAC)', 'การกระทำ', 'ชุดข้อมูล', 'รหัสอ้างอิง', 'รายละเอียด'],
      trail.map((t) => [
        formatTrailTimestamp(t.createdAt),
        t.actorName,
        ROLE_LABELS[t.actorRole].th,
        t.action,
        t.targetCollection,
        t.targetCode,
        t.summary,
      ])
    );
  };

  const isEditingSelf = editTarget?.kind === 'user' && editTarget.user.uid === currentUser.uid;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-mono-tabular">
            ISO/IEC 17025 ข้อ 4.2 · 7.5 · 7.11 · 8.4 · Cloud Firestore RBAC & Immutable Audit Log
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            ความปลอดภัย การจำกัดสิทธิ์ (RBAC) ประวัติย้อนกลับ และการส่งออกข้อมูล
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportAllJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            ส่งออกฐานข้อมูล JSON
          </button>
          <button
            type="button"
            onClick={handleExportTrailCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            ส่งออกประวัติ Audit Trail (CSV)
          </button>
        </div>
      </div>

      {/* Cloud & RBAC Mode Banner */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                การเชื่อมต่อคลาวด์และมาตรการรักษาความปลอดภัย
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isCloudMode
                  ? 'เชื่อมต่อกับ Firebase Cloud Firestore และ Google Authentication (ยืนยันอีเมลแล้ว) บังคับใช้กฎความปลอดภัย Firestore Security Rules ตามระดับสิทธิ์ RBAC และล็อกประวัติ Audit Trail แบบห้ามแก้ไขหรือลบ'
                  : 'กำลังทำงานในโหมดใช้งานออฟไลน์ (ไม่มีข้อมูลจำลอง) ข้อมูลบันทึกในเครื่องและสามารถสลับบทบาทผู้ใช้งาน หรือเชื่อมต่อระบบคลาวด์ผ่าน Google Auth ได้ทันที'}
              </p>
            </div>
          </div>

          {!isCloudMode && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-800">
                สลับบทบาทผู้ใช้งาน (โหมดออฟไลน์)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onSetPreviewRole(r)}
                    className={`p-3 rounded-md border text-left transition-colors ${
                      currentUser.role === r
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-semibold">{ROLE_LABELS[r].th}</div>
                    <div className={`text-[11px] mt-0.5 ${currentUser.role === r ? 'text-slate-300' : 'text-slate-500'}`}>
                      {ROLE_LABELS[r].level}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  เข้าสู่ระบบ Cloud (Google Auth)
                </button>
                {canManageUsers && (
                  <button
                    type="button"
                    disabled={totalOperationalRecords === 0}
                    onClick={() => setShowClearAllModal(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    ล้างข้อมูลทั้งหมด
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RBAC Capability Matrix */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-700" />
            ตารางกำหนดสิทธิ์ตามระดับความรับผิดชอบ (PD-LB-021 ข้อ 5)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="py-2 px-3">หน้าที่ความรับผิดชอบ</th>
                  <th className="py-2 px-2 text-center">Admin (QM)</th>
                  <th className="py-2 px-2 text-center">Auditor</th>
                  <th className="py-2 px-2 text-center">Auditee</th>
                  <th className="py-2 px-2 text-center">Executive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[
                  { label: 'เพิ่ม / แก้ไข / ลบ ข้อมูลทุกหมวด และกำหนดบทบาทผู้ใช้ (Admin)', qm: true, aud: false, aee: false, exe: false },
                  { label: 'กำหนดแผนโปรแกรมและตารางตรวจประจำปี (FM-023/022)', qm: true, aud: false, aee: false, exe: false },
                  { label: 'อนุมัติแผนโปรแกรมประจำปี (FM-023)', qm: true, aud: false, aee: false, exe: true },
                  { label: 'ตรวจประเมิน & ออก CAR/NC/PAR (FM-024/011/013)', qm: true, aud: true, aee: false, exe: false },
                  { label: 'ตอบสาเหตุ & แนวทางแก้ไข ส่วนที่ 2 (7 วันทำการ)', qm: true, aud: true, aee: true, exe: false },
                  { label: 'ทวนสอบประสิทธิผล & ปิด CAR/PAR ส่วนที่ 3', qm: true, aud: true, aee: false, exe: false },
                  { label: 'บันทึกค่าตรวจวัดเครื่องมือ & รับทราบ Alert', qm: true, aud: true, aee: true, exe: false },
                  { label: 'ดูรายงานสรุป แนวโน้ม & ส่งออกข้อมูล', qm: true, aud: true, aee: true, exe: true },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="py-2 px-3 text-slate-800">{row.label}</td>
                    <td className="py-2 px-2 text-center font-mono-tabular">{row.qm ? '✓' : '-'}</td>
                    <td className="py-2 px-2 text-center font-mono-tabular">{row.aud ? '✓' : '-'}</td>
                    <td className="py-2 px-2 text-center font-mono-tabular">{row.aee ? '✓' : '-'}</td>
                    <td className="py-2 px-2 text-center font-mono-tabular">{row.exe ? '✓' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Admin Fresh Start / Wipe Created Operational Data */}
      {canManageUsers && (
        <section className="bg-white border border-red-200 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-red-700" />
              ล้างข้อมูลทั้งหมดเพื่อเริ่มต้นใหม่ (Fresh Start · Admin Only)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              ลบข้อมูลปฏิบัติการที่สร้างไว้ทั้งหมด (โปรแกรม FM-LB-023, ตารางตรวจ FM-LB-022, รายการตรวจ FM-LB-024, CAR/NC FM-LB-011/012, PAR FM-LB-013/014, เครื่องมือ และการแจ้งเตือน) โดยยังคงบัญชีผู้ใช้งานและบทบาท RBAC ไว้ตามเดิม
            </p>
            <div className="text-[11px] font-mono-tabular text-slate-500 pt-0.5">
              ข้อมูลปัจจุบันในระบบ: โปรแกรม {programs.length} · ตาราง {schedules.length} · Checklist {checklists.length} · CAR/NC {cars.length} · PAR {pars.length} · เครื่องมือ {equipment.length} · แจ้งเตือน {alerts.length} (รวม {totalOperationalRecords} รายการ)
            </div>
          </div>
          <button
            type="button"
            disabled={totalOperationalRecords === 0 || isClearingAll}
            onClick={() => setShowClearAllModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-red-700 text-white rounded-md hover:bg-red-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isClearingAll ? 'กำลังล้างข้อมูล...' : 'ล้างข้อมูลทั้งหมดเพื่อเริ่มต้นใหม่'}
          </button>
        </section>
      )}

      {/* User Management & Role Assignment (Admin / Quality Manager only) */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">รายชื่อผู้ใช้งานและกำหนดบทบาทโดย Admin</h2>
            <p className="text-xs text-slate-500">
              Admin (Quality Manager) เป็นผู้กำหนด แก้ไข และมอบหมายบทบาทผู้ใช้งานทั้งหมดของระบบ
            </p>
            <div className="text-xs text-slate-600 font-mono-tabular pt-0.5">
              Admin {roleCounts.quality_manager} · Auditor {roleCounts.auditor} · Auditee {roleCounts.auditee} · Executive {roleCounts.executive}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="ค้นหาชื่อ อีเมล หรือหน่วยงาน..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md w-52 focus:outline-none focus:border-slate-500"
              />
            </div>
            <select
              aria-label="กรองตามบทบาท"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="ALL">ทุกบทบาท</option>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r].th}</option>
              ))}
            </select>
            {canManageUsers && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                เพิ่มผู้ใช้ / กำหนดบทบาท
              </button>
            )}
          </div>
        </div>

        {!canManageUsers && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            คุณเข้าสู่ระบบในบทบาท <span className="font-semibold text-slate-800">{ROLE_LABELS[currentUser.role].th}</span> — มีเพียง Admin (Quality Manager) เท่านั้นที่สามารถเพิ่ม แก้ไข หรือกำหนดบทบาทผู้ใช้งานได้
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                <th className="py-3 px-4">ชื่อ-สกุล</th>
                <th className="py-3 px-4">อีเมล</th>
                <th className="py-3 px-4">หน่วยงาน</th>
                <th className="py-3 px-4">บทบาทที่ Admin กำหนด</th>
                <th className="py-3 px-4">สถานะบัญชี</th>
                {canManageUsers && <th className="py-3 px-4 text-right">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((u) => {
                const isSelf = u.uid === currentUser.uid;
                return (
                  <tr key={u.uid} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {u.displayName}
                      {isSelf && <span className="ml-1.5 text-[11px] text-slate-500">(บัญชีปัจจุบัน)</span>}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 text-slate-600">{u.department}</td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`กำหนดสิทธิ์สำหรับ ${u.displayName}`}
                        disabled={!canManageUsers || isSelf}
                        title={isSelf ? 'ไม่สามารถลดสิทธิ์บัญชีที่กำลังใช้งานอยู่ได้' : 'เลือกบทบาทผู้ใช้งาน'}
                        value={u.role}
                        onChange={(e) => onUpdateUserRole(u.uid, e.target.value as UserRole, u.isActive)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r].th}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        disabled={!canManageUsers || isSelf}
                        title={isSelf ? 'ไม่สามารถระงับบัญชีที่กำลังใช้งานอยู่ได้' : 'สลับสถานะเปิดใช้งาน/ระงับสิทธิ์'}
                        onClick={() => onUpdateUserRole(u.uid, u.role, !u.isActive)}
                        className={`px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap ${
                          u.isActive
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {u.isActive ? 'เปิดใช้งาน' : 'ระงับสิทธิ์'}
                      </button>
                    </td>
                    {canManageUsers && (
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditUserModal(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <Pencil className="w-3 h-3" />
                            แก้ไขบทบาท
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() =>
                                setDeleteTarget({
                                  kind: 'user',
                                  id: u.uid,
                                  label: `${u.displayName} (${u.email})`,
                                })
                              }
                              aria-label={`ลบบัญชี ${u.displayName}`}
                              title={isSelf ? 'ไม่สามารถลบบัญชีปัจจุบันได้' : 'ลบบัญชีผู้ใช้'}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={canManageUsers ? 6 : 5} className="py-8 text-center text-slate-500">
                    {users.length === 0
                      ? 'ยังไม่มีรายชื่อผู้ใช้งานที่บันทึกในระบบ (เข้าสู่ระบบด้วย Google Auth เพื่อใช้งานระบบบัญชีผู้ใช้จริง)'
                      : 'ไม่พบผู้ใช้งานที่ตรงตามเงื่อนไขการค้นหา'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Admin Pre-Assigned Role Invites (Cloud Mode) */}
        {canManageUsers && roleInvites.length > 0 && (
          <div className="border-t border-slate-200">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-800">
                  บทบาทที่ Admin กำหนดล่วงหน้า (รอเข้าสู่ระบบครั้งแรก)
                </h3>
                <p className="text-[11px] text-slate-500">
                  เมื่อบุคลากรเข้าสู่ระบบด้วยอีเมล Google ด้านล่างครั้งแรก ระบบจะกำหนดบทบาทให้อัตโนมัติตามที่ Admin ระบุไว้
                </p>
              </div>
              <span className="text-xs font-mono-tabular text-slate-600">
                {roleInvites.length} รายการ
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-white border-b border-slate-200 font-semibold text-slate-700">
                    <th className="py-2.5 px-4">ชื่อ-สกุล</th>
                    <th className="py-2.5 px-4">อีเมล Google</th>
                    <th className="py-2.5 px-4">หน่วยงาน</th>
                    <th className="py-2.5 px-4">บทบาทที่กำหนด</th>
                    <th className="py-2.5 px-4">สถานะคำเชิญ</th>
                    <th className="py-2.5 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roleInvites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-medium text-slate-900">{inv.displayName}</td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-600">{inv.email}</td>
                      <td className="py-2.5 px-4 text-slate-600">{inv.department}</td>
                      <td className="py-2.5 px-4">
                        <select
                          aria-label={`แก้ไขบทบาทล่วงหน้าสำหรับ ${inv.displayName}`}
                          value={inv.role}
                          onChange={(e) =>
                            onUpdateRoleInvite(inv.id, {
                              displayName: inv.displayName,
                              department: inv.department,
                              role: e.target.value as UserRole,
                              isActive: inv.isActive,
                            })
                          }
                          className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded font-medium"
                        >
                          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r].th}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRoleInvite(inv.id, {
                              displayName: inv.displayName,
                              department: inv.department,
                              role: inv.role,
                              isActive: !inv.isActive,
                            })
                          }
                          className={`px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap ${
                            inv.isActive
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-slate-100 border-slate-300 text-slate-600'
                          }`}
                        >
                          {inv.isActive ? 'พร้อมใช้งาน' : 'ปิดคำเชิญ'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditInviteModal(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <Pencil className="w-3 h-3" />
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                kind: 'invite',
                                id: inv.id,
                                label: `${inv.displayName} (${inv.email})`,
                              })
                            }
                            aria-label={`ลบคำเชิญ ${inv.displayName}`}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-slate-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Immutable Audit Trail */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            ประวัติการตรวจสอบย้อนกลับ (Immutable Audit Trail · ISO/IEC 17025 ข้อ 7.5 & 8.4)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกทุกการสร้าง แก้ไข และอนุมัติแบบ Append-only ไม่สามารถแก้ไขหรือลบย้อนหลังได้
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                <th className="py-3 px-4">วัน-เวลา</th>
                <th className="py-3 px-4">ผู้ดำเนินการ</th>
                <th className="py-3 px-4">กิจกรรม (Action)</th>
                <th className="py-3 px-4">เอกสารอ้างอิง</th>
                <th className="py-3 px-4">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {trail.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                    {formatTrailTimestamp(t.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{t.actorName}</div>
                    <div className="text-[11px] text-slate-500">{ROLE_LABELS[t.actorRole].th}</div>
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-slate-700">{t.action}</td>
                  <td className="py-3 px-4 font-mono-tabular font-semibold text-slate-900">{t.targetCode}</td>
                  <td className="py-3 px-4 text-slate-700">{t.summary}</td>
                </tr>
              ))}
              {trail.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    ยังไม่มีประวัติกิจกรรมในระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Admin Add / Pre-assign User Role */}
      {showAddModal && canManageUsers && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitAdd}
            className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-slate-700" />
                  เพิ่มผู้ใช้ / กำหนดบทบาทโดย Admin
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ระบุอีเมลและบทบาทล่วงหน้า เมื่อผู้ใช้เข้าสู่ระบบด้วย Google จะได้รับสิทธิ์ทันที
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="ปิดหน้าต่าง"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">อีเมลผู้ใช้งาน (Google Account)</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="staff@vet-superior.co.th"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อ-สกุล</label>
                <input
                  type="text"
                  required
                  value={addForm.displayName}
                  onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="เช่น น.ส.พิมพ์ชนก วงศ์สุวรรณ"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">หน่วยงาน / แผนก</label>
                <input
                  type="text"
                  required
                  value={addForm.department}
                  onChange={(e) => setAddForm((f) => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">บทบาท (RBAC Role)</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-medium"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r].th} — {ROLE_LABELS[r].level}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.isActive}
                  onChange={(e) => setAddForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-700 font-medium">เปิดใช้งานสิทธิ์ทันที</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                บันทึกและกำหนดบทบาท
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Admin Edit User / Role */}
      {editTarget && canManageUsers && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitEdit}
            className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  แก้ไขข้อมูลและบทบาทผู้ใช้งาน
                </h3>
                <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                  {editTarget.kind === 'user' ? editTarget.user.email : editTarget.invite.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="ปิดหน้าต่าง"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อ-สกุล</label>
                <input
                  type="text"
                  required
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">หน่วยงาน / แผนก</label>
                <input
                  type="text"
                  required
                  value={editForm.department}
                  onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">บทบาท (RBAC Role)</label>
                <select
                  disabled={isEditingSelf}
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-medium disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r].th} — {ROLE_LABELS[r].level}</option>
                  ))}
                </select>
                {isEditingSelf && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    ไม่สามารถลดสิทธิ์บัญชี Admin ปัจจุบันได้
                  </p>
                )}
              </div>
              <label className={`flex items-center gap-2 pt-1 ${isEditingSelf ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  disabled={isEditingSelf}
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-700 font-medium">เปิดใช้งานบัญชีผู้ใช้งาน</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.kind === 'invite' ? 'ยืนยันการลบรายการกำหนดบทบาทล่วงหน้า' : 'ยืนยันการลบบัญชีผู้ใช้งาน'}
        itemLabel={deleteTarget ? deleteTarget.label : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            if (deleteTarget.kind === 'user') {
              onDeleteUserProfile(deleteTarget.id);
            } else {
              onDeleteRoleInvite(deleteTarget.id);
            }
          }
          setDeleteTarget(null);
        }}
      />

      <ConfirmDeleteModal
        isOpen={showClearAllModal}
        title="ยืนยันการล้างข้อมูลทั้งหมดเพื่อเริ่มต้นใหม่ (Fresh Start)"
        itemLabel={`ข้อมูลปฏิบัติการทั้งหมด ${totalOperationalRecords} รายการ (บัญชีผู้ใช้งานและบทบาท RBAC จะยังคงอยู่)`}
        confirmLabel="ยืนยันล้างข้อมูลทั้งหมด"
        onCancel={() => setShowClearAllModal(false)}
        onConfirm={async () => {
          setShowClearAllModal(false);
          setIsClearingAll(true);
          try {
            await onClearAllWorkspaceData();
          } finally {
            setIsClearingAll(false);
          }
        }}
      />
    </div>
  );
};
