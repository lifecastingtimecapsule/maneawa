export interface Employee {
  id: number;
  name: string;
  notes: string | null;
}

export interface EmployeeFormData {
  id?: number;
  name: string;
  notes?: string;
}

export interface Shift {
  id: number;
  employeeId: number;
  employeeName: string;
  workDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
}

export interface ShiftFormData {
  id?: number;
  employeeId: number;
  workDate: string;
  startTime: string;
  endTime: string;
}

export type SevenDayStatusLevel = 'ok' | 'warning' | 'ng';

export interface SevenDaySummary {
  employeeId: number;
  employeeName: string;
  totalMinutes: number;
  status: SevenDayStatusLevel;
}

export interface SevenDayDetailDay {
  date: string;
  totalMinutes: number;
}

export interface SevenDayDetail {
  employeeId: number;
  employeeName: string;
  days: SevenDayDetailDay[];
  totalMinutes: number;
  status: SevenDayStatusLevel;
}

export interface Settings {
  termsAccepted: boolean;
}

export interface AppInfo {
  name: string;
  version: string;
  contactEmail: string;
}

export interface ShiftTotalsByEmployee {
  employeeId: number;
  employeeName: string;
  totalMinutes: number;
  shifts: Shift[];
}
