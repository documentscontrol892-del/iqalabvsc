import React, { useEffect, useMemo, useState } from 'react';
import { Download, FilePlus2, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityType,
  AUDIT_METHOD_LABELS,
  AuditChecklistItem,
  AuditMethod,
  AuditScheduleItem,
  FindingResult,
  FM_LB_025_CLAUSES,
  UserProfile,
} from '../types/iso17025';
import {
  aggregateFmLb025Summary,
  canPerformAction,
  exportToCsvWithBom,
  getCurrentBuddhistYear,
  parseRoundYearBE,
} from '../utils/isoRules';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface AuditExecutionViewProps {
  checklists: AuditChecklistItem[];
  schedules?: AuditScheduleItem[];
  currentUser: UserProfile;
  onAddChecklistItem: (
    input: Omit<AuditChecklistItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<AuditChecklistItem>;
  onUpdateChecklistResult: (
    checklistId: string,
    result: FindingResult,
    detail?: string,
    linkedDocNo?: string
  ) => void;
  onUpdateChecklistItem: (
    checklistId: string,
    patch: Partial<
      Pick<
        AuditChecklistItem,
        'auditRound' | 'department' | 'activity' | 'activityType' | 'auditMethod' | 'auditDate' | 'clause' | 'checkItem' | 'result' | 'detail' | 'auditeeName' | 'linkedDocNo'
      >
    >
  ) => void;
  onDeleteChecklistItem: (checklistId: string) => void;
  onIssueCarFromChecklist: (item: AuditChecklistItem, type: 'CAR' | 'NC') => void;
  onIssueParFromChecklist: (item: AuditChecklistItem) => void;
  onOpenPrintModal: (formCode: 'FM-LB-024' | 'FM-LB-025', auditRound?: string) => void;
}

export const AuditExecutionView: React.FC<AuditExecutionViewProps> = ({
  checklists,
  schedules = [],
  currentUser,
  onAddChecklistItem,
  onUpdateChecklistResult,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
  onIssueCarFromChecklist,
  onIssueParFromChecklist,
  onOpenPrintModal,
}) => {
  const defaultRoundFallback = `1/${getCurrentBuddhistYear()}`;
  const availableRounds = useMemo(() => {
    const rounds = Array.from(
      new Set([
        ...checklists.map((c) => c.auditRound),
        ...schedules.map((s) => s.auditRound),
      ].filter(Boolean))
    ).sort().reverse();
    return rounds;
  }, [checklists, schedules]);

  const [subTab, setSubTab] = useState<'fm024' | 'fm025'>('fm024');
  const [roundFilter, setRoundFilter] = useState<string>(() => availableRounds[0] ?? 'ALL');
  const [activityFilter, setActivityFilter] = useState<'all' | ActivityType>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AuditChecklistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditChecklistItem | null>(null);

  useEffect(() => {
    if (roundFilter !== 'ALL' && !availableRounds.includes(roundFilter)) {
      setRoundFilter(availableRounds[0] ?? 'ALL');
    }
  }, [availableRounds, roundFilter]);

  // Add checklist item form
  const [addRound, setAddRound] = useState<string>(() => availableRounds[0] ?? defaultRoundFallback);
  const [dept, setDept] = useState('ห้องปฏิบัติการทดสอบ (Testing Lab)');
  const [activity, setActivity] = useState('การทดสอบและประกันคุณภาพผลการทดสอบ');
  const [actType, setActType] = useState<ActivityType>('testing');
  const [method, setMethod] = useState<AuditMethod>('vertical');
  const [clause, setClause] = useState('6.4');
  const [checkItem, setCheckItem] = useState('');
  const [result, setResult] = useState<FindingResult>('C');
  const [detail, setDetail] = useState('');
  const [auditeeName, setAuditeeName] = useState('');

  useEffect(() => {
    if (roundFilter !== 'ALL') {
      setAddRound(roundFilter);
    } else if (availableRounds[0]) {
      setAddRound(availableRounds[0]);
    } else {
      setAddRound(defaultRoundFallback);
    }
  }, [roundFilter, availableRounds, defaultRoundFallback]);

  const canConduct = canPerformAction(currentUser.role, 'conduct_audit');
  const canIssueDoc = canPerformAction(currentUser.role, 'issue_car_par');
  const canAdminEdit = canPerformAction(currentUser.role, 'edit_any_record');
  const canAdminDelete = canPerformAction(currentUser.role, 'delete_any_record');

  const filteredChecklists = useMemo(() => {
    return checklists.filter((c) => {
      if (roundFilter !== 'ALL' && c.auditRound !== roundFilter) return false;
      if (activityFilter !== 'all' && c.activityType !== activityFilter) return false;
      return true;
    });
  }, [checklists, roundFilter, activityFilter]);

  const summary025 = useMemo(
    () => aggregateFmLb025Summary(checklists, roundFilter),
    [checklists, roundFilter]
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkItem.trim()) return;
    const targetRound = addRound.trim() || defaultRoundFallback;
    await onAddChecklistItem({
      auditRound: targetRound,
      yearBE: parseRoundYearBE(targetRound),
      department: dept.trim(),
      activity: activity.trim(),
      activityType: actType,
      auditMethod: method,
      auditDate: new Date().toISOString().slice(0, 10),
      sequence: checklists.filter((c) => c.auditRound === targetRound).length + 1,
      clause,
      checkItem: checkItem.trim(),
      result,
      detail: detail.trim(),
      auditorName: currentUser.displayName,
      auditeeName: auditeeName.trim() || 'ผู้รับการตรวจติดตาม',
    });
    setRoundFilter(targetRound);
    setCheckItem('');
    setDetail('');
    setShowAddModal(false);
  };

  const handleExportFm025Csv = () => {
    exportToCsvWithBom(
      `FM-LB-025_Summary_${roundFilter}.csv`,
      ['ข้อกำหนด ISO/IEC 17025', 'C (สอดคล้อง)', 'CAR', 'NC', 'OB (PAR)', 'หมายเหตุ'],
      [
        ...summary025.rows.map((r) => [
          r.titleTh,
          r.isHeader ? '' : r.cCount,
          r.isHeader ? '' : r.carCount,
          r.isHeader ? '' : r.ncCount,
          r.isHeader ? '' : r.obCount,
          r.remarks,
        ]),
        ['รวมทั้งหมด', summary025.totalC, summary025.totalCar, summary025.totalNc, summary025.totalOb, ''],
      ]
    );
  };

  const handleExportFm024Csv = () => {
    exportToCsvWithBom(
      `FM-LB-024_Checklist_${roundFilter}.csv`,
      ['ครั้งที่', 'หน่วยงาน', 'กิจกรรม', 'วิธีการตรวจ', 'ข้อกำหนด', 'รายการตรวจติดตาม', 'ผล (C/CAR/NC/OB)', 'รายละเอียด', 'เอกสารอ้างอิง'],
      filteredChecklists.map((c) => [
        c.auditRound,
        c.department,
        c.activity,
        AUDIT_METHOD_LABELS[c.auditMethod],
        c.clause,
        c.checkItem,
        c.result,
        c.detail ?? '',
        c.linkedDocNo ?? '',
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-mono-tabular">PD-LB-021 ข้อ 7.3 – 7.4 · FM-LB-024 Rev.01 · FM-LB-025 Rev.01</div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            การตรวจประเมินคุณภาพภายในและสรุปรายงานแบบเรียลไทม์
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setSubTab('fm024')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                subTab === 'fm024' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              FM-LB-024 รายการตรวจติดตาม
            </button>
            <button
              type="button"
              onClick={() => setSubTab('fm025')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                subTab === 'fm025' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              FM-LB-025 สรุปรายงาน (Real-time)
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="audit-round-filter" className="text-xs font-medium text-slate-600">
              ครั้งที่ตรวจติดตาม:
            </label>
            <select
              id="audit-round-filter"
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono-tabular bg-white border border-slate-300 rounded-md font-medium"
            >
              <option value="ALL">ทุกรอบการตรวจ (All Cycles)</option>
              {availableRounds.map((r) => (
                <option key={r} value={r}>ครั้งที่ {r}</option>
              ))}
            </select>
          </div>

          {subTab === 'fm024' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(['all', 'testing', 'calibration', 'management'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivityFilter(t)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    activityFilter === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'all' ? 'ทั้งหมด' : t === 'testing' ? 'Testing' : t === 'calibration' ? 'Calibration' : 'Management'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={subTab === 'fm024' ? handleExportFm024Csv : handleExportFm025Csv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            ส่งออก CSV
          </button>
          <button
            type="button"
            onClick={() => onOpenPrintModal(subTab === 'fm024' ? 'FM-LB-024' : 'FM-LB-025', roundFilter)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์แบบฟอร์ม {subTab === 'fm024' ? 'FM-LB-024' : 'FM-LB-025'}
          </button>
          {subTab === 'fm024' && canConduct && (
            <button
              type="button"
              onClick={() => setShowAddModal((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              บันทึกรายการตรวจประเมิน
            </button>
          )}
        </div>
      </div>

      {/* Add Checklist Item Form */}
      {subTab === 'fm024' && showAddModal && (
        <form onSubmit={handleAddSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">บันทึกรายการตรวจติดตามคุณภาพภายใน (FM-LB-024)</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label htmlFor="chk-round" className="block text-xs font-medium text-slate-700 mb-1">ครั้งที่ตรวจติดตาม (เช่น {defaultRoundFallback})</label>
              <input id="chk-round" type="text" required value={addRound} onChange={(e) => setAddRound(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
            </div>
            <div>
              <label htmlFor="chk-dept" className="block text-xs font-medium text-slate-700 mb-1">ฝ่าย/หน่วยงานที่ถูกตรวจ</label>
              <input id="chk-dept" type="text" required value={dept} onChange={(e) => setDept(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
            </div>
            <div>
              <label htmlFor="chk-acttype" className="block text-xs font-medium text-slate-700 mb-1">ขอบเขตกิจกรรม</label>
              <select id="chk-acttype" value={actType} onChange={(e) => setActType(e.target.value as ActivityType)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                <option value="testing">กิจกรรมการทดสอบ (Testing)</option>
                <option value="calibration">กิจกรรมการสอบเทียบ (Calibration)</option>
                <option value="management">ระบบบริหารงานคุณภาพ</option>
              </select>
            </div>
            <div>
              <label htmlFor="chk-method" className="block text-xs font-medium text-slate-700 mb-1">วิธีการตรวจ (PD-LB-021 ข้อ 4.4-4.6)</label>
              <select id="chk-method" value={method} onChange={(e) => setMethod(e.target.value as AuditMethod)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                <option value="horizontal">Horizontal audit (ตรวจตามเอกสาร)</option>
                <option value="vertical">Vertical audit (สุ่มบันทึกเชื่อมโยง)</option>
                <option value="witness">Witness audit (เฝ้าดูการปฏิบัติงาน)</option>
              </select>
            </div>
            <div>
              <label htmlFor="chk-clause" className="block text-xs font-medium text-slate-700 mb-1">ข้อกำหนด ISO/IEC 17025</label>
              <select id="chk-clause" value={clause} onChange={(e) => setClause(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular">
                {FM_LB_025_CLAUSES.filter((c) => !c.isHeader).map((c) => (
                  <option key={c.clause} value={c.clause}>{c.titleTh}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label htmlFor="chk-activity-name" className="block text-xs font-medium text-slate-700 mb-1">กิจกรรมที่ตรวจติดตาม</label>
              <input id="chk-activity-name" type="text" required value={activity} onChange={(e) => setActivity(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-5">
              <label htmlFor="chk-item-text" className="block text-xs font-medium text-slate-700 mb-1">รายการตรวจติดตาม (Audit Check Item) *</label>
              <input id="chk-item-text" type="text" required value={checkItem} onChange={(e) => setCheckItem(e.target.value)} placeholder="เช่น ตรวจสอบใบรับรองสอบเทียบและการประเมิน Uncertainty" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="chk-result" className="block text-xs font-medium text-slate-700 mb-1">ผลการตรวจ</label>
              <select id="chk-result" value={result} onChange={(e) => setResult(e.target.value as FindingResult)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-semibold">
                <option value="C">C (สอดคล้อง)</option>
                <option value="CAR">CAR (ไม่กระทบผลทดสอบ)</option>
                <option value="NC">NC (กระทบผลทดสอบ)</option>
                <option value="OB">OB (ข้อสังเกต → PAR)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-8">
              <label htmlFor="chk-detail" className="block text-xs font-medium text-slate-700 mb-1">รายละเอียดผลการตรวจติดตาม / หลักฐานที่พบ</label>
              <input id="chk-detail" type="text" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="ระบุหลักฐานที่ตรวจพบ เช่น เลขที่บันทึก รหัสเครื่องมือ" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-4 flex gap-2">
              <div className="flex-1">
                <label htmlFor="chk-auditee" className="block text-xs font-medium text-slate-700 mb-1">ผู้ถูกตรวจติดตาม</label>
                <input id="chk-auditee" type="text" required value={auditeeName} onChange={(e) => setAuditeeName(e.target.value)} placeholder="ระบุชื่อผู้ถูกตรวจ" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <button type="submit" className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 h-[38px]">
                บันทึกผล
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Subtab 1: FM-LB-024 Table */}
      {subTab === 'fm024' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <th className="py-3 px-4 w-20">ข้อกำหนด</th>
                  <th className="py-3 px-4 min-w-[200px]">หน่วยงาน · กิจกรรม</th>
                  <th className="py-3 px-4 min-w-[240px]">รายการตรวจติดตาม</th>
                  <th className="py-3 px-4 w-36">ผลการตรวจ</th>
                  <th className="py-3 px-4 min-w-[240px]">รายละเอียดผลการตรวจติดตาม</th>
                  <th className="py-3 px-4 w-44">การเชื่อมโยง CAR / PAR</th>
                  {(canAdminEdit || canAdminDelete) && (
                    <th className="py-3 px-3 text-right w-24">จัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredChecklists.length === 0 ? (
                  <tr>
                    <td colSpan={(canAdminEdit || canAdminDelete) ? 7 : 6} className="py-10 px-6 text-center text-slate-500">
                      ยังไม่มีรายการตรวจประเมิน (FM-LB-024) ในรอบการตรวจที่เลือก กด "บันทึกรายการตรวจประเมิน" เพื่อเริ่มต้นบันทึกผล
                    </td>
                  </tr>
                ) : (
                  filteredChecklists.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono-tabular font-semibold text-slate-900">
                      {item.clause}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{item.department}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ACTIVITY_TYPE_LABELS[item.activityType]} · {AUDIT_METHOD_LABELS[item.auditMethod]}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800">{item.checkItem}</td>
                    <td className="py-3.5 px-4">
                      <select
                        aria-label={`ผลการตรวจข้อกำหนด ${item.clause}`}
                        disabled={!canConduct}
                        value={item.result}
                        onChange={(e) => onUpdateChecklistResult(item.id, e.target.value as FindingResult)}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded border ${
                          item.result === 'C'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : item.result === 'NC'
                              ? 'bg-red-50 border-red-200 text-red-800'
                              : item.result === 'CAR'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-slate-100 border-slate-300 text-slate-800'
                        }`}
                      >
                        <option value="C">C · สอดคล้อง</option>
                        <option value="CAR">CAR · ไม่กระทบผล</option>
                        <option value="NC">NC · กระทบผลทดสอบ</option>
                        <option value="OB">OB · ข้อสังเกต</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 leading-relaxed">{item.detail || '-'}</td>
                    <td className="py-3.5 px-4">
                      {item.linkedDocNo ? (
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          {item.linkedDocNo}
                        </span>
                      ) : item.result === 'C' ? (
                        <span className="text-slate-400">สอดคล้อง</span>
                      ) : canIssueDoc ? (
                        <button
                          type="button"
                          onClick={() =>
                            item.result === 'OB'
                              ? onIssueParFromChecklist(item)
                              : onIssueCarFromChecklist(item, item.result as 'CAR' | 'NC')
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 whitespace-nowrap"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" />
                          {item.result === 'OB' ? 'ออกใบ PAR' : `ออกใบ ${item.result}`}
                        </button>
                      ) : (
                        <span className="text-slate-400">รอออกเอกสาร</span>
                      )}
                    </td>
                    {(canAdminEdit || canAdminDelete) && (
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canAdminEdit && (
                            <button
                              type="button"
                              onClick={() => setEditingItem({ ...item })}
                              aria-label={`แก้ไขรายการตรวจข้อ ${item.clause}`}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canAdminDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              aria-label={`ลบรายการตรวจข้อ ${item.clause}`}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Subtab 2: FM-LB-025 Real-time Auto-Aggregated Summary */}
      {subTab === 'fm025' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                FM-LB-025: สรุปรายงานการตรวจติดตามคุณภาพภายใน (คำนวณแบบเรียลไทม์จาก FM-LB-024)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                รอบการตรวจติดตาม: {roundFilter === 'ALL' ? 'ทุกรอบ' : `ครั้งที่ ${roundFilter}`} · ตอบแนวทางการแก้ไขภายใน 7 วันทำการ (ขยายได้ 2 ครั้ง รวมไม่เกิน 30 วันทำการ)
              </p>
            </div>
            <div className="text-xs font-mono-tabular text-slate-700">
              รวม C: <strong>{summary025.totalC}</strong> · CAR: <strong className="text-amber-700">{summary025.totalCar}</strong> · NC: <strong className="text-red-700">{summary025.totalNc}</strong> · OB: <strong>{summary025.totalOb}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <th className="py-3 px-4">ข้อกำหนด ISO/IEC 17025</th>
                  <th className="py-3 px-4 w-24 text-center">C (สอดคล้อง)</th>
                  <th className="py-3 px-4 w-24 text-center">CAR</th>
                  <th className="py-3 px-4 w-24 text-center">NC</th>
                  <th className="py-3 px-4 w-24 text-center">OB (PAR)</th>
                  <th className="py-3 px-4">หมายเหตุ / เลขที่ CAR-PAR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {summary025.rows.map((row) => (
                  <tr
                    key={row.clause}
                    className={row.isHeader ? 'bg-slate-50 font-semibold text-slate-900' : 'hover:bg-slate-50/60'}
                  >
                    <td className={`py-2.5 px-4 ${row.isHeader ? '' : 'pl-8 text-slate-800'}`}>
                      {row.titleTh}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono-tabular text-emerald-700">
                      {row.isHeader ? '' : row.cCount > 0 ? row.cCount : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono-tabular font-semibold text-amber-700">
                      {row.isHeader ? '' : row.carCount > 0 ? row.carCount : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono-tabular font-semibold text-red-700">
                      {row.isHeader ? '' : row.ncCount > 0 ? row.ncCount : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono-tabular font-semibold text-slate-800">
                      {row.isHeader ? '' : row.obCount > 0 ? row.obCount : '-'}
                    </td>
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-600">
                      {row.isHeader ? '' : row.remarks || '-'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-900 text-white font-semibold">
                  <td className="py-3 px-4">รวมทั้งหมด</td>
                  <td className="py-3 px-4 text-center font-mono-tabular">{summary025.totalC}</td>
                  <td className="py-3 px-4 text-center font-mono-tabular">{summary025.totalCar}</td>
                  <td className="py-3 px-4 text-center font-mono-tabular">{summary025.totalNc}</td>
                  <td className="py-3 px-4 text-center font-mono-tabular">{summary025.totalOb}</td>
                  <td className="py-3 px-4 font-mono-tabular">PD-LB-021 Rev.02</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
      {/* Edit FM-LB-024 Checklist Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-chk-title">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingItem.checkItem.trim()) return;
              onUpdateChecklistItem(editingItem.id, {
                auditRound: editingItem.auditRound.trim(),
                department: editingItem.department.trim(),
                activity: editingItem.activity.trim(),
                activityType: editingItem.activityType,
                auditMethod: editingItem.auditMethod,
                clause: editingItem.clause,
                checkItem: editingItem.checkItem.trim(),
                result: editingItem.result,
                detail: editingItem.detail ?? '',
                auditeeName: editingItem.auditeeName.trim(),
                linkedDocNo: editingItem.linkedDocNo ?? '',
              });
              setEditingItem(null);
            }}
            className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 id="edit-chk-title" className="text-base font-bold text-slate-900">
                แก้ไขรายการตรวจติดตาม (FM-LB-024)
              </h3>
              <button type="button" onClick={() => setEditingItem(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ครั้งที่ตรวจ</label>
                <input
                  type="text"
                  required
                  value={editingItem.auditRound}
                  onChange={(e) => setEditingItem({ ...editingItem, auditRound: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ข้อกำหนด</label>
                <select
                  value={editingItem.clause}
                  onChange={(e) => setEditingItem({ ...editingItem, clause: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                >
                  {FM_LB_025_CLAUSES.filter((c) => !c.isHeader).map((c) => (
                    <option key={c.clause} value={c.clause}>{c.titleTh}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ผลการตรวจ</label>
                <select
                  value={editingItem.result}
                  onChange={(e) => setEditingItem({ ...editingItem, result: e.target.value as FindingResult })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-semibold"
                >
                  <option value="C">C (สอดคล้อง)</option>
                  <option value="CAR">CAR</option>
                  <option value="NC">NC</option>
                  <option value="OB">OB (PAR)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ฝ่าย/หน่วยงาน</label>
                <input
                  type="text"
                  required
                  value={editingItem.department}
                  onChange={(e) => setEditingItem({ ...editingItem, department: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ขอบเขต &amp; วิธีตรวจ</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editingItem.activityType}
                    onChange={(e) => setEditingItem({ ...editingItem, activityType: e.target.value as ActivityType })}
                    className="w-full px-2 py-2 text-xs border border-slate-300 rounded-md"
                  >
                    <option value="testing">Testing</option>
                    <option value="calibration">Calibration</option>
                    <option value="management">Management</option>
                  </select>
                  <select
                    value={editingItem.auditMethod}
                    onChange={(e) => setEditingItem({ ...editingItem, auditMethod: e.target.value as AuditMethod })}
                    className="w-full px-2 py-2 text-xs border border-slate-300 rounded-md"
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                    <option value="witness">Witness</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">รายการตรวจติดตาม *</label>
              <input
                type="text"
                required
                value={editingItem.checkItem}
                onChange={(e) => setEditingItem({ ...editingItem, checkItem: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">รายละเอียดผลการตรวจ / หลักฐาน</label>
              <textarea
                rows={2}
                value={editingItem.detail ?? ''}
                onChange={(e) => setEditingItem({ ...editingItem, detail: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ผู้ถูกตรวจ</label>
                <input
                  type="text"
                  required
                  value={editingItem.auditeeName}
                  onChange={(e) => setEditingItem({ ...editingItem, auditeeName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">เลขที่เอกสารอ้างอิง (CAR/PAR)</label>
                <input
                  type="text"
                  value={editingItem.linkedDocNo ?? ''}
                  onChange={(e) => setEditingItem({ ...editingItem, linkedDocNo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md">
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
        isOpen={Boolean(deleteTarget)}
        title="ยืนยันการลบรายการตรวจประเมิน (FM-LB-024)"
        itemLabel={deleteTarget ? `ข้อ ${deleteTarget.clause}: ${deleteTarget.checkItem}` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteChecklistItem(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
