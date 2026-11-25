import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิดในระบบ',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold">ระบบตรวจพบข้อผิดพลาดด้านความปลอดภัยหรือการเชื่อมต่อ</h1>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              ไม่สามารถดำเนินการคำสั่งล่าสุดได้ กรุณาตรวจสอบสิทธิ์ผู้ใช้งาน (RBAC) หรือการเชื่อมต่อระบบคลาวด์ Firestore
            </p>
            <pre className="text-xs font-mono-tabular bg-slate-100 border border-slate-200 rounded p-3 overflow-auto max-h-48 text-slate-700">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              รีเฟรชหน้าจอ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
