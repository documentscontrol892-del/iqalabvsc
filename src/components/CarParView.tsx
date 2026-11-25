import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Pencil, Plus, Printer, ShieldAlert, Trash2, X } from 'lucide-react';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityType,
  CarRecord,
  FM_LB_025_CLAUSES,
  ParRecord,
  RecordStatus,
  SOURCE_TYPE_LABELS,
  SourceType,
  UserProfile,
} from '../types/iso17025';
import {
  addBusinessDays,
  calculateRiskMatrix,
  canPerformAction,
  evaluateCarTimeline,
  exportToCsvWithBom,
  getCurrentBuddhistYear,
} from '../utils/isoRules';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface CarParViewProps {
  cars: CarRecord[];
  pars: ParRecord[];
  currentUser: UserProfile;
  onCreateCar: (input: {
    recordType: 'CAR' | 'NC';
    sourceType: SourceType;
    sourceRef?: string;
    part1Detail: string;
    clause: string;
    activityType: ActivityType;
    finderName: string;
    foundDate: string;
    responsiblePerson?: string;
  }) => void;
  onRespondCarPart2: (
    carId: string,
    payload: {
      expansionHasIssue: boolean;
      expansionCause: string;
      rootCause: string;
      impactHasEffect: boolean;
      impactDetail: string;
      riskLikelihood: number;
      riskSeverity: number;
      riskScore: number;
      riskFm17Required: boolean;
      correctiveAction: string;
      correctiveDueDate: string;
      preventiveAction: string;
      preventiveDueDate: string;
      responsiblePerson: string;
      extensionCount: number;
    }
  ) => void;
  onVerifyCarPart3: (
    carId: string,
    payload: {
      verificationResult: 'effective' | 'ineffective';
      verificationDetail: string;
      verifierName: string;
      verifyDate: string;
    }
  ) => void;
  onCreatePar: (input: {
    sourceType: SourceType;
    sourceRef?: string;
    clause: string;
    activityType: ActivityType;
    part1Detail: string;
    proposerName: string;
    proposedDate: string;
    responsiblePerson?: string;
  }) => void;
  onRespondParPart2: (
    parId: string,
    payload: {
      preventiveAction: string;
      expectedDueDate: string;
      responsiblePerson: string;
    }
  ) => void;
  onVerifyParPart3: (
    parId: string,
    payload: {
    verificationResult: 'effective' | 'ineffective';
      verificationDetail: string;
    }
  ) => void;
  onUpdateCarItem: (
    carId: string,
    patch: Partial<
      Pick<
        CarRecord,
        'sourceType' | 'sourceRef' | 'clause' | 'activityType' | 'part1Detail' | 'finderName' | 'foundDate' | 'responsiblePerson' | 'status'
      >
    >
  ) => void;
  onDeleteCarItem: (carId: string) => void;
  onUpdateParItem: (
    parId: string,
    patch: Partial<
      Pick<
        ParRecord,
        'sourceType' | 'sourceRef' | 'clause' | 'activityType' | 'part1Detail' | 'proposerName' | 'proposedDate' | 'responsiblePerson' | 'status'
      >
    >
  ) => void;
  onDeleteParItem: (parId: string) => void;
  onOpenPrintModal: (formCode: 'FM-LB-011' | 'FM-LB-012' | 'FM-LB-013' | 'FM-LB-014', docId?: string) => void;
}

export const CarParView: React.FC<CarParViewProps> = ({
  cars,
  pars,
  currentUser,
  onCreateCar,
  onRespondCarPart2,
  onVerifyCarPart3,
  onCreatePar,
  onRespondParPart2,
  onVerifyParPart3,
  onUpdateCarItem,
  onDeleteCarItem,
  onUpdateParItem,
  onDeleteParItem,
  onOpenPrintModal,
}) => {
  const [tab, setTab] = useState<'car_log' | 'par_log'>('car_log');
  const [selectedCarId, setSelectedCarId] = useState<string | null>(cars[0]?.id ?? null);
  const [selectedParId, setSelectedParId] = useState<string | null>(pars[0]?.id ?? null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingCar, setEditingCar] = useState<CarRecord | null>(null);
  const [editingPar, setEditingPar] = useState<ParRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ kind: 'car' | 'par'; id: string; label: string } | null>(null);

  const todayISO = new Date().toISOString().slice(0, 10);
  const defaultDue14 = addBusinessDays(todayISO, 14);
  const defaultRoundRef = `ครั้งที่ 1/${getCurrentBuddhistYear()}`;

  // Create new CAR/NC or PAR state
  const [newType, setNewType] = useState<'CAR' | 'NC' | 'PAR'>('CAR');
  const [newSource, setNewSource] = useState<SourceType>('internal_audit');
  const [newSourceRef, setNewSourceRef] = useState(defaultRoundRef);
  const [newClause, setNewClause] = useState('6.4');
  const [newActType, setNewActType] = useState<ActivityType>('testing');
  const [newDetail, setNewDetail] = useState('');
  const [newResponsible, setNewResponsible] = useState('');

  // Selected CAR Part 2 & Part 3 editor state
  const selectedCar = useMemo(() => cars.find((c) => c.id === selectedCarId) ?? cars[0] ?? null, [cars, selectedCarId]);
  const selectedPar = useMemo(() => pars.find((p) => p.id === selectedParId) ?? pars[0] ?? null, [pars, selectedParId]);

  useEffect(() => {
    if (cars.length === 0) setSelectedCarId(null);
    else if (!cars.some((c) => c.id === selectedCarId)) setSelectedCarId(cars[0].id);
  }, [cars, selectedCarId]);

  useEffect(() => {
    if (pars.length === 0) setSelectedParId(null);
    else if (!pars.some((p) => p.id === selectedParId)) setSelectedParId(pars[0].id);
  }, [pars, selectedParId]);

  const [p2Expansion, setP2Expansion] = useState(false);
  const [p2ExpansionCause, setP2ExpansionCause] = useState('');
  const [p2RootCause, setP2RootCause] = useState('');
  const [p2Impact, setP2Impact] = useState(false);
  const [p2ImpactDetail, setP2ImpactDetail] = useState('');
  const [p2Likelihood, setP2Likelihood] = useState(2);
  const [p2Severity, setP2Severity] = useState(3);
  const [p2Corrective, setP2Corrective] = useState('');
  const [p2CorrectiveDue, setP2CorrectiveDue] = useState(defaultDue14);
  const [p2Preventive, setP2Preventive] = useState('');
  const [p2PreventiveDue, setP2PreventiveDue] = useState(defaultDue14);
  const [p2Responsible, setP2Responsible] = useState('');
  const [p2ExtCount, setP2ExtCount] = useState(0);

  const [p3Result, setP3Result] = useState<'effective' | 'ineffective'>('effective');
  const [p3Detail, setP3Detail] = useState('');

  // PAR Part 2 & 3 editor state
  const [parAction, setParAction] = useState('');
  const [parDue, setParDue] = useState(defaultDue14);
  const [parResp, setParResp] = useState('');
  const [parVerifyRes, setParVerifyRes] = useState<'effective' | 'ineffective'>('effective');
  const [parVerifyDetail, setParVerifyDetail] = useState('');

  const selectCarForEdit = (car: CarRecord) => {
    setSelectedCarId(car.id);
    setP2Expansion(car.expansionHasIssue ?? false);
    setP2ExpansionCause(car.expansionCause ?? '');
    setP2RootCause(car.rootCause ?? '');
    setP2Impact(car.impactHasEffect ?? false);
    setP2ImpactDetail(car.impactDetail ?? '');
    setP2Likelihood(car.riskLikelihood ?? 2);
    setP2Severity(car.riskSeverity ?? 3);
    setP2Corrective(car.correctiveAction ?? '');
    setP2CorrectiveDue(car.correctiveDueDate ?? defaultDue14);
    setP2Preventive(car.preventiveAction ?? '');
    setP2PreventiveDue(car.preventiveDueDate ?? defaultDue14);
    setP2Responsible(car.responsiblePerson ?? '');
    setP2ExtCount(car.extensionCount ?? 0);
    setP3Detail(car.verificationDetail ?? '');
  };

  const selectParForEdit = (par: ParRecord) => {
    setSelectedParId(par.id);
    setParAction(par.preventiveAction ?? '');
    setParDue(par.expectedDueDate ?? defaultDue14);
    setParResp(par.responsiblePerson ?? '');
    setParVerifyDetail(par.verificationDetail ?? '');
  };

  const riskCalc = calculateRiskMatrix(p2Likelihood, p2Severity);
  const canIssue = canPerformAction(currentUser.role, 'issue_car_par');
  const canRespond = canPerformAction(currentUser.role, 'respond_car_par');
  const canVerify = canPerformAction(currentUser.role, 'verify_close_car_par');
  const canAdminEdit = canPerformAction(currentUser.role, 'edit_any_record');
  const canAdminDelete = canPerformAction(currentUser.role, 'delete_any_record');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDetail.trim()) return;
    if (newType === 'PAR') {
      onCreatePar({
        sourceType: newSource,
        sourceRef: newSourceRef,
        clause: newClause,
        activityType: newActType,
        part1Detail: newDetail.trim(),
        proposerName: currentUser.displayName,
        proposedDate: todayISO,
        responsiblePerson: newResponsible,
      });
      setTab('par_log');
    } else {
      onCreateCar({
        recordType: newType,
        sourceType: newSource,
        sourceRef: newSourceRef,
        part1Detail: newDetail.trim(),
        clause: newClause,
        activityType: newActType,
        finderName: currentUser.displayName,
        foundDate: todayISO,
        responsiblePerson: newResponsible,
      });
      setTab('car_log');
    }
    setNewDetail('');
    setShowNewForm(false);
  };

  const handleExportCarLog = () => {
    exportToCsvWithBom(
      `FM-LB-012_CAR_Log_${todayISO}.csv`,
      ['CAR No.', 'ประเภท', 'วันที่ออก', 'ข้อกำหนด', 'ข้อบกพร่อง', 'ผู้ตรวจพบ', 'ผู้รับผิดชอบ', 'กำหนดแล้วเสร็จ', 'คะแนนความเสี่ยง', 'ผลสถานะ', 'อ้างอิง CAR ใหม่'],
      cars.map((c) => [
        c.carNo,
        c.recordType,
        c.foundDate,
        c.clause,
        c.part1Detail,
        c.finderName,
        c.responsiblePerson ?? '',
        c.correctiveDueDate ?? c.responseDueDate ?? '',
        c.riskScore ?? '',
        c.status,
        c.linkedNewCarNo ?? '',
      ])
    );
  };

  const handleExportParLog = () => {
    exportToCsvWithBom(
      `FM-LB-014_PAR_Log_${todayISO}.csv`,
      ['PAR No.', 'วันที่ออก', 'ที่มาของ PAR', 'ข้อกำหนด', 'รายละเอียด', 'ผู้เสนอ', 'ผู้รับผิดชอบ', 'กำหนดแล้วเสร็จ', 'สถานะ', 'อ้างอิง PAR ใหม่'],
      pars.map((p) => [
        p.parNo,
        p.proposedDate,
        SOURCE_TYPE_LABELS[p.sourceType],
        p.clause,
        p.part1Detail,
        p.proposerName,
        p.responsiblePerson ?? '',
        p.expectedDueDate ?? '',
        p.status,
        p.linkedNewParNo ?? '',
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-mono-tabular">
            FM-LB-011 (CAR) · FM-LB-012 (CAR Log) · FM-LB-013 (PAR) · FM-LB-014 (PAR Log) · FM-LB-017 Risk
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            คำร้องขอให้แก้ไข (CAR/NC) ป้องกัน (PAR) และบัญชีควบคุม
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setTab('car_log')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                tab === 'car_log' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CAR / NC Log (FM-LB-012)
            </button>
            <button
              type="button"
              onClick={() => setTab('par_log')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                tab === 'par_log' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PAR Log (FM-LB-014)
            </button>
          </div>
          {canIssue && (
            <button
              type="button"
              onClick={() => setShowNewForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              ออกใบ CAR / NC / PAR
            </button>
          )}
        </div>
      </div>

      {/* Issue New CAR/NC/PAR Form */}
      {showNewForm && (
        <form onSubmit={handleCreateSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">ส่วนที่ 1: ออกใบคำร้องขอใหม่ (FM-LB-011 / FM-LB-013)</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label htmlFor="new-doc-type" className="block text-xs font-medium text-slate-700 mb-1">ประเภทเอกสาร</label>
              <select id="new-doc-type" value={newType} onChange={(e) => setNewType(e.target.value as 'CAR' | 'NC' | 'PAR')} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                <option value="CAR">CAR (ไม่กระทบผลทดสอบ)</option>
                <option value="NC">NC (กระทบผลทดสอบโดยตรง)</option>
                <option value="PAR">PAR (ปฏิบัติการป้องกัน)</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-doc-source" className="block text-xs font-medium text-slate-700 mb-1">ที่มาของข้อบกพร่อง</label>
              <select id="new-doc-source" value={newSource} onChange={(e) => setNewSource(e.target.value as SourceType)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-doc-ref" className="block text-xs font-medium text-slate-700 mb-1">อ้างอิงครั้งที่ / หมายเลข</label>
              <input id="new-doc-ref" type="text" value={newSourceRef} onChange={(e) => setNewSourceRef(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
            </div>
            <div>
              <label htmlFor="new-doc-clause" className="block text-xs font-medium text-slate-700 mb-1">ข้อกำหนด ISO/IEC 17025</label>
              <select id="new-doc-clause" value={newClause} onChange={(e) => setNewClause(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular">
                {FM_LB_025_CLAUSES.filter((c) => !c.isHeader).map((c) => (
                  <option key={c.clause} value={c.clause}>{c.titleTh}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-doc-act" className="block text-xs font-medium text-slate-700 mb-1">กิจกรรม</label>
              <select id="new-doc-act" value={newActType} onChange={(e) => setNewActType(e.target.value as ActivityType)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                <option value="testing">Testing</option>
                <option value="calibration">Calibration</option>
                <option value="management">Management</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-8">
              <label htmlFor="new-doc-detail" className="block text-xs font-medium text-slate-700 mb-1">รายละเอียดข้อบกพร่อง / ข้อมูลเพื่อปรับปรุง *</label>
              <textarea id="new-doc-detail" rows={2} required value={newDetail} onChange={(e) => setNewDetail(e.target.value)} placeholder="ระบุสิ่งที่ไม่เป็นไปตามข้อกำหนดและหลักฐานที่ตรวจพบอย่างชัดเจน..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-4 space-y-2">
              <div>
                <label htmlFor="new-doc-resp" className="block text-xs font-medium text-slate-700 mb-1">ผู้รับผิดชอบแก้ไข/ป้องกัน</label>
                <input id="new-doc-resp" type="text" value={newResponsible} onChange={(e) => setNewResponsible(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800">
                  ออกเอกสาร
                </button>
                <button type="button" onClick={() => setShowNewForm(false)} className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md">
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* CAR / NC Workspace */}
      {tab === 'car_log' && (
        <div className="space-y-6">
          {/* FM-LB-012 CAR Log Table */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                FM-LB-012: บัญชีรายการ CAR / NC (CAR Log)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCarLog}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  ส่งออก CSV
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPrintModal('FM-LB-012')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  พิมพ์บัญชี FM-LB-012
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                    <th className="py-3 px-4">CAR/NC No.</th>
                    <th className="py-3 px-4">วันที่ออก</th>
                    <th className="py-3 px-4 min-w-[240px]">ข้อบกพร่อง · ข้อกำหนด</th>
                    <th className="py-3 px-4">ผู้ตรวจพบ / ผู้รับผิดชอบ</th>
                    <th className="py-3 px-4">กำหนดแล้วเสร็จ</th>
                    <th className="py-3 px-4">ความเสี่ยง (FM-017)</th>
                    <th className="py-3 px-4">ผล / สถานะ</th>
                    {(canAdminEdit || canAdminDelete) && <th className="py-3 px-4 text-right">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {cars.length === 0 ? (
                    <tr>
                      <td colSpan={(canAdminEdit || canAdminDelete) ? 8 : 7} className="py-10 px-6 text-center text-slate-500">
                        ยังไม่มีรายการคำร้อง CAR / NC ในบัญชี (FM-LB-012)
                      </td>
                    </tr>
                  ) : (
                    cars.map((c) => {
                      const timeline = evaluateCarTimeline(c, todayISO);
                      const isSelected = selectedCar?.id === c.id;
                      return (
                      <tr
                        key={c.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50/70'
                        }`}
                        onClick={() => selectCarForEdit(c)}
                      >
                        <td className="py-3 px-4 font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectCarForEdit(c);
                            }}
                            className="text-left hover:underline"
                          >
                            {c.carNo}
                          </button>
                          {c.linkedParentCarNo && (
                            <div className="text-[11px] font-normal text-slate-500">จาก {c.linkedParentCarNo}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {c.foundDate}
                          {timeline.isResponseOverdue && (
                            <div className="text-[11px] text-red-700 font-semibold">เกิน 7 วันทำการ</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 line-clamp-2">{c.part1Detail}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                            ข้อ {c.clause} · {ACTIVITY_TYPE_LABELS[c.activityType]}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800">พบ: {c.finderName}</div>
                          <div className="text-slate-500">แก้: {c.responsiblePerson || '-'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {c.correctiveDueDate || c.responseDueDate || '-'}
                          {(c.extensionCount ?? 0) > 0 && (
                            <div className="text-[11px] text-amber-700">ขยายเวลา {c.extensionCount}/2 ครั้ง</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular">
                          {c.riskScore ? (
                            <span className={c.riskFm17Required ? 'text-red-700 font-semibold' : 'text-slate-700'}>
                              {c.riskScore}/16 {c.riskFm17Required ? '(FM-017)' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">รอประเมิน</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {c.status === 'closed' ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              ปิด CAR แล้ว
                            </span>
                          ) : c.status === 'reissued' ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              ไม่ปิด · ออก {c.linkedNewCarNo}
                            </span>
                          ) : c.status === 'responded' ? (
                            <span className="font-semibold text-slate-900">ตอบแล้ว · รอทวนสอบ</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              รอตอบส่วนที่ 2
                            </span>
                          )}
                        </td>
                        {(canAdminEdit || canAdminDelete) && (
                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1">
                              {canAdminEdit && (
                                <button
                                  type="button"
                                  onClick={() => setEditingCar({ ...c })}
                                  aria-label={`แก้ไข ${c.carNo}`}
                                  title="แก้ไขข้อมูลหลัก"
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canAdminDelete && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm({ kind: 'car', id: c.id, label: c.carNo })}
                                  aria-label={`ลบ ${c.carNo}`}
                                  title="ลบรายการ"
                                  className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-slate-200"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* FM-LB-011 Detail & Action Form */}
          {selectedCar && (
            <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs font-mono-tabular text-slate-500">
                    FM-LB-011 Rev.01 · {SOURCE_TYPE_LABELS[selectedCar.sourceType]} ({selectedCar.sourceRef || '-'})
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 font-mono-tabular">
                    แบบฟอร์มคำร้องขอให้แก้ไข: {selectedCar.carNo}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPrintModal('FM-LB-011', selectedCar.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  พิมพ์ใบ {selectedCar.carNo}
                </button>
              </div>

              {/* Part 1 */}
              <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2 text-xs">
                <div className="font-semibold text-slate-900">ส่วนที่ 1: รายละเอียดข้อบกพร่อง หรือสิ่งที่ไม่เป็นไปตามข้อกำหนด (ข้อ {selectedCar.clause})</div>
                <p className="text-sm text-slate-800 leading-relaxed">{selectedCar.part1Detail}</p>
                <div className="text-slate-500 font-mono-tabular">
                  ผู้พบข้อบกพร่อง: {selectedCar.finderName} · วันที่ออก: {selectedCar.foundDate} · กำหนดตอบ 7 วันทำการ: {selectedCar.responseDueDate}
                </div>
              </div>

              {/* Part 2: Root Cause, Impact, FM-LB-017 Risk Matrix & Action Plan */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  ส่วนที่ 2: การขยายผล สาเหตุที่แท้จริง ผลกระทบ ความเสี่ยง (FM-LB-017) และแนวทางแก้ไขป้องกัน
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-slate-700">การขยายผล:</span>
                      <label className="inline-flex items-center gap-1.5">
                        <input type="radio" name="exp" checked={!p2Expansion} onChange={() => setP2Expansion(false)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} />
                        ไม่มี
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input type="radio" name="exp" checked={p2Expansion} onChange={() => setP2Expansion(true)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} />
                        มีสาเหตุ
                      </label>
                    </div>
                    {p2Expansion && (
                      <input
                        type="text"
                        value={p2ExpansionCause}
                        onChange={(e) => setP2ExpansionCause(e.target.value)}
                        placeholder="ระบุรายละเอียดการขยายผล..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    )}
                    <div>
                      <label htmlFor="car-root-cause" className="block text-xs font-medium text-slate-700 mb-1">สาเหตุที่แท้จริง (Root Cause) *</label>
                      <textarea id="car-root-cause" rows={3} value={p2RootCause} onChange={(e) => setP2RootCause(e.target.value)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} placeholder="วิเคราะห์สาเหตุรากเหง้า (5 Why / Fishbone)..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-slate-700">ผลกระทบต่อส่วนอื่น:</span>
                      <label className="inline-flex items-center gap-1.5">
                        <input type="radio" name="imp" checked={!p2Impact} onChange={() => setP2Impact(false)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} />
                        ไม่กระทบ
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input type="radio" name="imp" checked={p2Impact} onChange={() => setP2Impact(true)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} />
                        กระทบ
                      </label>
                    </div>
                    <div>
                      <label htmlFor="car-impact-detail" className="block text-xs font-medium text-slate-700 mb-1">ระบุผลกระทบต่อส่วนอื่น / ผลการทดสอบ</label>
                      <textarea id="car-impact-detail" rows={2} value={p2ImpactDetail} onChange={(e) => setP2ImpactDetail(e.target.value)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    {/* FM-LB-017 Risk Matrix */}
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
                      <div className="text-xs font-semibold text-slate-800">
                        FM-LB-017: ประเมินระดับความเสี่ยง = โอกาส × ความรุนแรง
                      </div>
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <div>
                          <label htmlFor="risk-l" className="block text-[11px] text-slate-600">คะแนนโอกาส (1-4)</label>
                          <select id="risk-l" value={p2Likelihood} onChange={(e) => setP2Likelihood(Number(e.target.value))} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono-tabular">
                            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="risk-s" className="block text-[11px] text-slate-600">ความรุนแรง (1-4)</label>
                          <select id="risk-s" value={p2Severity} onChange={(e) => setP2Severity(Number(e.target.value))} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono-tabular">
                            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div className="text-right font-mono-tabular">
                          <div className="text-[11px] text-slate-500">ระดับความเสี่ยง</div>
                          <div className={`text-lg font-bold ${riskCalc.riskFm17Required ? 'text-red-700' : 'text-slate-900'}`}>
                            {riskCalc.riskScore} / 16
                          </div>
                        </div>
                      </div>
                      <div className={`text-[11px] font-medium ${riskCalc.riskFm17Required ? 'text-red-700' : 'text-slate-600'}`}>
                        {riskCalc.riskLevelLabel}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="car-corrective" className="block text-xs font-medium text-slate-700 mb-1">แนวทางปฏิบัติการแก้ไข *</label>
                    <textarea id="car-corrective" rows={2} value={p2Corrective} onChange={(e) => setP2Corrective(e.target.value)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                    <div className="mt-2 flex items-center gap-3">
                      <label htmlFor="car-c-due" className="text-xs text-slate-600">วันที่คาดว่าจะแล้วเสร็จ:</label>
                      <input id="car-c-due" type="date" value={p2CorrectiveDue} onChange={(e) => setP2CorrectiveDue(e.target.value)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} className="px-2.5 py-1 text-xs border border-slate-300 rounded font-mono-tabular" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="car-preventive" className="block text-xs font-medium text-slate-700 mb-1">แนวทางการป้องกันการเกิดซ้ำ *</label>
                    <textarea id="car-preventive" rows={2} value={p2Preventive} onChange={(e) => setP2Preventive(e.target.value)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                    <div className="mt-2 flex items-center gap-3">
                      <label htmlFor="car-p-due" className="text-xs text-slate-600">วันที่คาดว่าจะแล้วเสร็จ:</label>
                      <input id="car-p-due" type="date" value={p2PreventiveDue} onChange={(e) => setP2PreventiveDue(e.target.value)} disabled={(!canAdminEdit && (selectedCar.status === 'closed' || selectedCar.status === 'reissued')) || !canRespond} className="px-2.5 py-1 text-xs border border-slate-300 rounded font-mono-tabular" />
                    </div>
                  </div>
                </div>

                {(canAdminEdit || (selectedCar.status !== 'closed' && selectedCar.status !== 'reissued')) && canRespond && (
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <label htmlFor="car-resp-person" className="text-xs text-slate-600 mr-2">ผู้รับผิดชอบ:</label>
                        <input id="car-resp-person" type="text" value={p2Responsible} onChange={(e) => setP2Responsible(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-md" />
                      </div>
                      <div>
                        <label htmlFor="car-ext-count" className="text-xs text-slate-600 mr-2">ขอขยายเวลา (PD-LB-021 สูงสุด 2 ครั้ง):</label>
                        <select id="car-ext-count" value={p2ExtCount} onChange={(e) => setP2ExtCount(Number(e.target.value))} className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md font-mono-tabular">
                          <option value={0}>0 ครั้ง (ภายใน 7 วันทำการ)</option>
                          <option value={1}>ครั้งที่ 1 (+15 วันทำการ)</option>
                          <option value={2}>ครั้งที่ 2 (รวมไม่เกิน 30 วันทำการ)</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!p2RootCause.trim() || !p2Corrective.trim()) return;
                        onRespondCarPart2(selectedCar.id, {
                          expansionHasIssue: p2Expansion,
                          expansionCause: p2ExpansionCause,
                          rootCause: p2RootCause.trim(),
                          impactHasEffect: p2Impact,
                          impactDetail: p2ImpactDetail.trim(),
                          riskLikelihood: p2Likelihood,
                          riskSeverity: p2Severity,
                          riskScore: riskCalc.riskScore,
                          riskFm17Required: riskCalc.riskFm17Required,
                          correctiveAction: p2Corrective.trim(),
                          correctiveDueDate: p2CorrectiveDue,
                          preventiveAction: p2Preventive.trim(),
                          preventiveDueDate: p2PreventiveDue,
                          responsiblePerson: p2Responsible.trim() || currentUser.displayName,
                          extensionCount: p2ExtCount,
                        });
                      }}
                      className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
                    >
                      บันทึกส่วนที่ 2 (ตอบแนวทางแก้ไข)
                    </button>
                  </div>
                )}
              </div>

              {/* Part 3: Verification (Auditor / Quality Manager only) */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">
                  ส่วนที่ 3: ผลการตรวจติดตามการปฏิบัติการแก้ไข และป้องกันการเกิดซ้ำ (PD-LB-021 ข้อ 7.5.3)
                </h4>
                {selectedCar.status === 'closed' || selectedCar.status === 'reissued' ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1">
                    <div className="font-semibold text-slate-900">
                      ผลการทวนสอบ: {selectedCar.verificationResult === 'effective' ? 'มีประสิทธิผล (ปิด CAR)' : `ไม่มีประสิทธิผล · ออกใบใหม่ ${selectedCar.linkedNewCarNo}`}
                    </div>
                    <div className="text-slate-700">{selectedCar.verificationDetail}</div>
                    <div className="text-slate-500 font-mono-tabular">
                      ผู้ทวนสอบ: {selectedCar.verifierName} · วันที่: {selectedCar.verifyDate}
                    </div>
                  </div>
                ) : canVerify ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                      <label htmlFor="car-p3-res" className="block text-xs font-medium text-slate-700 mb-1">ผลการทวนสอบ</label>
                      <select id="car-p3-res" value={p3Result} onChange={(e) => setP3Result(e.target.value as 'effective' | 'ineffective')} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-medium">
                        <option value="effective">มีประสิทธิผล (ลงนามปิด CAR)</option>
                        <option value="ineffective">ไม่มีประสิทธิผล (ออก CAR ฉบับใหม่)</option>
                      </select>
                    </div>
                    <div className="md:col-span-6">
                      <label htmlFor="car-p3-detail" className="block text-xs font-medium text-slate-700 mb-1">บันทึกหลักฐานการทวนสอบประสิทธิผล *</label>
                      <input id="car-p3-detail" type="text" value={p3Detail} onChange={(e) => setP3Detail(e.target.value)} placeholder="ระบุผลการตรวจติดตามและหลักฐานที่ยืนยัน..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    <div className="md:col-span-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!p3Detail.trim()) return;
                          onVerifyCarPart3(selectedCar.id, {
                            verificationResult: p3Result,
                            verificationDetail: p3Detail.trim(),
                            verifierName: currentUser.displayName,
                            verifyDate: todayISO,
                          });
                        }}
                        className={`w-full px-4 py-2 text-xs font-medium text-white rounded-md ${
                          p3Result === 'effective' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-700 hover:bg-red-800'
                        }`}
                      >
                        {p3Result === 'effective' ? 'ยืนยันปิด CAR' : 'บันทึกและออก CAR ใหม่'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    เฉพาะผู้ตรวจติดตามภายใน (Auditor) หรือผู้จัดการคุณภาพ (QM) เท่านั้นที่มีสิทธิ์ทวนสอบและลงนามปิดส่วนที่ 3
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* PAR Workspace (FM-LB-013 & FM-LB-014) */}
      {tab === 'par_log' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                FM-LB-014: บัญชีรายการ PAR (PAR Log)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportParLog}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  ส่งออก CSV
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPrintModal('FM-LB-014')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  พิมพ์บัญชี FM-LB-014
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                    <th className="py-3 px-4">PAR No.</th>
                    <th className="py-3 px-4">วันที่ออก</th>
                    <th className="py-3 px-4">ที่มาของ PAR</th>
                    <th className="py-3 px-4 min-w-[240px]">รายละเอียดเพื่อปรับปรุง/ป้องกัน</th>
                    <th className="py-3 px-4">ผู้เสนอ / ผู้รับผิดชอบ</th>
                    <th className="py-3 px-4">กำหนดแล้วเสร็จ</th>
                    <th className="py-3 px-4">สถานะ</th>
                    {(canAdminEdit || canAdminDelete) && <th className="py-3 px-4 text-right">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {pars.length === 0 ? (
                    <tr>
                      <td colSpan={(canAdminEdit || canAdminDelete) ? 8 : 7} className="py-10 px-6 text-center text-slate-500">
                        ยังไม่มีรายการคำร้องขอให้ปฏิบัติการป้องกันในบัญชี (FM-LB-014)
                      </td>
                    </tr>
                  ) : (
                    pars.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => selectParForEdit(p)}
                        className={`cursor-pointer ${selectedPar?.id === p.id ? 'bg-slate-100/80' : 'hover:bg-slate-50/70'}`}
                      >
                      <td className="py-3 px-4 font-mono-tabular font-semibold text-slate-900">{p.parNo}</td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-700">{p.proposedDate}</td>
                      <td className="py-3 px-4 text-slate-700">{SOURCE_TYPE_LABELS[p.sourceType]}</td>
                      <td className="py-3 px-4 text-slate-800">{p.part1Detail}</td>
                      <td className="py-3 px-4">
                        <div>เสนอ: {p.proposerName}</div>
                        <div className="text-slate-500">รับผิดชอบ: {p.responsiblePerson || '-'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-700">{p.expectedDueDate || '-'}</td>
                      <td className="py-3 px-4 font-semibold">
                        {p.status === 'closed' ? (
                          <span className="text-emerald-700">ปิด PAR แล้ว</span>
                        ) : p.status === 'reissued' ? (
                          <span className="text-red-700">ออกใหม่ {p.linkedNewParNo}</span>
                        ) : p.status === 'responded' ? (
                          <span className="text-slate-900">ตอบแล้ว · รอทวนสอบ</span>
                        ) : (
                          <span className="text-amber-700">รอกำหนดแนวทาง</span>
                        )}
                      </td>
                      {(canAdminEdit || canAdminDelete) && (
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            {canAdminEdit && (
                              <button
                                type="button"
                                onClick={() => setEditingPar({ ...p })}
                                aria-label={`แก้ไข ${p.parNo}`}
                                title="แก้ไขข้อมูลหลัก"
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canAdminDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm({ kind: 'par', id: p.id, label: p.parNo })}
                                aria-label={`ลบ ${p.parNo}`}
                                title="ลบรายการ"
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-slate-200"
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

          {selectedPar && (
            <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs font-mono-tabular text-slate-500">FM-LB-013 Rev.00 · ข้อกำหนด {selectedPar.clause}</div>
                  <h3 className="text-lg font-bold text-slate-900 font-mono-tabular">
                    คำร้องขอให้ปฏิบัติการป้องกัน (PAR): {selectedPar.parNo}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPrintModal('FM-LB-013', selectedPar.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  พิมพ์ใบ {selectedPar.parNo}
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-md p-4 text-xs space-y-1">
                <div className="font-semibold text-slate-900">ส่วนที่ 1: ข้อมูลที่นำเสนอเพื่อปรับปรุงพัฒนา / ลดโอกาสการเกิดข้อบกพร่อง</div>
                <p className="text-sm text-slate-800">{selectedPar.part1Detail}</p>
              </div>

              {selectedPar.status !== 'closed' && selectedPar.status !== 'reissued' && canRespond && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-6">
                    <label htmlFor="par-action" className="block text-xs font-medium text-slate-700 mb-1">ส่วนที่ 2: แนวทางการป้องกัน</label>
                    <input id="par-action" type="text" value={parAction} onChange={(e) => setParAction(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="par-due" className="block text-xs font-medium text-slate-700 mb-1">วันที่คาดว่าจะแล้วเสร็จ</label>
                    <input id="par-due" type="date" value={parDue} onChange={(e) => setParDue(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="par-resp" className="block text-xs font-medium text-slate-700 mb-1">ผู้รับผิดชอบ</label>
                    <input id="par-resp" type="text" value={parResp} onChange={(e) => setParResp(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!parAction.trim()) return;
                        onRespondParPart2(selectedPar.id, {
                          preventiveAction: parAction.trim(),
                          expectedDueDate: parDue,
                          responsiblePerson: parResp.trim() || currentUser.displayName,
                        });
                      }}
                      className="w-full px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
                    >
                      บันทึกส่วนที่ 2
                    </button>
                  </div>
                </div>
              )}

              {selectedPar.status !== 'closed' && selectedPar.status !== 'reissued' && canVerify && (
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-3">
                    <label htmlFor="par-v-res" className="block text-xs font-medium text-slate-700 mb-1">ส่วนที่ 3: ผลการทวนสอบการป้องกัน</label>
                    <select id="par-v-res" value={parVerifyRes} onChange={(e) => setParVerifyRes(e.target.value as 'effective' | 'ineffective')} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                      <option value="effective">มีประสิทธิผล (ปิด PAR)</option>
                      <option value="ineffective">ไม่มีประสิทธิผล (ออก PAR ใหม่)</option>
                    </select>
                  </div>
                  <div className="md:col-span-6">
                    <label htmlFor="par-v-det" className="block text-xs font-medium text-slate-700 mb-1">รายละเอียดผลการทวนสอบ</label>
                    <input id="par-v-det" type="text" value={parVerifyDetail} onChange={(e) => setParVerifyDetail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                  </div>
                  <div className="md:col-span-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!parVerifyDetail.trim()) return;
                        onVerifyParPart3(selectedPar.id, {
                          verificationResult: parVerifyRes,
                          verificationDetail: parVerifyDetail.trim(),
                        });
                      }}
                      className="w-full px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-md hover:bg-emerald-800"
                    >
                      บันทึกผลทวนสอบ PAR
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Edit CAR Modal (Admin) */}
      {editingCar && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-car-title">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingCar.part1Detail.trim()) return;
              onUpdateCarItem(editingCar.id, {
                sourceType: editingCar.sourceType,
                sourceRef: editingCar.sourceRef ?? '',
                clause: editingCar.clause,
                activityType: editingCar.activityType,
                part1Detail: editingCar.part1Detail.trim(),
                finderName: editingCar.finderName.trim(),
                foundDate: editingCar.foundDate,
                responsiblePerson: editingCar.responsiblePerson ?? '',
                status: editingCar.status,
              });
              setEditingCar(null);
            }}
            className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="edit-car-title" className="text-base font-bold text-slate-900 font-mono-tabular">
                แก้ไขข้อมูลหลักใบคำร้อง {editingCar.carNo}
              </h3>
              <button type="button" onClick={() => setEditingCar(null)} className="p-1 text-slate-500 hover:text-slate-900" aria-label="ปิดหน้าต่างแก้ไข">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ที่มา</label>
                <select value={editingCar.sourceType} onChange={(e) => setEditingCar({ ...editingCar, sourceType: e.target.value as SourceType })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">อ้างอิงครั้งที่ / หมายเลข</label>
                <input type="text" value={editingCar.sourceRef ?? ''} onChange={(e) => setEditingCar({ ...editingCar, sourceRef: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">สถานะ</label>
                <select value={editingCar.status} onChange={(e) => setEditingCar({ ...editingCar, status: e.target.value as RecordStatus })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="open">เปิด (รอตอบส่วนที่ 2)</option>
                  <option value="responded">ตอบแล้ว (รอทวนสอบ)</option>
                  <option value="closed">ปิด CAR แล้ว</option>
                  <option value="reissued">ไม่ปิด (ออกฉบับใหม่)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ข้อกำหนด ISO/IEC 17025</label>
                <select value={editingCar.clause} onChange={(e) => setEditingCar({ ...editingCar, clause: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular">
                  {FM_LB_025_CLAUSES.filter((c) => !c.isHeader).map((c) => <option key={c.clause} value={c.clause}>{c.titleTh}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">กิจกรรม</label>
                <select value={editingCar.activityType} onChange={(e) => setEditingCar({ ...editingCar, activityType: e.target.value as ActivityType })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="testing">Testing</option>
                  <option value="calibration">Calibration</option>
                  <option value="management">Management</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">วันที่ออก</label>
                <input type="date" required value={editingCar.foundDate} onChange={(e) => setEditingCar({ ...editingCar, foundDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">รายละเอียดข้อบกพร่อง (ส่วนที่ 1) *</label>
                <textarea rows={3} required value={editingCar.part1Detail} onChange={(e) => setEditingCar({ ...editingCar, part1Detail: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ผู้ตรวจพบ</label>
                <input type="text" required value={editingCar.finderName} onChange={(e) => setEditingCar({ ...editingCar, finderName: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">ผู้รับผิดชอบแก้ไข</label>
                <input type="text" value={editingCar.responsiblePerson ?? ''} onChange={(e) => setEditingCar({ ...editingCar, responsiblePerson: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingCar(null)} className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md">
                ยกเลิก
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800">
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit PAR Modal (Admin) */}
      {editingPar && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-par-title">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingPar.part1Detail.trim()) return;
              onUpdateParItem(editingPar.id, {
                sourceType: editingPar.sourceType,
                sourceRef: editingPar.sourceRef ?? '',
                clause: editingPar.clause,
                activityType: editingPar.activityType,
                part1Detail: editingPar.part1Detail.trim(),
                proposerName: editingPar.proposerName.trim(),
                proposedDate: editingPar.proposedDate,
                responsiblePerson: editingPar.responsiblePerson ?? '',
                status: editingPar.status,
              });
              setEditingPar(null);
            }}
            className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="edit-par-title" className="text-base font-bold text-slate-900 font-mono-tabular">
                แก้ไขข้อมูลหลักใบปฏิบัติการป้องกัน {editingPar.parNo}
              </h3>
              <button type="button" onClick={() => setEditingPar(null)} className="p-1 text-slate-500 hover:text-slate-900" aria-label="ปิดหน้าต่างแก้ไข">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ที่มาของ PAR</label>
                <select value={editingPar.sourceType} onChange={(e) => setEditingPar({ ...editingPar, sourceType: e.target.value as SourceType })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">อ้างอิง</label>
                <input type="text" value={editingPar.sourceRef ?? ''} onChange={(e) => setEditingPar({ ...editingPar, sourceRef: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">สถานะ</label>
                <select value={editingPar.status} onChange={(e) => setEditingPar({ ...editingPar, status: e.target.value as RecordStatus })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="open">รอกำหนดแนวทาง</option>
                  <option value="responded">ตอบแล้ว (รอทวนสอบ)</option>
                  <option value="closed">ปิด PAR แล้ว</option>
                  <option value="reissued">ออกฉบับใหม่</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ข้อกำหนด ISO/IEC 17025</label>
                <select value={editingPar.clause} onChange={(e) => setEditingPar({ ...editingPar, clause: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular">
                  {FM_LB_025_CLAUSES.filter((c) => !c.isHeader).map((c) => <option key={c.clause} value={c.clause}>{c.titleTh}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">กิจกรรม</label>
                <select value={editingPar.activityType} onChange={(e) => setEditingPar({ ...editingPar, activityType: e.target.value as ActivityType })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="testing">Testing</option>
                  <option value="calibration">Calibration</option>
                  <option value="management">Management</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">วันที่ออก</label>
                <input type="date" required value={editingPar.proposedDate} onChange={(e) => setEditingPar({ ...editingPar, proposedDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">รายละเอียดเพื่อปรับปรุง/ป้องกัน (ส่วนที่ 1) *</label>
                <textarea rows={3} required value={editingPar.part1Detail} onChange={(e) => setEditingPar({ ...editingPar, part1Detail: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ผู้เสนอ</label>
                <input type="text" required value={editingPar.proposerName} onChange={(e) => setEditingPar({ ...editingPar, proposerName: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">ผู้รับผิดชอบ</label>
                <input type="text" value={editingPar.responsiblePerson ?? ''} onChange={(e) => setEditingPar({ ...editingPar, responsiblePerson: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingPar(null)} className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md">
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
        title={deleteConfirm?.kind === 'car' ? 'ยืนยันการลบใบคำร้อง CAR / NC' : 'ยืนยันการลบใบคำร้อง PAR'}
        itemLabel={deleteConfirm?.label ?? ''}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (!deleteConfirm) return;
          if (deleteConfirm.kind === 'car') {
            onDeleteCarItem(deleteConfirm.id);
          } else {
            onDeleteParItem(deleteConfirm.id);
          }
          setDeleteConfirm(null);
        }}
      />
    </div>
  );
};
