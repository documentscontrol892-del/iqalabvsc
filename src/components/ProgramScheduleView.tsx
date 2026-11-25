import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, CheckCircle2, Download, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityType,
  AuditProgramItem,
  AuditScheduleItem,
  THAI_MONTHS_SHORT,
  UserProfile,
} from '../types/iso17025';
import {
  canPerformAction,
  exportToCsvWithBom,
  getCurrentBuddhistYear,
  parseRoundYearBE,
} from '../utils/isoRules';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface StartAnnualPlanPayload {
  yearBE: number;
  mode: 'standard' | 'copy' | 'blank';
  sourceYearBE?: number;
  createInitialSchedule: boolean;
  initialRound?: string;
  initialStartDate?: string;
  defaultAuditorName?: string;
  defaultAuditeeName?: string;
  replaceExistingYear?: boolean;
}

interface ProgramScheduleViewProps {
  programs: AuditProgramItem[];
  schedules: AuditScheduleItem[];
  currentUser: UserProfile;
  onToggleProgramMonth: (programId: string, monthIndex: number) => void;
  onApproveProgram: (programId: string) => void;
  onApproveAllProgramsForYear: (yearBE: number) => void;
  onStartNewAnnualPlan: (
    input: StartAnnualPlanPayload
  ) => Promise<{ programCount: number; scheduleCount: number }>;
  onAddProgram: (input: Omit<AuditProgramItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProgram: (
    programId: string,
    patch: Partial<Pick<AuditProgramItem, 'sequence' | 'activity' | 'activityType' | 'remarks' | 'months' | 'status'>>
  ) => void;
  onDeleteProgram: (programId: string) => void;
  onAddSchedule: (input: Omit<AuditScheduleItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateScheduleStatus: (scheduleId: string, status: AuditScheduleItem['status']) => void;
  onUpdateSchedule: (
    scheduleId: string,
    patch: Partial<
      Pick<
        AuditScheduleItem,
        'auditRound' | 'auditDate' | 'timeRange' | 'activity' | 'activityType' | 'criteria' | 'auditorName' | 'auditeeName' | 'status'
      >
    >
  ) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onOpenPrintModal: (
    formCode: 'FM-LB-022' | 'FM-LB-023',
    opts?: { yearBE?: number; auditRound?: string }
  ) => void;
}

export const ProgramScheduleView: React.FC<ProgramScheduleViewProps> = ({
  programs,
  schedules,
  currentUser,
  onToggleProgramMonth,
  onApproveProgram,
  onApproveAllProgramsForYear,
  onStartNewAnnualPlan,
  onAddProgram,
  onUpdateProgram,
  onDeleteProgram,
  onAddSchedule,
  onUpdateScheduleStatus,
  onUpdateSchedule,
  onDeleteSchedule,
  onOpenPrintModal,
}) => {
  const currentYearBE = getCurrentBuddhistYear();
  const [customYears, setCustomYears] = useState<number[]>([]);

  const availableYears = useMemo(() => {
    const set = new Set<number>([currentYearBE, ...customYears]);
    programs.forEach((p) => set.add(p.yearBE));
    schedules.forEach((s) => set.add(s.yearBE));
    return Array.from(set).sort((a, b) => b - a);
  }, [programs, schedules, customYears, currentYearBE]);

  const [selectedYearBE, setSelectedYearBE] = useState<number>(() => availableYears[0] ?? currentYearBE);

  useEffect(() => {
    if (!availableYears.includes(selectedYearBE)) {
      setSelectedYearBE(availableYears[0] ?? currentYearBE);
    }
  }, [availableYears, selectedYearBE, currentYearBE]);

  const yearPrograms = useMemo(
    () => programs.filter((p) => p.yearBE === selectedYearBE).sort((a, b) => a.sequence - b.sequence),
    [programs, selectedYearBE]
  );

  const yearSchedules = useMemo(
    () => schedules.filter((s) => s.yearBE === selectedYearBE).sort((a, b) => a.auditDate.localeCompare(b.auditDate)),
    [schedules, selectedYearBE]
  );

  const yearsWithPrograms = useMemo(() => {
    const set = new Set<number>();
    programs.forEach((p) => set.add(p.yearBE));
    return Array.from(set).sort((a, b) => b - a);
  }, [programs]);

  const [showAddProgram, setShowAddProgram] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<AuditProgramItem | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<AuditScheduleItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<
    { type: 'program'; item: AuditProgramItem } | { type: 'schedule'; item: AuditScheduleItem } | null
  >(null);

  // Program form state
  const [progActivity, setProgActivity] = useState('');
  const [progType, setProgType] = useState<ActivityType>('testing');
  const [progRemarks, setProgRemarks] = useState('');

  // Schedule form state
  const [schRound, setSchRound] = useState(`1/${selectedYearBE}`);
  const [schDate, setSchDate] = useState(`${selectedYearBE - 543}-05-15`);
  const [schTime, setSchTime] = useState('09:00 - 12:00');
  const [schActivity, setSchActivity] = useState('');
  const [schType, setSchType] = useState<ActivityType>('calibration');
  const [schCriteria, setSchCriteria] = useState('ISO/IEC 17025:2017, QM-LB-001, PD-LB-021');
  const [schAuditor, setSchAuditor] = useState('');
  const [schAuditee, setSchAuditee] = useState('');

  useEffect(() => {
    const existingRounds = new Set(yearSchedules.map((s) => s.auditRound));
    const nextIdx = existingRounds.size === 0 ? 1 : existingRounds.size + 1;
    setSchRound(`${nextIdx}/${selectedYearBE}`);
    setSchDate(`${selectedYearBE - 543}-05-15`);
  }, [selectedYearBE, yearSchedules.length]);

  // New Annual Plan modal state
  const [planYearBE, setPlanYearBE] = useState<number>(currentYearBE);
  const [planMode, setPlanMode] = useState<'standard' | 'copy' | 'blank'>('standard');
  const [planSourceYear, setPlanSourceYear] = useState<number>(yearsWithPrograms[0] ?? currentYearBE - 1);
  const [planCreateSchedule, setPlanCreateSchedule] = useState(true);
  const [planRound, setPlanRound] = useState(`1/${currentYearBE}`);
  const [planStartDate, setPlanStartDate] = useState(`${currentYearBE - 543}-05-15`);
  const [planAuditor, setPlanAuditor] = useState('');
  const [planAuditee, setPlanAuditee] = useState('');
  const [planReplaceExisting, setPlanReplaceExisting] = useState(false);

  const openNewAnnualPlanModal = (presetYear?: number) => {
    const targetYear =
      presetYear ??
      (programs.some((p) => p.yearBE === currentYearBE) ? Math.max(...availableYears) + 1 : currentYearBE);
    setPlanYearBE(targetYear);
    setPlanMode(yearsWithPrograms.length > 0 && targetYear !== yearsWithPrograms[0] ? 'standard' : 'standard');
    if (yearsWithPrograms.length > 0) {
      setPlanSourceYear(yearsWithPrograms[0]);
    }
    setPlanCreateSchedule(true);
    setPlanRound(`1/${targetYear}`);
    setPlanStartDate(`${targetYear - 543}-05-15`);
    setPlanAuditor(currentUser.displayName);
    setPlanAuditee('ตัวแทนห้องปฏิบัติการทดสอบ/สอบเทียบ');
    setPlanReplaceExisting(false);
    setShowNewPlanModal(true);
  };

  const handlePlanYearChange = (nextYear: number) => {
    setPlanYearBE(nextYear);
    setPlanRound(`1/${nextYear}`);
    setPlanStartDate(`${nextYear - 543}-05-15`);
  };

  const canEditProgram = canPerformAction(currentUser.role, 'edit_program');
  const canApproveProgram = canPerformAction(currentUser.role, 'approve_program');
  const canEditSchedule = canPerformAction(currentUser.role, 'edit_schedule');
  const canConductAudit = canPerformAction(currentUser.role, 'conduct_audit');
  const canAdminDelete = canPerformAction(currentUser.role, 'delete_any_record');

  const draftProgramsCount = yearPrograms.filter((p) => p.status !== 'approved').length;
  const targetYearHasData =
    programs.some((p) => p.yearBE === planYearBE) || schedules.some((s) => s.yearBE === planYearBE);

  const handleCreateProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!progActivity.trim()) return;
    const maxSeq = yearPrograms.reduce((m, p) => Math.max(m, p.sequence), 0);
    onAddProgram({
      yearBE: selectedYearBE,
      sequence: maxSeq + 1,
      activity: progActivity.trim(),
      activityType: progType,
      months: [false, false, false, false, false, true, false, false, false, false, false, true],
      remarks: progRemarks.trim(),
      preparedBy: currentUser.displayName,
      preparedDate: new Date().toISOString().slice(0, 10),
      status: 'draft',
    });
    setProgActivity('');
    setProgRemarks('');
    setShowAddProgram(false);
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schActivity.trim() || !schDate) return;
    const roundStr = schRound.trim() || `1/${selectedYearBE}`;
    onAddSchedule({
      auditRound: roundStr,
      yearBE: parseRoundYearBE(roundStr, selectedYearBE),
      auditDate: schDate,
      timeRange: schTime.trim() || '09:00 - 12:00',
      activity: schActivity.trim(),
      activityType: schType,
      criteria: schCriteria.trim(),
      auditorName: schAuditor.trim() || currentUser.displayName,
      auditeeName: schAuditee.trim() || 'ตัวแทนห้องปฏิบัติการ',
      status: 'planned',
    });
    setSchActivity('');
    setShowAddSchedule(false);
  };

  const handleSubmitNewAnnualPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeYear = Math.max(2560, Math.min(2700, Math.trunc(planYearBE)));
    await onStartNewAnnualPlan({
      yearBE: safeYear,
      mode: planMode,
      sourceYearBE: planMode === 'copy' ? planSourceYear : undefined,
      createInitialSchedule: planCreateSchedule,
      initialRound: planRound.trim() || `1/${safeYear}`,
      initialStartDate: planStartDate,
      defaultAuditorName: planAuditor.trim() || currentUser.displayName,
      defaultAuditeeName: planAuditee.trim() || 'ตัวแทนห้องปฏิบัติการ',
      replaceExistingYear: targetYearHasData ? planReplaceExisting : false,
    });
    setCustomYears((prev) => (prev.includes(safeYear) ? prev : [...prev, safeYear]));
    setSelectedYearBE(safeYear);
    setShowNewPlanModal(false);
  };

  const handleExportScheduleCsv = () => {
    exportToCsvWithBom(
      `FM-LB-022_Audit_Schedule_${selectedYearBE}.csv`,
      ['ครั้งที่', 'ปี พ.ศ.', 'ว/ด/ป', 'เวลา', 'กิจกรรม', 'ประเภทกิจกรรม', 'เกณฑ์การตรวจประเมิน', 'ผู้ตรวจ', 'ผู้ถูกตรวจ', 'สถานะ'],
      yearSchedules.map((s) => [
        s.auditRound,
        s.yearBE,
        s.auditDate,
        s.timeRange,
        s.activity,
        ACTIVITY_TYPE_LABELS[s.activityType],
        s.criteria,
        s.auditorName,
        s.auditeeName,
        s.status,
      ])
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-mono-tabular">PD-LB-021 ข้อ 7.1 – 7.2 · FM-LB-023 Rev.00 · FM-LB-022 Rev.01</div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            โปรแกรมและแผนกำหนดการตรวจติดตามคุณภาพภายใน
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-2.5 py-1">
            <label htmlFor="annual-year-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              แผนประจำปี พ.ศ.:
            </label>
            <select
              id="annual-year-select"
              value={selectedYearBE}
              onChange={(e) => setSelectedYearBE(Number(e.target.value))}
              className="text-xs font-mono-tabular font-bold text-slate-900 bg-transparent focus:outline-none py-1"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {canEditProgram && (
            <button
              type="button"
              onClick={() => openNewAnnualPlanModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              เริ่มแผนตรวจประจำปีใหม่
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenPrintModal('FM-LB-023', { yearBE: selectedYearBE })}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์ PDF FM-LB-023
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenPrintModal('FM-LB-022', {
                yearBE: selectedYearBE,
                auditRound: yearSchedules[0]?.auditRound,
              })
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์ PDF FM-LB-022
          </button>
        </div>
      </div>

      {/* FM-LB-023 Annual Internal Audit Program */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              FM-LB-023: โปรแกรมการตรวจติดตามคุณภาพภายในประจำปี พ.ศ. {selectedYearBE}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ครอบคลุมทุกส่วนของระบบบริหารงาน กิจกรรมการทดสอบ (Testing) และการสอบเทียบ (Calibration) อย่างน้อยปีละ 1 ครั้ง
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canApproveProgram && draftProgramsCount > 0 && (
              <button
                type="button"
                onClick={() => onApproveAllProgramsForYear(selectedYearBE)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-emerald-700 text-white rounded-md hover:bg-emerald-800 whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                อนุมัติแผนทั้งปี ({draftProgramsCount})
              </button>
            )}
            {canEditProgram && (
              <button
                type="button"
                onClick={() => setShowAddProgram((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่มกิจกรรมโปรแกรม
              </button>
            )}
          </div>
        </div>

        {showAddProgram && (
          <form onSubmit={handleCreateProgram} className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label htmlFor="prog-activity" className="block text-xs font-medium text-slate-700 mb-1">
                กิจกรรมที่ตรวจติดตาม *
              </label>
              <input
                id="prog-activity"
                type="text"
                required
                value={progActivity}
                onChange={(e) => setProgActivity(e.target.value)}
                placeholder="เช่น กิจกรรมการสอบเทียบเครื่องวัดปริมาตร (หมวด 6.4-6.5)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="prog-type" className="block text-xs font-medium text-slate-700 mb-1">
                ประเภทกิจกรรม
              </label>
              <select
                id="prog-type"
                value={progType}
                onChange={(e) => setProgType(e.target.value as ActivityType)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
              >
                <option value="testing">กิจกรรมการทดสอบ (Testing)</option>
                <option value="calibration">กิจกรรมการสอบเทียบ (Calibration)</option>
                <option value="management">ระบบบริหารงานคุณภาพ</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="prog-remarks" className="block text-xs font-medium text-slate-700 mb-1">
                หมายเหตุ
              </label>
              <input
                id="prog-remarks"
                type="text"
                value={progRemarks}
                onChange={(e) => setProgRemarks(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800">
                บันทึก
              </button>
              <button
                type="button"
                onClick={() => setShowAddProgram(false)}
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <th className="py-3 px-4 w-12 text-center">ลำดับ</th>
                <th className="py-3 px-4 min-w-[260px]">กิจกรรม</th>
                {THAI_MONTHS_SHORT.map((m) => (
                  <th key={m} className="py-3 px-1.5 text-center w-10 font-mono-tabular">
                    {m}
                  </th>
                ))}
                <th className="py-3 px-4 min-w-[160px]">หมายเหตุ & สถานะอนุมัติ</th>
                {(canEditProgram || canAdminDelete) && (
                  <th className="py-3 px-3 text-right w-28">จัดการ</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {yearPrograms.length === 0 ? (
                <tr>
                  <td colSpan={(canEditProgram || canAdminDelete) ? 17 : 16} className="py-10 px-6 text-center space-y-3">
                    <div className="text-sm font-semibold text-slate-800">
                      ยังไม่มีโปรแกรมการตรวจติดตามคุณภาพภายในสำหรับปี พ.ศ. {selectedYearBE}
                    </div>
                    <p className="text-xs text-slate-500">
                      เริ่มต้นแผนประจำปีใหม่ได้ทันทีจากเทมเพลตมาตรฐาน ISO/IEC 17025 คัดลอกจากปีก่อน หรือเพิ่มกิจกรรมทีละรายการ
                    </p>
                    {canEditProgram && (
                      <div className="pt-1 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openNewAnnualPlanModal(selectedYearBE)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          สร้างแผนตรวจประจำปี พ.ศ. {selectedYearBE}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                yearPrograms.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-center font-mono-tabular text-slate-700">{item.sequence}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{item.activity}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ACTIVITY_TYPE_LABELS[item.activityType]} · จัดทำโดย {item.preparedBy}
                      </div>
                    </td>
                    {item.months.map((checked, idx) => (
                      <td key={idx} className="py-3 px-1.5 text-center">
                        <button
                          type="button"
                          disabled={!canEditProgram}
                          aria-label={`สลับเดือน ${THAI_MONTHS_SHORT[idx]} สำหรับ ${item.activity}`}
                          onClick={() => onToggleProgramMonth(item.id, idx)}
                          className={`w-7 h-7 rounded inline-flex items-center justify-center transition-colors ${
                            checked
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                          } disabled:cursor-not-allowed`}
                        >
                          {checked && <Check className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    ))}
                    <td className="py-3 px-4">
                      <div className="text-slate-600">{item.remarks || '-'}</div>
                      <div className="mt-1 flex items-center gap-2">
                        {item.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            อนุมัติแล้ว ({item.approvedBy})
                          </span>
                        ) : (
                          <>
                            <span className="text-amber-700 font-medium">รออนุมัติ</span>
                            {canApproveProgram && (
                              <button
                                type="button"
                                onClick={() => onApproveProgram(item.id)}
                                className="px-2 py-0.5 text-[11px] font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
                              >
                                อนุมัติแผน
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    {(canEditProgram || canAdminDelete) && (
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canEditProgram && (
                            <button
                              type="button"
                              onClick={() => setEditingProgram({ ...item, months: [...item.months] })}
                              aria-label={`แก้ไขกิจกรรม ${item.activity}`}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canAdminDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ type: 'program', item })}
                              aria-label={`ลบกิจกรรม ${item.activity}`}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* FM-LB-022 Internal Audit Schedule */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              FM-LB-022: แผนกำหนดการตรวจติดตามคุณภาพภายใน ปี พ.ศ. {selectedYearBE} (แจ้งล่วงหน้า ≥ 1 เดือน)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ระบุวัน-เวลา กิจกรรม เกณฑ์การตรวจประเมิน ผู้ตรวจติดตาม (อิสระจากงานที่ตรวจ) และผู้ถูกตรวจ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportScheduleCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            {canEditSchedule && (
              <button
                type="button"
                onClick={() => setShowAddSchedule((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่มกำหนดการ
              </button>
            )}
          </div>
        </div>

        {showAddSchedule && (
          <form onSubmit={handleCreateSchedule} className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-2">
              <label htmlFor="sch-round" className="block text-xs font-medium text-slate-700 mb-1">ครั้งที่/ปี</label>
              <input id="sch-round" type="text" required value={schRound} onChange={(e) => setSchRound(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md font-mono-tabular" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="sch-date" className="block text-xs font-medium text-slate-700 mb-1">ว/ด/ป *</label>
              <input id="sch-date" type="date" required value={schDate} onChange={(e) => setSchDate(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="sch-time" className="block text-xs font-medium text-slate-700 mb-1">เวลา (น.)</label>
              <input id="sch-time" type="text" required value={schTime} onChange={(e) => setSchTime(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-6">
              <label htmlFor="sch-activity" className="block text-xs font-medium text-slate-700 mb-1">กิจกรรมที่ตรวจประเมิน *</label>
              <input id="sch-activity" type="text" required value={schActivity} onChange={(e) => setSchActivity(e.target.value)} placeholder="เช่น ตรวจพยานการสอบเทียบเครื่องวัดอุณหภูมิ" className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="sch-type" className="block text-xs font-medium text-slate-700 mb-1">ขอบเขตกิจกรรม</label>
              <select id="sch-type" value={schType} onChange={(e) => setSchType(e.target.value as ActivityType)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md">
                <option value="testing">Testing</option>
                <option value="calibration">Calibration</option>
                <option value="management">Management</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <label htmlFor="sch-criteria" className="block text-xs font-medium text-slate-700 mb-1">เกณฑ์การตรวจประเมิน (Audit criteria)</label>
              <input id="sch-criteria" type="text" required value={schCriteria} onChange={(e) => setSchCriteria(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="sch-auditor" className="block text-xs font-medium text-slate-700 mb-1">ผู้ตรวจ</label>
              <input id="sch-auditor" type="text" required value={schAuditor} onChange={(e) => setSchAuditor(e.target.value)} placeholder="ชื่อผู้ตรวจติดตาม" className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="sch-auditee" className="block text-xs font-medium text-slate-700 mb-1">ผู้ถูกตรวจ</label>
              <div className="flex gap-2">
                <input id="sch-auditee" type="text" required value={schAuditee} onChange={(e) => setSchAuditee(e.target.value)} placeholder="ชื่อผู้ถูกตรวจ" className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md" />
                <button type="submit" className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 shrink-0">
                  เพิ่ม
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <th className="py-3 px-4">ครั้งที่</th>
                <th className="py-3 px-4">ว/ด/ป · เวลา (น.)</th>
                <th className="py-3 px-4">กิจกรรม</th>
                <th className="py-3 px-4">เกณฑ์การตรวจประเมิน</th>
                <th className="py-3 px-4">ผู้ตรวจ / ผู้ถูกตรวจ</th>
                <th className="py-3 px-4">สถานะ</th>
                {(canEditSchedule || canAdminDelete) && (
                  <th className="py-3 px-3 text-right w-28">จัดการ</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {yearSchedules.length === 0 ? (
                <tr>
                  <td colSpan={(canEditSchedule || canAdminDelete) ? 7 : 6} className="py-10 px-6 text-center text-slate-500">
                    ยังไม่มีแผนกำหนดการตรวจติดตาม (FM-LB-022) สำหรับปี พ.ศ. {selectedYearBE}
                  </td>
                </tr>
              ) : (
                yearSchedules.map((sch) => (
                  <tr key={sch.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-tabular font-medium text-slate-900">{sch.auditRound}</td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      <div>{sch.auditDate}</div>
                      <div className="text-[11px] text-slate-500">{sch.timeRange}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{sch.activity}</div>
                      <div className="text-[11px] text-slate-500">{ACTIVITY_TYPE_LABELS[sch.activityType]}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{sch.criteria}</td>
                    <td className="py-3 px-4">
                      <div className="text-slate-900">ผู้ตรวจ: {sch.auditorName}</div>
                      <div className="text-slate-500">ผู้ถูกตรวจ: {sch.auditeeName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`สถานะกำหนดการ ${sch.activity}`}
                        disabled={!canConductAudit}
                        value={sch.status}
                        onChange={(e) => onUpdateScheduleStatus(sch.id, e.target.value as AuditScheduleItem['status'])}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium text-slate-800 disabled:bg-slate-100"
                      >
                        <option value="planned">วางแผนแล้ว (Planned)</option>
                        <option value="in_progress">กำลังตรวจ (In Progress)</option>
                        <option value="completed">ตรวจเสร็จสิ้น (Completed)</option>
                        <option value="rescheduled">ขอเลื่อนแผน (PD-LB-021 7.2.1)</option>
                      </select>
                    </td>
                    {(canEditSchedule || canAdminDelete) && (
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canEditSchedule && (
                            <button
                              type="button"
                              onClick={() => setEditingSchedule({ ...sch })}
                              aria-label={`แก้ไขกำหนดการ ${sch.activity}`}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canAdminDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ type: 'schedule', item: sch })}
                              aria-label={`ลบกำหนดการ ${sch.activity}`}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Start New Annual Audit Plan Modal */}
      {showNewPlanModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-annual-plan-title"
        >
          <form
            onSubmit={handleSubmitNewAnnualPlan}
            className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 id="new-annual-plan-title" className="text-base font-bold text-slate-900">
                  เริ่มแผนการตรวจติดตามคุณภาพภายในประจำปีใหม่
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  สร้างโปรแกรมประจำปี (FM-LB-023) และกำหนดการตรวจรอบที่ 1 (FM-LB-022) ตามข้อกำหนด PD-LB-021 ข้อ 7.1–7.2
                </p>
              </div>
              <button type="button" onClick={() => setShowNewPlanModal(false)} aria-label="ปิดหน้าต่าง" className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-plan-year" className="block text-xs font-semibold text-slate-700 mb-1">
                  ปีงบประมาณแผนตรวจ (พ.ศ.) *
                </label>
                <input
                  id="new-plan-year"
                  type="number"
                  min={2560}
                  max={2700}
                  required
                  value={planYearBE}
                  onChange={(e) => handlePlanYearChange(Number(e.target.value) || currentYearBE)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular font-bold"
                />
              </div>
              {planMode === 'copy' && yearsWithPrograms.length > 0 && (
                <div>
                  <label htmlFor="new-plan-source" className="block text-xs font-semibold text-slate-700 mb-1">
                    คัดลอกรายการกิจกรรมจากปี พ.ศ.
                  </label>
                  <select
                    id="new-plan-source"
                    value={planSourceYear}
                    onChange={(e) => setPlanSourceYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                  >
                    {yearsWithPrograms.map((y) => (
                      <option key={y} value={y}>ปี พ.ศ. {y}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">รูปแบบการตั้งต้นโปรแกรม (FM-LB-023)</div>
              <div className="grid grid-cols-1 gap-2">
                <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer ${planMode === 'standard' ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="plan-mode"
                    checked={planMode === 'standard'}
                    onChange={() => setPlanMode('standard')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">เทมเพลตมาตรฐาน ISO/IEC 17025 (แนะนำ)</div>
                    <div className="text-[11px] text-slate-500">สร้าง 5 กิจกรรมหลักครอบคลุม Testing, Calibration, สิ่งแวดล้อม และ QMS หมวด 4–8 (สถานะรออนุมัติ)</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-md border ${yearsWithPrograms.length === 0 ? 'opacity-50 cursor-not-allowed border-slate-200' : planMode === 'copy' ? 'border-slate-900 bg-slate-50 cursor-pointer' : 'border-slate-200 cursor-pointer'}`}>
                  <input
                    type="radio"
                    name="plan-mode"
                    disabled={yearsWithPrograms.length === 0}
                    checked={planMode === 'copy'}
                    onChange={() => setPlanMode('copy')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">คัดลอกจากแผนปีก่อนหน้า</div>
                    <div className="text-[11px] text-slate-500">
                      {yearsWithPrograms.length === 0
                        ? 'ยังไม่มีข้อมูลปีก่อนหน้าให้คัดลอก'
                        : 'สำเนากิจกรรมและเดือนตรวจจากปีที่เลือก พร้อมรีเซ็ตสถานะเป็นรออนุมัติ'}
                    </div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer ${planMode === 'blank' ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="plan-mode"
                    checked={planMode === 'blank'}
                    onChange={() => setPlanMode('blank')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">เปิดแผนปีใหม่แบบว่างเปล่า</div>
                    <div className="text-[11px] text-slate-500">เปิดปี พ.ศ. {planYearBE} เพื่อเพิ่มกิจกรรมเองทีละรายการ</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planCreateSchedule}
                  onChange={(e) => setPlanCreateSchedule(e.target.checked)}
                />
                สร้างกำหนดการตรวจติดตามรอบที่ 1 (FM-LB-022) พร้อมกัน (4 ช่วงเวลา / 2 วันตรวจ)
              </label>

              {planCreateSchedule && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-md p-3.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">ครั้งที่ตรวจรอบแรก</label>
                    <input
                      type="text"
                      required
                      value={planRound}
                      onChange={(e) => setPlanRound(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">วันที่เริ่มตรวจ (แจ้งล่วงหน้า ≥ 1 เดือน)</label>
                    <input
                      type="date"
                      required
                      value={planStartDate}
                      onChange={(e) => setPlanStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">หัวหน้าทีมผู้ตรวจติดตาม</label>
                    <input
                      type="text"
                      required
                      value={planAuditor}
                      onChange={(e) => setPlanAuditor(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">ตัวแทนผู้ถูกตรวจ</label>
                    <input
                      type="text"
                      required
                      value={planAuditee}
                      onChange={(e) => setPlanAuditee(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>
              )}
            </div>

            {targetYearHasData && (
              <label className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planReplaceExisting}
                  onChange={(e) => setPlanReplaceExisting(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  ปี พ.ศ. {planYearBE} มีรายการแผนเดิมอยู่แล้ว — ติ๊กเพื่อลบแผนเดิมของปี {planYearBE} และสร้างใหม่ทั้งหมด (หากไม่ติ๊กจะเพิ่มต่อท้าย)
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowNewPlanModal(false)}
                className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
              >
                ยืนยันเริ่มแผนประจำปี พ.ศ. {planYearBE}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit FM-LB-023 Program Modal */}
      {editingProgram && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-prog-title">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingProgram.activity.trim()) return;
              onUpdateProgram(editingProgram.id, {
                sequence: editingProgram.sequence,
                activity: editingProgram.activity.trim(),
                activityType: editingProgram.activityType,
                remarks: editingProgram.remarks ?? '',
                status: editingProgram.status,
              });
              setEditingProgram(null);
            }}
            className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 id="edit-prog-title" className="text-base font-bold text-slate-900">
                แก้ไขโปรแกรมตรวจติดตาม (FM-LB-023)
              </h3>
              <button type="button" onClick={() => setEditingProgram(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ลำดับที่</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editingProgram.sequence}
                  onChange={(e) => setEditingProgram({ ...editingProgram, sequence: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">ประเภทกิจกรรม</label>
                <select
                  value={editingProgram.activityType}
                  onChange={(e) => setEditingProgram({ ...editingProgram, activityType: e.target.value as ActivityType })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                >
                  <option value="testing">กิจกรรมการทดสอบ (Testing)</option>
                  <option value="calibration">กิจกรรมการสอบเทียบ (Calibration)</option>
                  <option value="management">ระบบบริหารงานคุณภาพ</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อกิจกรรม *</label>
              <input
                type="text"
                required
                value={editingProgram.activity}
                onChange={(e) => setEditingProgram({ ...editingProgram, activity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  value={editingProgram.remarks ?? ''}
                  onChange={(e) => setEditingProgram({ ...editingProgram, remarks: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">สถานะแผน</label>
                <select
                  value={editingProgram.status}
                  onChange={(e) => setEditingProgram({ ...editingProgram, status: e.target.value as 'draft' | 'approved' })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                >
                  <option value="draft">รออนุมัติ (Draft)</option>
                  <option value="approved">อนุมัติแล้ว (Approved)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingProgram(null)} className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md">
                ยกเลิก
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800">
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit FM-LB-022 Schedule Modal */}
      {editingSchedule && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-sch-title">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingSchedule.activity.trim()) return;
              onUpdateSchedule(editingSchedule.id, {
                auditRound: editingSchedule.auditRound.trim(),
                auditDate: editingSchedule.auditDate,
                timeRange: editingSchedule.timeRange.trim(),
                activity: editingSchedule.activity.trim(),
                activityType: editingSchedule.activityType,
                criteria: editingSchedule.criteria.trim(),
                auditorName: editingSchedule.auditorName.trim(),
                auditeeName: editingSchedule.auditeeName.trim(),
                status: editingSchedule.status,
              });
              setEditingSchedule(null);
            }}
            className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 id="edit-sch-title" className="text-base font-bold text-slate-900">
                แก้ไขแผนกำหนดการตรวจติดตาม (FM-LB-022)
              </h3>
              <button type="button" onClick={() => setEditingSchedule(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ครั้งที่/ปี</label>
                <input
                  type="text"
                  required
                  value={editingSchedule.auditRound}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, auditRound: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ว/ด/ป</label>
                <input
                  type="date"
                  required
                  value={editingSchedule.auditDate}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, auditDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">เวลา (น.)</label>
                <input
                  type="text"
                  required
                  value={editingSchedule.timeRange}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, timeRange: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">กิจกรรม *</label>
                <input
                  type="text"
                  required
                  value={editingSchedule.activity}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, activity: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ขอบเขต</label>
                <select
                  value={editingSchedule.activityType}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, activityType: e.target.value as ActivityType })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                >
                  <option value="testing">Testing</option>
                  <option value="calibration">Calibration</option>
                  <option value="management">Management</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">เกณฑ์การตรวจประเมิน</label>
              <input
                type="text"
                required
                value={editingSchedule.criteria}
                onChange={(e) => setEditingSchedule({ ...editingSchedule, criteria: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ผู้ตรวจติดตาม</label>
                <input
                  type="text"
                  required
                  value={editingSchedule.auditorName}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, auditorName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ผู้ถูกตรวจ</label>
                <input
                  type="text"
                  required
                  value={editingSchedule.auditeeName}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, auditeeName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">สถานะ</label>
                <select
                  value={editingSchedule.status}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, status: e.target.value as AuditScheduleItem['status'] })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                >
                  <option value="planned">วางแผนแล้ว</option>
                  <option value="in_progress">กำลังตรวจ</option>
                  <option value="completed">ตรวจเสร็จสิ้น</option>
                  <option value="rescheduled">ขอเลื่อนแผน</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingSchedule(null)} className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md">
                ยกเลิก
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800">
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteConfirm)}
        title={deleteConfirm?.type === 'program' ? 'ยืนยันการลบรายการใน FM-LB-023' : 'ยืนยันการลบกำหนดการใน FM-LB-022'}
        itemLabel={deleteConfirm ? deleteConfirm.item.activity : ''}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (!deleteConfirm) return;
          if (deleteConfirm.type === 'program') {
            onDeleteProgram(deleteConfirm.item.id);
          } else {
            onDeleteSchedule(deleteConfirm.item.id);
          }
          setDeleteConfirm(null);
        }}
      />
    </div>
  );
};
