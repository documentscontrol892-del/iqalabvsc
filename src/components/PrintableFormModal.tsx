import React, { useEffect, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import {
  AuditChecklistItem,
  AuditProgramItem,
  AuditScheduleItem,
  CarRecord,
  DeviationAlert,
  EquipmentItem,
  ParRecord,
  SOURCE_TYPE_LABELS,
  THAI_MONTHS_SHORT,
} from '../types/iso17025';
import {
  aggregateFmLb025Summary,
  DashboardMetrics,
  getCurrentBuddhistYear,
  parseRoundYearBE,
} from '../utils/isoRules';

export type PrintableFormCode =
  | 'FM-LB-011'
  | 'FM-LB-012'
  | 'FM-LB-013'
  | 'FM-LB-014'
  | 'FM-LB-022'
  | 'FM-LB-023'
  | 'FM-LB-024'
  | 'FM-LB-025'
  | 'REPORT-EXEC'
  | 'REPORT-EQUIP';

interface PrintableFormModalProps {
  formCode: PrintableFormCode | null;
  docId?: string;
  auditRound?: string;
  yearBE?: number;
  programs: AuditProgramItem[];
  schedules: AuditScheduleItem[];
  checklists: AuditChecklistItem[];
  cars: CarRecord[];
  pars: ParRecord[];
  equipment?: EquipmentItem[];
  metrics?: DashboardMetrics;
  alerts?: DeviationAlert[];
  onClose: () => void;
}

const FORM_REVISION_HEADERS: Record<
  PrintableFormCode,
  { title: string; rev: string; landscape: boolean }
> = {
  'FM-LB-011': {
    title: 'แบบฟอร์ม เรื่อง คำร้องขอให้แก้ไข (CAR)',
    rev: 'FM-LB-011 Rev.01/03-01-2566',
    landscape: false,
  },
  'FM-LB-012': {
    title: 'แบบฟอร์ม เรื่อง บัญชีรายการ CAR (CAR Log)',
    rev: 'FM-LB-012 Rev.00/16-12-2564',
    landscape: true,
  },
  'FM-LB-013': {
    title: 'แบบฟอร์ม เรื่อง คำร้องขอให้ปฏิบัติการป้องกัน (PAR)',
    rev: 'FM-LB-013 Rev.00/16-12-2564',
    landscape: false,
  },
  'FM-LB-014': {
    title: 'แบบฟอร์ม เรื่อง บัญชีรายการ PAR (PAR Log)',
    rev: 'FM-LB-014 Rev.00/16-12-2564',
    landscape: true,
  },
  'FM-LB-022': {
    title: 'แบบฟอร์ม เรื่อง แผนกำหนดการตรวจติดตามคุณภาพภายใน',
    rev: 'FM-LB-022 Rev. 01/13-06-2565',
    landscape: true,
  },
  'FM-LB-023': {
    title: 'แบบฟอร์ม เรื่อง โปรแกรมการตรวจติดตามคุณภาพภายใน',
    rev: 'FM-LB-023 Rev.00/16-12-2564',
    landscape: true,
  },
  'FM-LB-024': {
    title: 'แบบฟอร์ม เรื่อง รายการตรวจติดตามคุณภาพภายใน (Audit check list)',
    rev: 'FM-LB-024 Rev.01/13-07-2566',
    landscape: true,
  },
  'FM-LB-025': {
    title: 'แบบฟอร์ม เรื่อง สรุปรายงานการตรวจติดตามคุณภาพภายใน',
    rev: 'FM-LB-025 Rev.01/13-07-2566',
    landscape: false,
  },
  'REPORT-EXEC': {
    title: 'รายงานสรุปผลการตรวจติดตามคุณภาพภายในสำหรับผู้บริหาร (Management Review)',
    rev: 'ISO/IEC 17025:2017 Clause 8.8 & 8.9',
    landscape: false,
  },
  'REPORT-EQUIP': {
    title: 'รายงานสถานะความสอดคล้องเครื่องมือสอบเทียบและการวิเคราะห์แนวโน้ม',
    rev: 'ISO/IEC 17025:2017 Clause 6.4, 6.5 & 7.7',
    landscape: true,
  },
};

function formatThaiSlashDate(iso?: string): string {
  if (!iso) return '....../....../......';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  const yearBE = Number(match[1]) + 543;
  return `${match[3]}/${match[2]}/${yearBE}`;
}

function splitRound(round?: string): { no: string; year: string } {
  if (!round || round === 'ALL') return { no: '.......', year: '.......' };
  const parts = round.split('/');
  return {
    no: parts[0]?.trim() || '.......',
    year: parts[1]?.trim() || String(parseRoundYearBE(round)),
  };
}

export const PrintableFormModal: React.FC<PrintableFormModalProps> = ({
  formCode,
  docId,
  auditRound,
  yearBE,
  programs,
  schedules,
  checklists,
  cars,
  pars,
  equipment = [],
  metrics,
  alerts = [],
  onClose,
}) => {
  const currentBE = getCurrentBuddhistYear();

  const availableProgramYears = useMemo(() => {
    const years = new Set<number>([currentBE]);
    programs.forEach((p) => years.add(p.yearBE));
    schedules.forEach((s) => years.add(s.yearBE));
    if (yearBE) years.add(yearBE);
    return Array.from(years).sort((a, b) => b - a);
  }, [programs, schedules, yearBE, currentBE]);

  const availableRounds = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => set.add(s.auditRound));
    checklists.forEach((c) => set.add(c.auditRound));
    if (auditRound && auditRound !== 'ALL') set.add(auditRound);
    return Array.from(set).sort().reverse();
  }, [schedules, checklists, auditRound]);

  const [selectedYearBE, setSelectedYearBE] = useState<number>(yearBE ?? availableProgramYears[0] ?? currentBE);
  const [selectedRound, setSelectedRound] = useState<string>(auditRound ?? availableRounds[0] ?? 'ALL');
  const [selectedCarId, setSelectedCarId] = useState<string>(docId ?? cars[0]?.id ?? '');
  const [selectedParId, setSelectedParId] = useState<string>(docId ?? pars[0]?.id ?? '');

  useEffect(() => {
    setSelectedYearBE(yearBE ?? availableProgramYears[0] ?? currentBE);
  }, [formCode, yearBE, availableProgramYears, currentBE]);

  useEffect(() => {
    if (auditRound) {
      setSelectedRound(auditRound);
    } else if (formCode === 'FM-LB-022') {
      const yearRounds = schedules.filter((s) => s.yearBE === (yearBE ?? currentBE)).map((s) => s.auditRound);
      setSelectedRound(yearRounds[0] ?? availableRounds[0] ?? 'ALL');
    } else {
      setSelectedRound(availableRounds[0] ?? 'ALL');
    }
  }, [formCode, auditRound, yearBE, schedules, availableRounds, currentBE]);

  useEffect(() => {
    if (formCode === 'FM-LB-011') {
      setSelectedCarId(docId ?? cars[0]?.id ?? '');
    }
    if (formCode === 'FM-LB-013') {
      setSelectedParId(docId ?? pars[0]?.id ?? '');
    }
  }, [formCode, docId, cars, pars]);

  if (!formCode) return null;

  const meta = FORM_REVISION_HEADERS[formCode];
  const carDoc = cars.find((c) => c.id === selectedCarId);
  const parDoc = pars.find((p) => p.id === selectedParId);

  const effectiveRound = selectedRound && selectedRound !== 'ALL' ? selectedRound : 'ALL';
  const summary025 = aggregateFmLb025Summary(checklists, effectiveRound);

  const yearPrograms = programs
    .filter((p) => p.yearBE === selectedYearBE)
    .sort((a, b) => a.sequence - b.sequence);

  const filteredSchedules = schedules.filter((s) => {
    if (effectiveRound !== 'ALL') return s.auditRound === effectiveRound;
    return s.yearBE === selectedYearBE;
  });

  const filteredChecklists =
    effectiveRound === 'ALL'
      ? checklists
      : checklists.filter((c) => c.auditRound === effectiveRound);

  const printDateStr = new Date().toISOString().slice(0, 10);
  const roundParts = splitRound(effectiveRound);
  const carLogFillerCount = Math.max(0, 12 - cars.length);
  const parLogFillerCount = Math.max(0, 12 - pars.length);
  const programFillerCount = Math.max(0, 12 - yearPrograms.length);
  const scheduleFillerCount = Math.max(0, 12 - filteredSchedules.length);
  const checklistFillerCount = Math.max(0, 12 - filteredChecklists.length);

  const approvedProgMeta = yearPrograms.find((p) => p.approvedBy);
  const preparedProgMeta = yearPrograms[0];

  const firstChecklistMeta = filteredChecklists[0];
  const distinctDepts = Array.from(new Set(filteredChecklists.map((c) => c.department).filter(Boolean))).join(', ');
  const distinctActivities = Array.from(new Set(filteredChecklists.map((c) => c.activity).filter(Boolean))).join(', ');

  return (
    <div
      className="print-modal-shell fixed inset-0 bg-slate-900/55 z-50 overflow-y-auto p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-modal-title"
    >
      <style>{`@page { size: A4 ${meta.landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`}</style>

      <div
        className={`print-paper-card mx-auto bg-white border border-slate-300 rounded-lg shadow-xl ${
          meta.landscape ? 'max-w-6xl' : 'max-w-4xl'
        }`}
      >
        {/* Toolbar (hidden on print / PDF export) */}
        <div className="no-print px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-t-lg">
          <div className="space-y-0.5">
            <div id="print-modal-title" className="text-sm font-semibold text-slate-900">
              ส่งออกเอกสารควบคุมมาตรฐาน PDF: {meta.rev}
            </div>
            <div className="text-[11px] text-slate-500">
              รูปแบบหน้ากระดาษ: A4 {meta.landscape ? 'แนวนอน (Landscape)' : 'แนวตั้ง (Portrait)'} · กด "สั่งพิมพ์ / บันทึกเป็น PDF" แล้วเลือก Save as PDF
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {formCode === 'FM-LB-023' && (
              <select
                aria-label="เลือกปี พ.ศ. สำหรับ FM-LB-023"
                value={selectedYearBE}
                onChange={(e) => setSelectedYearBE(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono-tabular"
              >
                {availableProgramYears.map((y) => (
                  <option key={y} value={y}>ปี พ.ศ. {y}</option>
                ))}
              </select>
            )}

            {(formCode === 'FM-LB-022' || formCode === 'FM-LB-024' || formCode === 'FM-LB-025') && (
              <select
                aria-label="เลือกรอบการตรวจสำหรับพิมพ์"
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono-tabular"
              >
                <option value="ALL">ทุกรอบ / แสดงทั้งหมด</option>
                {availableRounds.map((r) => (
                  <option key={r} value={r}>ครั้งที่ {r}</option>
                ))}
              </select>
            )}

            {formCode === 'FM-LB-011' && cars.length > 0 && (
              <select
                aria-label="เลือกใบ CAR/NC สำหรับพิมพ์"
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono-tabular"
              >
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>{c.carNo}</option>
                ))}
              </select>
            )}

            {formCode === 'FM-LB-013' && pars.length > 0 && (
              <select
                aria-label="เลือกใบ PAR สำหรับพิมพ์"
                value={selectedParId}
                onChange={(e) => setSelectedParId(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono-tabular"
              >
                {pars.map((p) => (
                  <option key={p.id} value={p.id}>{p.parNo}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              สั่งพิมพ์ / บันทึกเป็นไฟล์ PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่างพิมพ์เอกสาร"
              className="p-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="print-paper-body p-6 md:p-8 space-y-3 text-slate-950 text-[11px] leading-snug">
          {/* ===================== FM-LB-011 ===================== */}
          {formCode === 'FM-LB-011' && (
            <div className="space-y-2">
              <div className="text-right font-semibold text-[11px]">{meta.rev}</div>
              <h2 className="text-center text-sm font-bold">{meta.title}</h2>
              <div className="text-right font-mono-tabular font-semibold pt-1">
                CAR หมายเลข {carDoc?.carNo ? <span className="underline decoration-dotted px-2">{carDoc.carNo}</span> : '............................'}
              </div>

              <div className="border border-slate-950 divide-y divide-slate-950">
                {/* Source */}
                <div className="p-2.5 space-y-1.5">
                  <div className="font-bold">ที่มาของข้อบกพร่อง</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-2">
                    <div>
                      {carDoc?.sourceType === 'internal_audit' ? '☑' : '☐'} การตรวจติดตามคุณภาพภายในครั้งที่{' '}
                      <span className="font-mono-tabular">
                        {carDoc?.sourceType === 'internal_audit' && carDoc.sourceRef
                          ? carDoc.sourceRef.replace('ครั้งที่ ', '')
                          : '............/............'}
                      </span>
                    </div>
                    <div>
                      {carDoc?.sourceType === 'complaint' ? '☑' : '☐'} ข้อร้องเรียน หมายเลข{' '}
                      <span className="font-mono-tabular">
                        {carDoc?.sourceType === 'complaint' && carDoc.sourceRef ? carDoc.sourceRef : '............/............'}
                      </span>
                    </div>
                    <div>
                      {carDoc?.sourceType === 'management_review' ? '☑' : '☐'} การทบทวนระบบคุณภาพครั้งที่{' '}
                      <span className="font-mono-tabular">
                        {carDoc?.sourceType === 'management_review' && carDoc.sourceRef ? carDoc.sourceRef : '................/..................'}
                      </span>
                    </div>
                    <div>{carDoc?.sourceType === 'staff_observation' ? '☑' : '☐'} การสังเกตของเจ้าหน้าที่</div>
                    <div>
                      {carDoc?.sourceType === 'external_audit' ? '☑' : '☐'} การตรวจติดตามภายนอกโดย{' '}
                      <span>{carDoc?.sourceType === 'external_audit' && carDoc.sourceRef ? carDoc.sourceRef : '............................'}</span> วันที่{' '}
                      <span className="font-mono-tabular">{carDoc?.sourceType === 'external_audit' ? formatThaiSlashDate(carDoc.foundDate) : '.................'}</span>
                    </div>
                    <div>
                      {carDoc?.sourceType === 'other' ? '☑' : '☐'} อื่นๆ{' '}
                      <span>{carDoc?.sourceType === 'other' && carDoc.sourceRef ? carDoc.sourceRef : '..........................................'}</span>
                    </div>
                  </div>
                </div>

                {/* Part 1 */}
                <div className="p-2.5 space-y-2">
                  <div className="font-bold underline">ส่วนที่ 1 รายละเอียดข้อบกพร่อง หรือสิ่งที่ไม่เป็นไปตามข้อกำหนด</div>
                  <div className="min-h-[84px] whitespace-pre-wrap leading-relaxed pl-1">
                    {carDoc
                      ? `[${carDoc.recordType} · ข้อกำหนด ISO/IEC 17025 ข้อ ${carDoc.clause}] ${carDoc.part1Detail}`
                      : '\n\n\n'}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 text-[11px]">
                    <div>
                      ผู้พบข้อบกพร่อง <span className="px-1">{carDoc?.finderName || '........................................'}</span>{' '}
                      วันที่ <span className="font-mono-tabular">{carDoc ? formatThaiSlashDate(carDoc.foundDate) : '........./........./.........'}</span>
                    </div>
                    <div className="text-right">
                      ผู้จัดการคุณภาพ <span>........................................</span>{' '}
                      วันที่ <span className="font-mono-tabular">{carDoc ? formatThaiSlashDate(carDoc.foundDate) : '........./........./.........'}</span>
                    </div>
                  </div>
                </div>

                {/* Part 2 */}
                <div className="p-2.5 space-y-2">
                  <div className="font-bold underline">ส่วนที่ 2</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold">การขยายผล</span>
                    <span>{carDoc && carDoc.expansionHasIssue === false ? '☑' : '☐'} ไม่มี</span>
                    <span>
                      {carDoc?.expansionHasIssue ? '☑' : '☐'} มี สาเหตุ{' '}
                      <span>{carDoc?.expansionCause || '...................................................................'}</span>
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">สาเหตุที่แท้จริง </span>
                    <span>{carDoc?.rootCause || '................................................................................................................................................'}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="font-semibold">การประเมินผลกระทบ/ผลกระทบที่อาจเกิดขึ้นกับส่วนอื่น</span>
                      <span>{carDoc && carDoc.impactHasEffect === false ? '☑' : '☐'} ไม่กระทบ</span>
                    </div>
                    <div className="pl-[235px]">
                      <span>
                        {carDoc?.impactHasEffect ? '☑' : '☐'} กระทบ ระบุผลกระทบ{' '}
                        <span>{carDoc?.impactDetail || '................................................................'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-0.5">
                    <div className="font-semibold">การระบุเพิ่มเติมในแบบบันทึกชี้บ่งความเสี่ยงและโอกาส (FM-LB-017)</div>
                    <div className="pl-2">
                      ระดับความรุนแรงของข้อบกพร่อง (ระดับความเสี่ยง) &nbsp; ระดับความเสี่ยง = คะแนนโอกาส X คะแนนความรุนแรง{' '}
                      <span className="font-mono-tabular font-semibold">
                        ({carDoc?.riskScore ? `${carDoc.riskLikelihood} × ${carDoc.riskSeverity} = ${carDoc.riskScore} คะแนน` : '.........................'})
                      </span>
                    </div>
                    <div className="pl-2 flex items-center gap-10">
                      <span>{carDoc?.riskScore && !carDoc.riskFm17Required ? '☑' : '☐'} ไม่จำเป็น (ระดับความเสี่ยง 1-8 คะแนน)</span>
                      <span>{carDoc?.riskFm17Required ? '☑' : '☐'} จำเป็น (ระดับความเสี่ยง 9-16 คะแนน)</span>
                    </div>
                  </div>

                  <div className="pt-1 space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>แนวทางปฏิบัติการแก้ไข</span>
                      <span className="font-mono-tabular font-normal">
                        วันที่คาดว่าจะแล้วเสร็จ {carDoc?.correctiveDueDate ? formatThaiSlashDate(carDoc.correctiveDueDate) : '............................'}
                      </span>
                    </div>
                    <div className="min-h-[42px] whitespace-pre-wrap pl-1">
                      {carDoc?.correctiveAction || '.................................................................................................................................................................'}
                    </div>
                  </div>

                  <div className="pt-1 space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>แนวทางการป้องกันการเกิดซ้ำ</span>
                      <span className="font-mono-tabular font-normal">
                        วันที่คาดว่าจะแล้วเสร็จ {carDoc?.preventiveDueDate ? formatThaiSlashDate(carDoc.preventiveDueDate) : '............................'}
                      </span>
                    </div>
                    <div className="min-h-[42px] whitespace-pre-wrap pl-1">
                      {carDoc?.preventiveAction || '.................................................................................................................................................................'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 text-center">
                    <div>
                      <div>ผู้รับผิดชอบการแก้ไขและป้องกัน <span>{carDoc?.responsiblePerson || '........................................'}</span></div>
                      <div className="mt-1 font-mono-tabular">วันที่ {carDoc?.status !== 'open' && carDoc?.foundDate ? formatThaiSlashDate(carDoc.foundDate) : '........./........./.........'}</div>
                    </div>
                    <div>
                      <div>ผู้จัดการคุณภาพ/ผู้ตรวจติดตาม <span>{carDoc?.finderName || '........................................'}</span></div>
                      <div className="mt-1 font-mono-tabular">วันที่ {carDoc?.foundDate ? formatThaiSlashDate(carDoc.foundDate) : '........./........./.........'}</div>
                    </div>
                  </div>
                </div>

                {/* Part 3 */}
                <div className="p-2.5 space-y-2">
                  <div className="font-bold underline">ส่วนที่ 3</div>
                  <div className="font-semibold">ผลการตรวจติดตามการปฏิบัติการแก้ไข และป้องกันการเกิดซ้ำ</div>
                  <div className="min-h-[42px] whitespace-pre-wrap pl-1">
                    {carDoc?.verificationDetail || '.................................................................................................................................................................'}
                  </div>
                  <div className="flex items-center gap-12 pt-1">
                    <span>{carDoc?.verificationResult === 'effective' ? '☑' : '☐'} มีประสิทธิผล</span>
                    <span>
                      {carDoc?.verificationResult === 'ineffective' ? '☑' : '☐'} ไม่มีประสิทธิผล ออก CAR ใหม่ หมายเลข{' '}
                      <span className="font-mono-tabular">{carDoc?.linkedNewCarNo || '........................................'}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 text-center">
                    <div>
                      <div>ผู้รับผิดชอบการทวนสอบการแก้ไข/ผู้ตรวจติดตาม <span>{carDoc?.verifierName || '.................................'}</span></div>
                      <div className="mt-1 font-mono-tabular">วันที่ {carDoc?.verifyDate ? formatThaiSlashDate(carDoc.verifyDate) : '........./........./.........'}</div>
                    </div>
                    <div>
                      <div>ผู้จัดการคุณภาพ <span>........................................</span></div>
                      <div className="mt-1 font-mono-tabular">วันที่ {carDoc?.verifyDate ? formatThaiSlashDate(carDoc.verifyDate) : '........./........./.........'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== FM-LB-012 ===================== */}
          {formCode === 'FM-LB-012' && (
            <div className="space-y-2">
              <div className="text-right font-semibold">{meta.rev}</div>
              <h2 className="text-center text-sm font-bold">{meta.title}</h2>
              <div className="text-right font-mono-tabular">หน้าที่ 1 ของ 1</div>

              <table className="w-full border border-slate-950 border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-20">CAR No.</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-20">วันที่ออก<br />CAR</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5">ข้อบกพร่อง</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-28">ผู้ตรวจพบ/<br />ผู้ตรวจติดตาม</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-28">ผู้รับผิดชอบการ<br />ปฏิบัติการแก้ไข</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-20">กำหนดวันที่<br />แล้วเสร็จ</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-28">ผู้ตรวจติดตาม<br />การแก้ไข</th>
                    <th colSpan={2} className="border border-slate-950 p-1">ผล</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-28">ลงนามผู้จัดการ<br />คุณภาพ/วันที่</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-24">อ้างอิง CAR No<br />กรณีไม่ปิด CAR</th>
                  </tr>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th className="border border-slate-950 p-1 w-14">ปิด CAR</th>
                    <th className="border border-slate-950 p-1 w-14">ไม่ปิด CAR</th>
                  </tr>
                </thead>
                <tbody>
                  {cars.map((c) => (
                    <tr key={c.id}>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular font-semibold">{c.carNo}</td>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">{formatThaiSlashDate(c.foundDate)}</td>
                      <td className="border border-slate-950 p-1.5">[{c.clause}] {c.part1Detail}</td>
                      <td className="border border-slate-950 p-1.5">{c.finderName}</td>
                      <td className="border border-slate-950 p-1.5">{c.responsiblePerson || '-'}</td>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">
                        {c.correctiveDueDate || c.responseDueDate ? formatThaiSlashDate(c.correctiveDueDate || c.responseDueDate) : '-'}
                      </td>
                      <td className="border border-slate-950 p-1.5">{c.verifierName || '-'}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-bold">{c.status === 'closed' ? '✓' : ''}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-bold">{c.status === 'reissued' ? '✓' : ''}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-mono-tabular">
                        {c.verifyDate ? formatThaiSlashDate(c.verifyDate) : ''}
                      </td>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">{c.linkedNewCarNo || ''}</td>
                    </tr>
                  ))}
                  {Array.from({ length: carLogFillerCount }).map((_, idx) => (
                    <tr key={`filler-car-${idx}`} className="h-7">
                      {Array.from({ length: 11 }).map((__, colIdx) => (
                        <td key={colIdx} className="border border-slate-950 p-1">&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ===================== FM-LB-013 ===================== */}
          {formCode === 'FM-LB-013' && (
            <div className="space-y-2">
              <div className="text-right font-semibold text-[11px]">{meta.rev}</div>
              <h2 className="text-center text-sm font-bold">{meta.title}</h2>
              <div className="text-right font-mono-tabular font-semibold pt-1">
                PAR หมายเลข {parDoc?.parNo ? <span className="underline decoration-dotted px-2">{parDoc.parNo}</span> : '............................'}
              </div>

              <div className="border border-slate-950 divide-y divide-slate-950">
                <div className="p-2.5 space-y-1.5">
                  <div className="font-bold underline">ผลจาก</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-2">
                    <div>
                      {parDoc?.sourceType === 'internal_audit' ? '☑' : '☐'} การตรวจติดตามคุณภาพภายในครั้งที่{' '}
                      <span className="font-mono-tabular">
                        {parDoc?.sourceType === 'internal_audit' && parDoc.sourceRef
                          ? parDoc.sourceRef.replace('ครั้งที่ ', '')
                          : '............/............'}
                      </span>
                    </div>
                    <div>
                      {parDoc?.sourceType === 'complaint' ? '☑' : '☐'} ข้อร้องเรียน หมายเลข{' '}
                      <span className="font-mono-tabular">
                        {parDoc?.sourceType === 'complaint' && parDoc.sourceRef ? parDoc.sourceRef : '............/............'}
                      </span>
                    </div>
                    <div>
                      {parDoc?.sourceType === 'management_review' ? '☑' : '☐'} การทบทวนระบบคุณภาพครั้งที่{' '}
                      <span className="font-mono-tabular">
                        {parDoc?.sourceType === 'management_review' && parDoc.sourceRef ? parDoc.sourceRef : '................/..................'}
                      </span>
                    </div>
                    <div>{parDoc?.sourceType === 'staff_observation' ? '☑' : '☐'} การสังเกตของเจ้าหน้าที่</div>
                    <div>
                      {parDoc?.sourceType === 'external_audit' ? '☑' : '☐'} การตรวจติดตามภายนอกโดย{' '}
                      <span>{parDoc?.sourceType === 'external_audit' && parDoc.sourceRef ? parDoc.sourceRef : '............................'}</span>
                    </div>
                    <div>
                      {parDoc?.sourceType === 'other' ? '☑' : '☐'} อื่นๆ{' '}
                      <span>{parDoc?.sourceType === 'other' && parDoc.sourceRef ? parDoc.sourceRef : '..........................................'}</span>
                    </div>
                  </div>
                  <div className="pl-2 font-mono-tabular">
                    วันที่ {parDoc?.proposedDate ? formatThaiSlashDate(parDoc.proposedDate) : '..................................................'}
                  </div>
                </div>

                {/* Part 1 */}
                <div className="p-2.5 space-y-2">
                  <div className="font-bold underline">ส่วนที่ 1</div>
                  <div>รายละเอียดข้อมูลที่นำเสนอเพื่อปรับปรุงพัฒนา/ลดโอกาสการเกิดข้อบกพร่อง</div>
                  <div className="min-h-[110px] whitespace-pre-wrap leading-relaxed pl-1">
                    {parDoc ? `[ข้อกำหนด ${parDoc.clause}] ${parDoc.part1Detail}` : '\n\n\n\n'}
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-3">
                    <div>
                      <div>ผู้เสนอ <span>{parDoc?.proposerName || '...................................................'}</span></div>
                      <div className="mt-1 font-mono-tabular">วันที่ {parDoc?.proposedDate ? formatThaiSlashDate(parDoc.proposedDate) : '........./........./.........'}</div>
                    </div>
                    <div className="text-right">
                      <div>ผู้จัดการคุณภาพ <span>...................................................</span></div>
                      <div className="mt-1 font-mono-tabular">วันที่ {parDoc?.proposedDate ? formatThaiSlashDate(parDoc.proposedDate) : '........./........./.........'}</div>
                    </div>
                  </div>
                </div>

                {/* Part 2 */}
                <div className="p-2.5 space-y-2">
                  <div className="font-bold underline">ส่วนที่ 2</div>
                  <div className="flex justify-between">
                    <span>แนวทางการป้องกัน</span>
                    <span className="font-mono-tabular">
                      วันที่คาดว่าจะแล้วเสร็จ {parDoc?.expectedDueDate ? formatThaiSlashDate(parDoc.expectedDueDate) : '......................................'}
                    </span>
                  </div>
                  <div className="min-h-[100px] whitespace-pre-wrap leading-relaxed pl-1">
                    {parDoc?.preventiveAction || '\n\n\n\n'}
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-3">
                    <div>
                      <div>ผู้รับผิดชอบการป้องกัน <span>{parDoc?.responsiblePerson || '.........................................'}</span></div>
                      <div className="mt-1 font-mono-tabular">วันที่ {parDoc?.expectedDueDate ? formatThaiSlashDate(parDoc.expectedDueDate) : '........./........./.........'}</div>
                    </div>
                    <div className="text-right">
                      <div>ผู้จัดการคุณภาพ <span>...................................................</span></div>
                      <div className="mt-1 font-mono-tabular">วันที่ ........./........./.........</div>
                    </div>
                  </div>
                </div>

                {/* Part 3 */}
                <div className="p-2.5 space-y-2">
                  <div className="font-bold underline">ส่วนที่ 3</div>
                  <div>ผลการทวนสอบการป้องกัน</div>
                  <div className="min-h-[90px] whitespace-pre-wrap leading-relaxed pl-1">
                    {parDoc?.verificationDetail || '\n\n\n'}
                  </div>
                  <div className="space-y-1 pt-1">
                    <div>{parDoc?.verificationResult === 'effective' ? '☑' : '☐'} มีประสิทธิผล</div>
                    <div>
                      {parDoc?.verificationResult === 'ineffective' ? '☑' : '☐'} ไม่มีประสิทธิผลออก PAR ใหม่ หมายเลข{' '}
                      <span className="font-mono-tabular">{parDoc?.linkedNewParNo || '................................................'}</span>
                    </div>
                  </div>
                  <div className="text-right pt-2">
                    <div>ผู้จัดการคุณภาพ <span>...................................................</span></div>
                    <div className="mt-1 font-mono-tabular">วันที่ ........./........./.........</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== FM-LB-014 ===================== */}
          {formCode === 'FM-LB-014' && (
            <div className="space-y-2">
              <div className="text-right font-semibold">{meta.rev}</div>
              <h2 className="text-center text-sm font-bold">{meta.title}</h2>
              <div className="text-right font-mono-tabular">หน้าที่ 1 ของ 1</div>

              <table className="w-full border border-slate-950 border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-24">PAR No.</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-20">วันที่ออก<br />PAR</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5">
                      ที่มาของ PAR<br />(การทบทวนการบริหาร/การควบคุมคุณภาพ/อื่นๆ)
                    </th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-28">ผู้เสนอ</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-28">ผู้รับผิดชอบ<br />การป้องกัน</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-24">กำหนด<br />วันที่แล้วเสร็จ</th>
                    <th colSpan={2} className="border border-slate-950 p-1">ผล</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-28">ลงนามผู้จัดการคุณภาพ/<br />วันที่</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-24">อ้างอิง PAR No.<br />กรณีไม่ปิด PAR</th>
                  </tr>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th className="border border-slate-950 p-1 w-14">ปิด PAR</th>
                    <th className="border border-slate-950 p-1 w-14">ไม่ปิด PAR</th>
                  </tr>
                </thead>
                <tbody>
                  {pars.map((p) => (
                    <tr key={p.id}>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular font-semibold">{p.parNo}</td>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">{formatThaiSlashDate(p.proposedDate)}</td>
                      <td className="border border-slate-950 p-1.5">
                        {SOURCE_TYPE_LABELS[p.sourceType]} ({p.part1Detail})
                      </td>
                      <td className="border border-slate-950 p-1.5">{p.proposerName}</td>
                      <td className="border border-slate-950 p-1.5">{p.responsiblePerson || '-'}</td>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">
                        {p.expectedDueDate ? formatThaiSlashDate(p.expectedDueDate) : '-'}
                      </td>
                      <td className="border border-slate-950 p-1.5 text-center font-bold">{p.status === 'closed' ? '✓' : ''}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-bold">{p.status === 'reissued' ? '✓' : ''}</td>
                      <td className="border border-slate-950 p-1.5 text-center"></td>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">{p.linkedNewParNo || ''}</td>
                    </tr>
                  ))}
                  {Array.from({ length: parLogFillerCount }).map((_, idx) => (
                    <tr key={`filler-par-${idx}`} className="h-7">
                      {Array.from({ length: 10 }).map((__, colIdx) => (
                        <td key={colIdx} className="border border-slate-950 p-1">&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ===================== FM-LB-022 ===================== */}
          {formCode === 'FM-LB-022' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 items-start">
                <div />
                <div className="text-center space-y-0.5">
                  <h2 className="text-sm font-bold">{meta.title}</h2>
                  <div className="font-mono-tabular font-semibold">
                    ครั้งที่ <span className="px-2">{roundParts.no}</span> / <span className="px-2">{roundParts.year}</span>
                  </div>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="font-semibold">{meta.rev}</div>
                  <div>หน้าที่ 1 ของ 1</div>
                </div>
              </div>

              <div className="space-y-1 text-[11px] leading-relaxed">
                <div className="font-semibold">เรียน เจ้าหน้าที่ในระบบ ISO/IEC 17025 ทุกท่าน</div>
                <p className="indent-10">
                  ตามที่บริษัทฯ ได้นำระบบบริหารงานคุณภาพ ISO/IEC 17025:2017 มาใช้และต้องทำการตรวจติดตามคุณภาพภายในตามข้อกำหนดนั้น
                  บัดนี้สมควรที่จะจัดให้มีการตรวจติดตามคุณภาพภายในครั้งที่ <span className="font-mono-tabular font-semibold px-2 underline decoration-dotted">{roundParts.no}</span> ประจำปี{' '}
                  <span className="font-mono-tabular font-semibold px-2 underline decoration-dotted">{effectiveRound === 'ALL' ? selectedYearBE : roundParts.year}</span>{' '}
                  ตามข้อกำหนดของระบบบริหารงานคุณภาพ ISO/IEC 17025:2017 จึงขอแต่งตั้งและกำหนดผู้ทำหน้าที่ผู้ตรวจติดตาม โดยมีวัน - เวลา การตรวจตามรายละเอียดดังต่อไปนี้
                </p>
              </div>

              <table className="w-full border border-slate-950 border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th className="border border-slate-950 p-1.5 w-24">ว/ด/ป</th>
                    <th className="border border-slate-950 p-1.5 w-24">เวลา (น.)</th>
                    <th className="border border-slate-950 p-1.5">กิจกรรม</th>
                    <th className="border border-slate-950 p-1.5">เกณฑ์การตรวจประเมิน</th>
                    <th className="border border-slate-950 p-1.5 w-32">ผู้ตรวจ</th>
                    <th className="border border-slate-950 p-1.5 w-32">ผู้ถูกตรวจ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((s) => (
                    <tr key={s.id}>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">{formatThaiSlashDate(s.auditDate)}</td>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">{s.timeRange}</td>
                      <td className="border border-slate-950 p-1.5">{s.activity}</td>
                      <td className="border border-slate-950 p-1.5">{s.criteria}</td>
                      <td className="border border-slate-950 p-1.5">{s.auditorName}</td>
                      <td className="border border-slate-950 p-1.5">{s.auditeeName}</td>
                    </tr>
                  ))}
                  {Array.from({ length: scheduleFillerCount }).map((_, idx) => (
                    <tr key={`filler-sch-${idx}`} className="h-6">
                      {Array.from({ length: 6 }).map((__, colIdx) => (
                        <td key={colIdx} className="border border-slate-950 p-1">&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 flex justify-between text-[11px]">
                <div>จัดทำโดย .................................................... ว/ด/ป .............................</div>
                <div>อนุมัติโดย .................................................... ว/ด/ป .............................</div>
              </div>
            </div>
          )}

          {/* ===================== FM-LB-023 ===================== */}
          {formCode === 'FM-LB-023' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 items-start">
                <div />
                <div className="text-center">
                  <h2 className="text-sm font-bold">{meta.title}</h2>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="font-semibold">{meta.rev}</div>
                  <div>หน้าที่ 1 ของ 1</div>
                </div>
              </div>

              <table className="w-full border border-slate-950 border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th rowSpan={3} className="border border-slate-950 p-1.5 w-14">ลำดับที่</th>
                    <th rowSpan={3} className="border border-slate-950 p-1.5">กิจกรรม</th>
                    <th colSpan={12} className="border border-slate-950 p-1">ระยะเวลาการดำเนินงาน</th>
                    <th rowSpan={3} className="border border-slate-950 p-1.5 w-44">หมายเหตุ</th>
                  </tr>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th colSpan={12} className="border border-slate-950 p-1 font-mono-tabular">
                      ปี พ.ศ. {selectedYearBE}
                    </th>
                  </tr>
                  <tr className="bg-slate-100 font-bold text-center">
                    {THAI_MONTHS_SHORT.map((m) => (
                      <th key={m} className="border border-slate-950 p-1 w-8">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yearPrograms.map((p) => (
                    <tr key={p.id}>
                      <td className="border border-slate-950 p-1.5 text-center font-mono-tabular">{p.sequence}</td>
                      <td className="border border-slate-950 p-1.5">{p.activity}</td>
                      {p.months.map((m, i) => (
                        <td key={i} className="border border-slate-950 p-1 text-center font-bold">{m ? '✓' : ''}</td>
                      ))}
                      <td className="border border-slate-950 p-1.5">{p.remarks || ''}</td>
                    </tr>
                  ))}
                  {Array.from({ length: programFillerCount }).map((_, idx) => (
                    <tr key={`filler-prog-${idx}`} className="h-6">
                      {Array.from({ length: 15 }).map((__, colIdx) => (
                        <td key={colIdx} className="border border-slate-950 p-1">&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 flex justify-between text-[11px]">
                <div>
                  ผู้จัดทำ{' '}
                  <span className="px-2">{preparedProgMeta?.preparedBy || '............................................'}</span>{' '}
                  ว/ด/ป <span className="font-mono-tabular">{preparedProgMeta?.preparedDate ? formatThaiSlashDate(preparedProgMeta.preparedDate) : '.......................'}</span>
                </div>
                <div>
                  ผู้อนุมัติ{' '}
                  <span className="px-2">{approvedProgMeta?.approvedBy || '............................................'}</span>{' '}
                  ว/ด/ป <span className="font-mono-tabular">{approvedProgMeta?.approvedDate ? formatThaiSlashDate(approvedProgMeta.approvedDate) : '.......................'}</span>
                </div>
              </div>
            </div>
          )}

          {/* ===================== FM-LB-024 ===================== */}
          {formCode === 'FM-LB-024' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 items-start">
                <div />
                <div className="text-center">
                  <h2 className="text-sm font-bold">{meta.title}</h2>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="font-semibold">{meta.rev}</div>
                  <div>หน้า 1 จาก 1</div>
                </div>
              </div>

              <table className="w-full border border-slate-950 border-collapse text-[10px]">
                <tbody>
                  <tr>
                    <td className="border border-slate-950 p-2 w-1/3 align-top">
                      <div className="font-bold text-center">ฝ่าย/หน่วยงาน/ส่วนงาน ที่ถูกตรวจติดตาม</div>
                      <div className="pt-1 text-center">{distinctDepts || '...................................................................'}</div>
                    </td>
                    <td className="border border-slate-950 p-2 w-1/3 align-top">
                      <div className="font-bold text-center">กิจกรรมที่ตรวจติดตาม</div>
                      <div className="pt-1 text-center">{distinctActivities || '...................................................................'}</div>
                    </td>
                    <td className="border border-slate-950 p-2 w-1/3 align-top space-y-1">
                      <div>
                        <span className="font-bold">ครั้งที่ตรวจติดตาม</span>{' '}
                        <span className="font-mono-tabular px-2">{roundParts.no} / {roundParts.year}</span>
                      </div>
                      <div>
                        <span className="font-bold">วันที่ตรวจติดตาม</span>{' '}
                        <span className="font-mono-tabular px-1">
                          {firstChecklistMeta?.auditDate ? formatThaiSlashDate(firstChecklistMeta.auditDate) : '......................................'}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border border-slate-950 border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-11">ลำดับ</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-16">ข้อกำหนด</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5">รายการตรวจติดตาม</th>
                    <th colSpan={4} className="border border-slate-950 p-1">ผลการตรวจติดตาม</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-64">รายละเอียดผลการตรวจติดตาม</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-28">หมายเหตุ</th>
                  </tr>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th className="border border-slate-950 p-1 w-8">C</th>
                    <th className="border border-slate-950 p-1 w-9">CAR</th>
                    <th className="border border-slate-950 p-1 w-8">NC</th>
                    <th className="border border-slate-950 p-1 w-8">OB</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChecklists.map((c, idx) => (
                    <tr key={c.id}>
                      <td className="border border-slate-950 p-1.5 text-center font-mono-tabular">{idx + 1}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-mono-tabular">{c.clause}</td>
                      <td className="border border-slate-950 p-1.5">{c.checkItem}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-bold">{c.result === 'C' ? '✓' : ''}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-bold">{c.result === 'CAR' ? '✓' : ''}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-bold">{c.result === 'NC' ? '✓' : ''}</td>
                      <td className="border border-slate-950 p-1.5 text-center font-bold">{c.result === 'OB' ? '✓' : ''}</td>
                      <td className="border border-slate-950 p-1.5">{c.detail || '-'}</td>
                      <td className="border border-slate-950 p-1.5 font-mono-tabular">{c.linkedDocNo || c.remarks || ''}</td>
                    </tr>
                  ))}
                  {Array.from({ length: checklistFillerCount }).map((_, idx) => (
                    <tr key={`filler-chk-${idx}`} className="h-6">
                      {Array.from({ length: 9 }).map((__, colIdx) => (
                        <td key={colIdx} className="border border-slate-950 p-1">&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-[10px] leading-relaxed">
                <span className="font-bold underline">หมายเหตุ</span> : โปรดกาเครื่องหมาย ✓ ในช่อง C , CAR, NC หรือ OB (C = Conform (มีความสอดคล้องเป็นไปตามข้อกำหนด), CAR = Corrective Action Request (ความไม่สอดคล้องที่ไม่เป็นไปตามที่กำหนด ที่ไม่เกี่ยวข้องกับผลทดสอบ), NC = Non conform (ความไม่สอดคล้องที่ไม่เป็นไปตามที่กำหนด ที่เกี่ยวข้องกับผลทดสอบโดยตรง), OB = Observation (สิ่งที่ตรวจพบไม่ผิดในข้อกำหนด แต่ถ้าปล่อยทิ้งไว้อาจจะเป็นข้อบกพร่องได้หรือต้องการเสนอแนะเพื่อปรับปรุงให้เกิดการพัฒนาต่อไปและผู้รับการตรวจติดตามยอมรับให้ออกใบป้องกัน))
              </p>

              <div className="pt-3 flex justify-between text-[11px]">
                <div>ผู้ถูกตรวจติดตาม <span className="px-2">{firstChecklistMeta?.auditeeName || '...........................................................'}</span></div>
                <div>หัวหน้าทีมผู้ตรวจติดตาม <span className="px-2">{firstChecklistMeta?.auditorName || '...................................................'}</span></div>
              </div>
            </div>
          )}

          {/* ===================== FM-LB-025 ===================== */}
          {formCode === 'FM-LB-025' && (
            <div className="space-y-2">
              <div className="text-right font-semibold">{meta.rev}</div>
              <h2 className="text-center text-sm font-bold">{meta.title}</h2>
              <div className="text-right font-mono-tabular text-[10px]">Page 1 of 1</div>
              <div className="text-center font-mono-tabular font-semibold pb-1">
                ครั้งที่ <span className="px-4 underline decoration-dotted">{roundParts.no}</span> ประจำปี{' '}
                <span className="px-4 underline decoration-dotted">{effectiveRound === 'ALL' ? selectedYearBE : roundParts.year}</span>
              </div>

              <table className="w-full border border-slate-950 border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th rowSpan={2} className="border border-slate-950 p-1.5 text-center">ข้อกำหนด ISO/IEC 17025</th>
                    <th colSpan={3} className="border border-slate-950 p-1">ผลการตรวจประเมิน</th>
                    <th rowSpan={2} className="border border-slate-950 p-1.5 w-36">หมายเหตุ</th>
                  </tr>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th className="border border-slate-950 p-1 w-14">CAR</th>
                    <th className="border border-slate-950 p-1 w-14">NC</th>
                    <th className="border border-slate-950 p-1 w-14">OB</th>
                  </tr>
                </thead>
                <tbody>
                  {summary025.rows.map((r) => (
                    <tr key={r.clause} className={r.isHeader ? 'bg-slate-50 font-bold' : ''}>
                      <td className={`border border-slate-950 py-1 px-2 ${r.isHeader ? '' : 'pl-5'}`}>{r.titleTh}</td>
                      <td className="border border-slate-950 py-1 px-1 text-center font-mono-tabular">{r.isHeader ? '' : r.carCount || ''}</td>
                      <td className="border border-slate-950 py-1 px-1 text-center font-mono-tabular">{r.isHeader ? '' : r.ncCount || ''}</td>
                      <td className="border border-slate-950 py-1 px-1 text-center font-mono-tabular">{r.isHeader ? '' : r.obCount || ''}</td>
                      <td className="border border-slate-950 py-1 px-2 font-mono-tabular">{r.isHeader ? '' : r.remarks}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-slate-100">
                    <td className="border border-slate-950 p-1.5 text-center">รวม</td>
                    <td className="border border-slate-950 p-1.5 text-center font-mono-tabular">{summary025.totalCar}</td>
                    <td className="border border-slate-950 p-1.5 text-center font-mono-tabular">{summary025.totalNc}</td>
                    <td className="border border-slate-950 p-1.5 text-center font-mono-tabular">{summary025.totalOb}</td>
                    <td className="border border-slate-950 p-1.5 font-mono-tabular text-center">
                      {effectiveRound === 'ALL' ? 'ทุกรอบ' : `ครั้งที่ ${effectiveRound}`}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="pt-3 flex justify-between text-[11px]">
                <div>ผู้บันทึก ....................................................</div>
                <div>ผู้ทวนสอบ ....................................................</div>
              </div>
            </div>
          )}

          {/* ===================== REPORT-EXEC ===================== */}
          {formCode === 'REPORT-EXEC' && metrics && (
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-slate-400 pb-2.5">
                <div>
                  <div className="font-bold text-sm">บริษัท เวท ซุปพีเรีย คอนซัลแตนท์ จำกัด (ห้องปฏิบัติการ : สมุทรสาคร)</div>
                  <div className="text-slate-600">VET SUPERIOR CONSULTANT COMPANY LIMITED (Laboratory : Samutsakhon)</div>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="font-semibold">{meta.rev}</div>
                  <div>วันที่พิมพ์: {formatThaiSlashDate(printDateStr)}</div>
                </div>
              </div>
              <h2 className="text-center text-sm font-bold">{meta.title}</h2>

              <div className="grid grid-cols-4 gap-3">
                <div className="border border-slate-800 p-2.5">
                  <div className="text-slate-600">ความสอดคล้องรวม</div>
                  <div className="text-base font-bold font-mono-tabular mt-1">{metrics.conformityRate}%</div>
                  <div className="text-[10px] text-slate-500">Testing {metrics.testingConformityRate}% · Cal {metrics.calibrationConformityRate}%</div>
                </div>
                <div className="border border-slate-800 p-2.5">
                  <div className="text-slate-600">CAR / NC ค้างดำเนินการ</div>
                  <div className="text-base font-bold font-mono-tabular mt-1">{metrics.openCarCount + metrics.openNcCount} ใบ</div>
                  <div className="text-[10px] text-slate-500">CAR {metrics.openCarCount} · NC {metrics.openNcCount}</div>
                </div>
                <div className="border border-slate-800 p-2.5">
                  <div className="text-slate-600">PAR ป้องกันค้างติดตาม</div>
                  <div className="text-base font-bold font-mono-tabular mt-1">{metrics.openParCount} ใบ</div>
                  <div className="text-[10px] text-slate-500">ปิดสะสมแล้ว {metrics.closedCarParCount} ใบ</div>
                </div>
                <div className="border border-slate-800 p-2.5">
                  <div className="text-slate-600">สถานะเครื่องมือสอบเทียบ</div>
                  <div className="text-base font-bold font-mono-tabular mt-1">{metrics.equipmentCompliantCount}/{equipment.length} เครื่อง</div>
                  <div className="text-[10px] text-slate-500">เฝ้าระวัง {metrics.equipmentWarningCount} · ไม่สอดคล้อง {metrics.equipmentNonCompliantCount}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold">1. สรุปผลการตรวจติดตามตามรอบ (Cycle Conformity Trends)</div>
                <table className="w-full border border-slate-800 border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-800 p-1.5 text-left">รอบการตรวจ</th>
                      <th className="border border-slate-800 p-1.5 text-right">ความสอดคล้อง (%)</th>
                      <th className="border border-slate-800 p-1.5 text-center">CAR</th>
                      <th className="border border-slate-800 p-1.5 text-center">NC</th>
                      <th className="border border-slate-800 p-1.5 text-center">OB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.cycleTrends.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border border-slate-800 p-2 text-center text-slate-500">ยังไม่มีข้อมูลการตรวจประเมิน</td>
                      </tr>
                    ) : (
                      metrics.cycleTrends.map((t) => (
                        <tr key={t.cycle}>
                          <td className="border border-slate-800 p-1.5 font-mono-tabular">{t.cycle}</td>
                          <td className="border border-slate-800 p-1.5 text-right font-mono-tabular font-semibold">{t.conformityPct}%</td>
                          <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{t.carCount}</td>
                          <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{t.ncCount}</td>
                          <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{t.obCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold">2. รายการคำร้อง CAR / NC และ PAR ที่เปิดอยู่</div>
                <table className="w-full border border-slate-800 border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-800 p-1.5 text-left">รหัส</th>
                      <th className="border border-slate-800 p-1.5 text-center">ข้อกำหนด</th>
                      <th className="border border-slate-800 p-1.5 text-left">รายละเอียด</th>
                      <th className="border border-slate-800 p-1.5 text-left">ผู้รับผิดชอบ</th>
                      <th className="border border-slate-800 p-1.5 text-left">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cars.filter((c) => c.status !== 'closed').map((c) => (
                      <tr key={c.id}>
                        <td className="border border-slate-800 p-1.5 font-mono-tabular">{c.carNo}</td>
                        <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{c.clause}</td>
                        <td className="border border-slate-800 p-1.5">{c.part1Detail}</td>
                        <td className="border border-slate-800 p-1.5">{c.responsiblePerson || '-'}</td>
                        <td className="border border-slate-800 p-1.5">{c.status}</td>
                      </tr>
                    ))}
                    {pars.filter((p) => p.status !== 'closed').map((p) => (
                      <tr key={p.id}>
                        <td className="border border-slate-800 p-1.5 font-mono-tabular">{p.parNo}</td>
                        <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{p.clause}</td>
                        <td className="border border-slate-800 p-1.5">{p.part1Detail}</td>
                        <td className="border border-slate-800 p-1.5">{p.responsiblePerson || '-'}</td>
                        <td className="border border-slate-800 p-1.5">{p.status}</td>
                      </tr>
                    ))}
                    {cars.filter((c) => c.status !== 'closed').length === 0 && pars.filter((p) => p.status !== 'closed').length === 0 && (
                      <tr>
                        <td colSpan={5} className="border border-slate-800 p-2 text-center text-slate-500">ไม่มีรายการ CAR/NC/PAR ค้างดำเนินการ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold">3. การแจ้งเตือนค่าเบี่ยงเบนที่ยังไม่ปิด ({alerts.filter((a) => a.status !== 'resolved').length} รายการ)</div>
                <table className="w-full border border-slate-800 border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-800 p-1.5 text-left">รหัส</th>
                      <th className="border border-slate-800 p-1.5 text-left">ระดับ</th>
                      <th className="border border-slate-800 p-1.5 text-left">หัวข้อ</th>
                      <th className="border border-slate-800 p-1.5 text-left">ค่าที่พบ / เกณฑ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.filter((a) => a.status !== 'resolved').map((a) => (
                      <tr key={a.id}>
                        <td className="border border-slate-800 p-1.5 font-mono-tabular">{a.alertCode}</td>
                        <td className="border border-slate-800 p-1.5">{a.severity === 'critical' ? 'วิกฤต' : 'เฝ้าระวัง'}</td>
                        <td className="border border-slate-800 p-1.5">{a.title}</td>
                        <td className="border border-slate-800 p-1.5 font-mono-tabular">{a.measuredValue || '-'} / {a.thresholdValue || '-'}</td>
                      </tr>
                    ))}
                    {alerts.filter((a) => a.status !== 'resolved').length === 0 && (
                      <tr>
                        <td colSpan={4} className="border border-slate-800 p-2 text-center text-slate-600">ไม่พบรายการแจ้งเตือนค้างดำเนินการ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 flex justify-between">
                <div>ผู้จัดทำรายงาน .......................................................</div>
                <div>ผู้บริหาร / ผู้อนุมัติ .......................................................</div>
              </div>
            </div>
          )}

          {/* ===================== REPORT-EQUIP ===================== */}
          {formCode === 'REPORT-EQUIP' && metrics && (
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-slate-400 pb-2.5">
                <div>
                  <div className="font-bold text-sm">บริษัท เวท ซุปพีเรีย คอนซัลแตนท์ จำกัด (ห้องปฏิบัติการ : สมุทรสาคร)</div>
                  <div className="text-slate-600">VET SUPERIOR CONSULTANT COMPANY LIMITED (Laboratory : Samutsakhon)</div>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="font-semibold">{meta.rev}</div>
                  <div>วันที่พิมพ์: {formatThaiSlashDate(printDateStr)}</div>
                </div>
              </div>
              <h2 className="text-center text-sm font-bold">{meta.title}</h2>

              <div className="space-y-1.5">
                <div className="font-bold">1. การกระจายตัวของข้อบกพร่องตามหมวดข้อกำหนด (หมวด 4–8)</div>
                <table className="w-full border border-slate-800 border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-800 p-1.5 text-left">หมวดข้อกำหนด</th>
                      <th className="border border-slate-800 p-1.5 text-center">CAR</th>
                      <th className="border border-slate-800 p-1.5 text-center">NC</th>
                      <th className="border border-slate-800 p-1.5 text-center">OB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.clauseGroupDistribution.map((g) => (
                      <tr key={g.group}>
                        <td className="border border-slate-800 p-1.5">{g.label}</td>
                        <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{g.car}</td>
                        <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{g.nc}</td>
                        <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{g.ob}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold">2. ทะเบียนสถานะความสอดคล้องของเครื่องมือสอบเทียบและการตรวจวัด ({equipment.length} รายการ)</div>
                <table className="w-full border border-slate-800 border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-800 p-1.5 text-left">รหัส</th>
                      <th className="border border-slate-800 p-1.5 text-left">ชื่อเครื่องมือ</th>
                      <th className="border border-slate-800 p-1.5 text-center">ข้อกำหนด</th>
                      <th className="border border-slate-800 p-1.5 text-right">เกณฑ์มาตรฐาน</th>
                      <th className="border border-slate-800 p-1.5 text-right">ค่าล่าสุด</th>
                      <th className="border border-slate-800 p-1.5 text-right">Z-Score</th>
                      <th className="border border-slate-800 p-1.5 text-center">ครบกำหนด</th>
                      <th className="border border-slate-800 p-1.5 text-left">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="border border-slate-800 p-2 text-center text-slate-500">ยังไม่มีรายการเครื่องมือในทะเบียน</td>
                      </tr>
                    ) : (
                      equipment.map((eq) => (
                        <tr key={eq.id}>
                          <td className="border border-slate-800 p-1.5 font-mono-tabular">{eq.code}</td>
                          <td className="border border-slate-800 p-1.5">{eq.name}</td>
                          <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{eq.clause}</td>
                          <td className="border border-slate-800 p-1.5 text-right font-mono-tabular">{eq.nominalValue} ± {eq.tolerance} {eq.unit}</td>
                          <td className="border border-slate-800 p-1.5 text-right font-mono-tabular">{eq.lastMeasuredValue} {eq.unit}</td>
                          <td className="border border-slate-800 p-1.5 text-right font-mono-tabular">{typeof eq.ptZScore === 'number' ? eq.ptZScore.toFixed(2) : '-'}</td>
                          <td className="border border-slate-800 p-1.5 text-center font-mono-tabular">{formatThaiSlashDate(eq.nextCalDate)}</td>
                          <td className="border border-slate-800 p-1.5">
                            {eq.status === 'compliant' ? 'ผ่านเกณฑ์' : eq.status === 'warning' ? 'เฝ้าระวัง' : 'ไม่สอดคล้อง'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 flex justify-between">
                <div>ผู้บันทึก / เจ้าหน้าที่เครื่องมือ .......................................................</div>
                <div>ผู้จัดการคุณภาพ / ผู้ทวนสอบ .......................................................</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
