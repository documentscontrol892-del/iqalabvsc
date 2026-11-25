import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  itemLabel: string;
  description?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  itemLabel,
  description,
  confirmLabel = 'ยืนยันลบข้อมูล',
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="no-print fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 id="confirm-delete-title" className="text-base font-bold text-slate-900">
                {title}
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                รายการที่ต้องการลบ: <strong className="text-slate-900">{itemLabel}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="ปิดหน้าต่างยืนยันการลบ"
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-3 leading-relaxed">
          {description ??
            'การลบข้อมูลจะถูกลบออกจากระบบอย่างถาวร และระบบจะบันทึกประวัติการลบลงใน Immutable Audit Trail เพื่อความสามารถในการตรวจสอบย้อนกลับตามมาตรฐาน ISO/IEC 17025'}
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-medium bg-red-700 text-white rounded-md hover:bg-red-800"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
