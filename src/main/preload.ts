import { contextBridge, ipcRenderer } from 'electron';
import { RendererApi } from '../common/ipc';
import {
  EmployeeFormData,
  ShiftFormData
} from '../common/types';

const api: RendererApi = {
  listEmployees: () => ipcRenderer.invoke('employees:list'),
  createEmployee: (data: EmployeeFormData) => ipcRenderer.invoke('employees:create', data),
  updateEmployee: (id: number, data: EmployeeFormData) =>
    ipcRenderer.invoke('employees:update', id, data),
  deleteEmployee: (id: number) => ipcRenderer.invoke('employees:delete', id),
  getEmployeeShiftCount: (id: number) => ipcRenderer.invoke('employees:shiftCount', id),

  listShiftsByMonth: (year: number, month: number) =>
    ipcRenderer.invoke('shifts:listByMonth', year, month),
  createShift: (data: ShiftFormData) => ipcRenderer.invoke('shifts:create', data),
  updateShift: (id: number, data: ShiftFormData) =>
    ipcRenderer.invoke('shifts:update', id, data),
  deleteShift: (id: number) => ipcRenderer.invoke('shifts:delete', id),

  getSevenDaySummary: (referenceDate: string) =>
    ipcRenderer.invoke('sevenDay:summary', referenceDate),
  getSevenDayDetail: (employeeId: number, referenceDate: string) =>
    ipcRenderer.invoke('sevenDay:detail', employeeId, referenceDate),

  exportShiftsCsv: (year: number, month: number) =>
    ipcRenderer.invoke('exports:shifts', year, month),
  exportSevenDayCsv: (referenceDate: string) =>
    ipcRenderer.invoke('exports:sevenDay', referenceDate),
  backupDatabase: () => ipcRenderer.invoke('backup:database'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  acceptTerms: () => ipcRenderer.invoke('settings:acceptTerms'),
  getAppInfo: () => ipcRenderer.invoke('app:info')
};

contextBridge.exposeInMainWorld('api', api);
