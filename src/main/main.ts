import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import {
  EmployeeFormData,
  ShiftFormData
} from '../common/types';
import { ComplianceDatabase } from './database';

const APP_NAME = 'Maneawa 28h チェッカー';
const CONTACT_EMAIL = 'support@example.com';

let mainWindow: BrowserWindow | null = null;
let database: ComplianceDatabase;

app.setName(APP_NAME);

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const getDatabasePath = (): string => {
  const fileName = 'maneawa.sqlite';
  return path.join(app.getPath('userData'), fileName);
};

const initializeDatabase = async (): Promise<void> => {
  database = await ComplianceDatabase.initialize({
    databasePath: getDatabasePath(),
    wasmDirectory: __dirname
  });
};

const registerIpcHandlers = (): void => {
  ipcMain.handle('employees:list', async () => database.listEmployees());
  ipcMain.handle('employees:create', async (_event, data: EmployeeFormData) =>
    database.createEmployee(data)
  );
  ipcMain.handle('employees:update', async (_event, id: number, data: EmployeeFormData) =>
    database.updateEmployee(id, data)
  );
  ipcMain.handle('employees:delete', async (_event, id: number) =>
    database.deleteEmployee(id)
  );
  ipcMain.handle('employees:shiftCount', async (_event, id: number) =>
    database.getEmployeeShiftCount(id)
  );

  ipcMain.handle('shifts:listByMonth', async (_event, year: number, month: number) =>
    database.listShiftsByMonth(year, month)
  );
  ipcMain.handle('shifts:create', async (_event, data: ShiftFormData) =>
    database.createShift(data)
  );
  ipcMain.handle('shifts:update', async (_event, id: number, data: ShiftFormData) =>
    database.updateShift(id, data)
  );
  ipcMain.handle('shifts:delete', async (_event, id: number) =>
    database.deleteShift(id)
  );

  ipcMain.handle('sevenDay:summary', async (_event, referenceDate: string) =>
    database.getSevenDaySummary(referenceDate)
  );
  ipcMain.handle('sevenDay:detail', async (_event, employeeId: number, referenceDate: string) =>
    database.getSevenDayDetail(employeeId, referenceDate)
  );

  ipcMain.handle('exports:shifts', async (_event, year: number, month: number) => {
    const csv = await database.exportShiftsCsv(year, month);
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `シフト_${year.toString().padStart(4, '0')}-${month
        .toString()
        .padStart(2, '0')}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (canceled || !filePath) {
      return { saved: false };
    }
    await fs.writeFile(filePath, csv, 'utf8');
    return { saved: true, filePath };
  });

  ipcMain.handle('exports:sevenDay', async (_event, referenceDate: string) => {
    const csv = await database.exportSevenDayCsv(referenceDate);
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `週次チェック_${referenceDate}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (canceled || !filePath) {
      return { saved: false };
    }
    await fs.writeFile(filePath, csv, 'utf8');
    return { saved: true, filePath };
  });

  ipcMain.handle('backup:database', async () => {
    const dbPath = database.getDatabaseFilePath();
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: 'maneawa-backup.sqlite',
      filters: [{ name: 'SQLite', extensions: ['sqlite', 'db'] }]
    });
    if (canceled || !filePath) {
      return { saved: false };
    }
    await fs.copyFile(dbPath, filePath);
    return { saved: true, filePath };
  });

  ipcMain.handle('settings:get', async () => database.getSettings());
  ipcMain.handle('settings:acceptTerms', async () => database.acceptTerms());

  ipcMain.handle('app:info', async () => ({
    name: APP_NAME,
    version: app.getVersion(),
    contactEmail: CONTACT_EMAIL
  }));
};

app.whenReady().then(async () => {
  await initializeDatabase();
  registerIpcHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
