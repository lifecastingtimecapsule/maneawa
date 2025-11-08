import {
  AppInfo,
  Employee,
  EmployeeFormData,
  SevenDayDetail,
  SevenDaySummary,
  Settings,
  Shift,
  ShiftFormData
} from './types';

export interface RendererApi {
  listEmployees(): Promise<Employee[]>;
  createEmployee(data: EmployeeFormData): Promise<Employee>;
  updateEmployee(id: number, data: EmployeeFormData): Promise<Employee>;
  deleteEmployee(id: number): Promise<{ deletedShifts: number }>;
  getEmployeeShiftCount(id: number): Promise<number>;

  listShiftsByMonth(year: number, month: number): Promise<Shift[]>;
  createShift(data: ShiftFormData): Promise<Shift>;
  updateShift(id: number, data: ShiftFormData): Promise<Shift>;
  deleteShift(id: number): Promise<void>;

  getSevenDaySummary(referenceDate: string): Promise<SevenDaySummary[]>;
  getSevenDayDetail(employeeId: number, referenceDate: string): Promise<SevenDayDetail>;

  exportShiftsCsv(year: number, month: number): Promise<{ saved: boolean; filePath?: string }>;
  exportSevenDayCsv(referenceDate: string): Promise<{ saved: boolean; filePath?: string }>;
  backupDatabase(): Promise<{ saved: boolean; filePath?: string }>;

  getSettings(): Promise<Settings>;
  acceptTerms(): Promise<void>;
  getAppInfo(): Promise<AppInfo>;
}

declare global {
  interface Window {
    api: RendererApi;
  }
}
