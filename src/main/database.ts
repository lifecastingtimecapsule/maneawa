import fs from 'fs/promises';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import {
  Employee,
  EmployeeFormData,
  SevenDayDetail,
  SevenDayDetailDay,
  SevenDayStatusLevel,
  SevenDaySummary,
  Settings,
  Shift,
  ShiftFormData
} from '../common/types';

export interface DatabaseConfig {
  databasePath: string;
  wasmDirectory: string;
}

interface SettingsRow {
  key: string;
  value: string;
}

interface CountRow {
  count: number;
}

interface InsertRowId {
  id: number;
}

export class ComplianceDatabase {
  private SQL!: SqlJsStatic;
  private db!: SqlJsDatabase;
  private readonly databasePath: string;
  private readonly wasmDirectory: string;

  private constructor(config: DatabaseConfig) {
    this.databasePath = config.databasePath;
    this.wasmDirectory = config.wasmDirectory;
  }

  public static async initialize(config: DatabaseConfig): Promise<ComplianceDatabase> {
    const instance = new ComplianceDatabase(config);
    await instance.bootstrap();
    return instance;
  }

  public getDatabaseFilePath(): string {
    return this.databasePath;
  }

  private async bootstrap(): Promise<void> {
    await fs.mkdir(path.dirname(this.databasePath), { recursive: true });
    this.SQL = await initSqlJs({
      locateFile: (file) => path.join(this.wasmDirectory, file)
    });

    const exists = await this.fileExists(this.databasePath);
    if (exists) {
      const data = await fs.readFile(this.databasePath);
      this.db = new this.SQL.Database(data);
    } else {
      this.db = new this.SQL.Database();
      this.createSchema();
      await this.persist();
    }

    this.enableForeignKeys();
  }

  private enableForeignKeys(): void {
    this.db.run('PRAGMA foreign_keys = ON;');
  }

  private createSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        notes TEXT DEFAULT ''
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        work_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    this.db.run(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('termsAccepted', 'false');`
    );
  }

  private async fileExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async persist(): Promise<void> {
    const data = this.db.export();
    await fs.writeFile(this.databasePath, Buffer.from(data));
  }

  private queryAll<T>(sql: string, params: unknown[] = []): T[] {
    const statement = this.db.prepare(sql);
    try {
      statement.bind(params);
      const rows: T[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  private queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
    const rows = this.queryAll<T>(sql, params);
    return rows[0];
  }

  private run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params);
  }

  public async listEmployees(): Promise<Employee[]> {
    const rows = this.queryAll<Employee>(
      `SELECT id, name, notes FROM employees ORDER BY name COLLATE NOCASE;`
    );
    return rows.map((row) => ({ ...row, notes: row.notes ?? '' }));
  }

  public async getEmployeeShiftCount(id: number): Promise<number> {
    const row = this.queryOne<CountRow>(
      `SELECT COUNT(*) as count FROM shifts WHERE employee_id = ?;`,
      [id]
    );
    return row?.count ?? 0;
  }

  public async createEmployee(data: EmployeeFormData): Promise<Employee> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('氏名は必須です。');
    }

    const existing = this.queryOne<Employee>(
      `SELECT id, name, notes FROM employees WHERE LOWER(name) = LOWER(?)`,
      [trimmedName]
    );
    if (existing) {
      throw new Error('同じ氏名の従業員が既に登録されています。');
    }

    this.run(`INSERT INTO employees (name, notes) VALUES (?, ?);`, [
      trimmedName,
      data.notes?.trim() ?? ''
    ]);
    const inserted = this.queryOne<InsertRowId>(`SELECT last_insert_rowid() as id;`);
    const id = inserted?.id ?? 0;
    await this.persist();
    return {
      id,
      name: trimmedName,
      notes: data.notes?.trim() ?? ''
    };
  }

  public async updateEmployee(id: number, data: EmployeeFormData): Promise<Employee> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('氏名は必須です。');
    }

    const conflict = this.queryOne<Employee>(
      `SELECT id, name, notes FROM employees WHERE LOWER(name) = LOWER(?) AND id <> ?;`,
      [trimmedName, id]
    );
    if (conflict) {
      throw new Error('同じ氏名の従業員が既に存在します。');
    }

    this.run(`UPDATE employees SET name = ?, notes = ? WHERE id = ?;`, [
      trimmedName,
      data.notes?.trim() ?? '',
      id
    ]);
    await this.persist();
    return {
      id,
      name: trimmedName,
      notes: data.notes?.trim() ?? ''
    };
  }

  public async deleteEmployee(id: number): Promise<{ deletedShifts: number }> {
    const shiftCount = await this.getEmployeeShiftCount(id);
    this.run(`DELETE FROM employees WHERE id = ?;`, [id]);
    await this.persist();
    return { deletedShifts: shiftCount };
  }

  private calculateDurationMinutes(data: ShiftFormData): number {
    const startParts = data.startTime.split(':').map(Number);
    const endParts = data.endTime.split(':').map(Number);
    if (startParts.length !== 2 || endParts.length !== 2) {
      throw new Error('時刻の形式が正しくありません。');
    }

    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];

    let duration = endMinutes - startMinutes;
    if (duration <= 0) {
      duration += 24 * 60;
    }

    if (duration <= 0) {
      throw new Error('勤務時間の計算に失敗しました。');
    }

    if (duration > 24 * 60) {
      throw new Error('24時間を超えるシフトは登録できません。');
    }

    return duration;
  }

  public async createShift(data: ShiftFormData): Promise<Shift> {
    this.validateShiftInput(data);
    const duration = this.calculateDurationMinutes(data);

    this.run(
      `INSERT INTO shifts (employee_id, work_date, start_time, end_time, duration_minutes)
       VALUES (?, ?, ?, ?, ?);`,
      [data.employeeId, data.workDate, data.startTime, data.endTime, duration]
    );
    const inserted = this.queryOne<InsertRowId>(`SELECT last_insert_rowid() as id;`);
    const id = inserted?.id ?? 0;
    await this.persist();
    return this.getShiftById(id);
  }

  public async updateShift(id: number, data: ShiftFormData): Promise<Shift> {
    this.validateShiftInput(data);
    const duration = this.calculateDurationMinutes(data);
    this.run(
      `UPDATE shifts SET employee_id = ?, work_date = ?, start_time = ?, end_time = ?, duration_minutes = ?
       WHERE id = ?;`,
      [data.employeeId, data.workDate, data.startTime, data.endTime, duration, id]
    );
    await this.persist();
    return this.getShiftById(id);
  }

  public async deleteShift(id: number): Promise<void> {
    this.run(`DELETE FROM shifts WHERE id = ?;`, [id]);
    await this.persist();
  }

  private getShiftById(id: number): Shift {
    const row = this.queryOne<Shift>(
      `SELECT s.id, s.employee_id as employeeId, e.name as employeeName, s.work_date as workDate,
              s.start_time as startTime, s.end_time as endTime, s.duration_minutes as durationMinutes
       FROM shifts s
       JOIN employees e ON e.id = s.employee_id
       WHERE s.id = ?;`,
      [id]
    );
    if (!row) {
      throw new Error('シフトが見つかりませんでした。');
    }
    return row;
  }

  public async listShiftsByMonth(year: number, month: number): Promise<Shift[]> {
    const monthKey = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
    return this.queryAll<Shift>(
      `SELECT s.id, s.employee_id as employeeId, e.name as employeeName, s.work_date as workDate,
              s.start_time as startTime, s.end_time as endTime, s.duration_minutes as durationMinutes
       FROM shifts s
       JOIN employees e ON e.id = s.employee_id
       WHERE substr(s.work_date, 1, 7) = ?
       ORDER BY s.work_date ASC, s.start_time ASC;`,
      [monthKey]
    );
  }

  public async getSevenDaySummary(referenceDate: string): Promise<SevenDaySummary[]> {
    const endDate = referenceDate;
    const startDate = this.addDays(referenceDate, -6);
    const rows = this.queryAll<SevenDaySummary>(
      `SELECT e.id as employeeId, e.name as employeeName,
              IFNULL(SUM(CASE WHEN s.work_date BETWEEN ? AND ? THEN s.duration_minutes ELSE 0 END), 0) as totalMinutes,
              'ok' as status
       FROM employees e
       LEFT JOIN shifts s ON s.employee_id = e.id
       GROUP BY e.id, e.name
       ORDER BY e.name COLLATE NOCASE;`,
      [startDate, endDate]
    );

    return rows.map((row) => ({
      ...row,
      status: this.resolveStatus(row.totalMinutes)
    }));
  }

  public async getSevenDayDetail(employeeId: number, referenceDate: string): Promise<SevenDayDetail> {
    const endDate = referenceDate;
    const startDate = this.addDays(referenceDate, -6);
    const employee = this.queryOne<Employee>(
      `SELECT id, name, notes FROM employees WHERE id = ?;`,
      [employeeId]
    );
    if (!employee) {
      throw new Error('従業員が見つかりませんでした。');
    }

    const rows = this.queryAll<SevenDayDetailDay>(
      `SELECT work_date as date, SUM(duration_minutes) as totalMinutes
       FROM shifts
       WHERE employee_id = ? AND work_date BETWEEN ? AND ?
       GROUP BY work_date
       ORDER BY work_date;`,
      [employeeId, startDate, endDate]
    );

    const dayMap = new Map<string, number>();
    for (const row of rows) {
      dayMap.set(row.date, row.totalMinutes);
    }

    const days: SevenDayDetailDay[] = [];
    let cursor = startDate;
    while (cursor <= endDate) {
      days.push({
        date: cursor,
        totalMinutes: dayMap.get(cursor) ?? 0
      });
      cursor = this.addDays(cursor, 1);
    }

    const totalMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0);
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      days,
      totalMinutes,
      status: this.resolveStatus(totalMinutes)
    };
  }

  public async exportShiftsCsv(year: number, month: number): Promise<string> {
    const shifts = await this.listShiftsByMonth(year, month);
    const header = '従業員名,日付,開始,終了,勤務時間(時間)';
    const lines = shifts.map((shift) => {
      const hours = (shift.durationMinutes / 60).toFixed(2);
      return [
        this.escapeCsv(shift.employeeName),
        shift.workDate,
        shift.startTime,
        shift.endTime,
        hours
      ].join(',');
    });
    return [header, ...lines].join('\n');
  }

  public async exportSevenDayCsv(referenceDate: string): Promise<string> {
    const summary = await this.getSevenDaySummary(referenceDate);
    const header = '従業員名,合計時間(時間),判定';
    const lines = summary.map((item) => {
      const hours = (item.totalMinutes / 60).toFixed(2);
      return [
        this.escapeCsv(item.employeeName),
        hours,
        this.translateStatus(item.status)
      ].join(',');
    });
    return [header, ...lines].join('\n');
  }

  public async getSettings(): Promise<Settings> {
    const row = this.queryOne<SettingsRow>(`SELECT key, value FROM settings WHERE key = 'termsAccepted';`);
    return {
      termsAccepted: row?.value === 'true'
    };
  }

  public async acceptTerms(): Promise<void> {
    this.run(`INSERT INTO settings (key, value) VALUES ('termsAccepted', 'true')
              ON CONFLICT(key) DO UPDATE SET value = 'true';`);
    await this.persist();
  }

  private validateShiftInput(data: ShiftFormData): void {
    if (!data.employeeId) {
      throw new Error('従業員を選択してください。');
    }
    if (!/\d{4}-\d{2}-\d{2}/.test(data.workDate)) {
      throw new Error('日付の形式が正しくありません。');
    }
    if (!/^\d{2}:\d{2}$/.test(data.startTime) || !/^\d{2}:\d{2}$/.test(data.endTime)) {
      throw new Error('開始・終了時刻の形式が正しくありません。');
    }
  }

  private resolveStatus(totalMinutes: number): SevenDayStatusLevel {
    if (totalMinutes >= 28 * 60) {
      return 'ng';
    }
    if (totalMinutes >= 25 * 60) {
      return 'warning';
    }
    return 'ok';
  }

  private translateStatus(status: SevenDayStatusLevel): string {
    switch (status) {
      case 'ng':
        return 'NG';
      case 'warning':
        return '注意';
      default:
        return 'OK';
    }
  }

  private addDays(date: string, amount: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const base = new Date(Date.UTC(year, month - 1, day));
    base.setUTCDate(base.getUTCDate() + amount);
    return `${base.getUTCFullYear().toString().padStart(4, '0')}-${(base.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0')}-${base.getUTCDate().toString().padStart(2, '0')}`;
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
