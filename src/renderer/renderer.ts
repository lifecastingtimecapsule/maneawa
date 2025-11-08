import {
  Employee,
  SevenDayDetail,
  SevenDaySummary,
  Shift
} from '../common/types';

const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.main-nav button'));
const sections = new Map<string, HTMLElement>();

document.querySelectorAll<HTMLElement>('main > section').forEach((section) => {
  const id = section.id.replace('section-', '');
  sections.set(id, section);
});

const employeeForm = document.getElementById('employee-form') as HTMLFormElement;
const employeeIdInput = document.getElementById('employee-id') as HTMLInputElement;
const employeeNameInput = document.getElementById('employee-name') as HTMLInputElement;
const employeeNotesInput = document.getElementById('employee-notes') as HTMLTextAreaElement;
const employeeCancelButton = document.getElementById('employee-cancel') as HTMLButtonElement;
const employeeTableBody = document.querySelector('#employee-table tbody') as HTMLTableSectionElement;

const shiftForm = document.getElementById('shift-form') as HTMLFormElement;
const shiftIdInput = document.getElementById('shift-id') as HTMLInputElement;
const shiftEmployeeSelect = document.getElementById('shift-employee') as HTMLSelectElement;
const shiftDateInput = document.getElementById('shift-date') as HTMLInputElement;
const shiftStartInput = document.getElementById('shift-start') as HTMLInputElement;
const shiftEndInput = document.getElementById('shift-end') as HTMLInputElement;
const shiftCancelButton = document.getElementById('shift-cancel') as HTMLButtonElement;
const shiftMonthInput = document.getElementById('shift-month') as HTMLInputElement;
const shiftListContainer = document.getElementById('shift-list') as HTMLDivElement;
const shiftViewInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="shift-view"]')
);

const referenceDateInput = document.getElementById('reference-date') as HTMLInputElement;
const statusFilterSelect = document.getElementById('status-filter') as HTMLSelectElement;
const summaryTableBody = document.querySelector('#summary-table tbody') as HTMLTableSectionElement;
const detailCard = document.getElementById('detail-card') as HTMLDivElement;
const detailTitle = document.getElementById('detail-title') as HTMLHeadingElement;
const detailTableBody = document.querySelector('#detail-table tbody') as HTMLTableSectionElement;
const detailTotal = document.getElementById('detail-total') as HTMLParagraphElement;

const exportMonthInput = document.getElementById('export-month') as HTMLInputElement;
const exportReferenceInput = document.getElementById('export-reference') as HTMLInputElement;
const exportShiftsButton = document.getElementById('export-shifts') as HTMLButtonElement;
const exportStatusButton = document.getElementById('export-status') as HTMLButtonElement;
const backupButton = document.getElementById('backup-button') as HTMLButtonElement;

const appNameSpan = document.getElementById('app-name') as HTMLSpanElement;
const appVersionSpan = document.getElementById('app-version') as HTMLSpanElement;
const appContactSpan = document.getElementById('app-contact') as HTMLSpanElement;

const termsDialog = document.getElementById('terms-dialog') as HTMLDialogElement;
const termsAcceptButton = document.getElementById('terms-accept') as HTMLButtonElement;
const termsCloseButton = document.getElementById('terms-close') as HTMLButtonElement;
const showTermsButton = document.getElementById('show-terms') as HTMLButtonElement;

const toast = document.getElementById('toast') as HTMLDivElement;

let employees: Employee[] = [];
let currentShifts: Shift[] = [];
let currentSummary: SevenDaySummary[] = [];
let mustAcceptTerms = false;

function showSection(target: string): void {
  sections.forEach((section, key) => {
    section.classList.toggle('active', key === target);
  });
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.section === target);
  });
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const sectionId = button.dataset.section;
    if (sectionId) {
      showSection(sectionId);
      if (sectionId === 'seven-day') {
        void refreshSevenDaySummary();
      }
    }
  });
});

function resetEmployeeForm(): void {
  employeeIdInput.value = '';
  employeeNameInput.value = '';
  employeeNotesInput.value = '';
  employeeForm.dataset.mode = 'create';
}

employeeCancelButton.addEventListener('click', () => {
  resetEmployeeForm();
});

employeeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = employeeIdInput.value ? Number(employeeIdInput.value) : undefined;
  const payload = {
    name: employeeNameInput.value,
    notes: employeeNotesInput.value
  };

  try {
    if (id) {
      await window.api.updateEmployee(id, payload);
      showToast('従業員情報を更新しました。');
    } else {
      await window.api.createEmployee(payload);
      showToast('従業員を登録しました。');
    }
    resetEmployeeForm();
    await loadEmployees();
    await refreshShifts();
    await refreshSevenDaySummary();
  } catch (error) {
    handleError(error);
  }
});

async function handleDeleteEmployee(id: number, name: string): Promise<void> {
  try {
    const count = await window.api.getEmployeeShiftCount(id);
    const confirmed = window.confirm(
      `「${name}」を削除すると関連するシフト${count}件も削除されます。削除しますか？`
    );
    if (!confirmed) {
      return;
    }
    await window.api.deleteEmployee(id);
    showToast('従業員を削除しました。');
    await loadEmployees();
    await refreshShifts();
    await refreshSevenDaySummary();
  } catch (error) {
    handleError(error);
  }
}

function renderEmployees(): void {
  employeeTableBody.innerHTML = '';
  if (employees.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.textContent = '登録済みの従業員はいません。';
    row.appendChild(cell);
    employeeTableBody.appendChild(row);
    updateEmployeeOptions();
    return;
  }

  employees.forEach((employee) => {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = employee.name;
    const notesCell = document.createElement('td');
    notesCell.textContent = employee.notes ?? '';
    const actionCell = document.createElement('td');
    actionCell.className = 'table-actions';

    const editButton = document.createElement('button');
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => {
      employeeIdInput.value = String(employee.id);
      employeeNameInput.value = employee.name;
      employeeNotesInput.value = employee.notes ?? '';
      employeeForm.dataset.mode = 'update';
      showSection('employees');
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', () => void handleDeleteEmployee(employee.id, employee.name));

    actionCell.append(editButton, deleteButton);
    row.append(nameCell, notesCell, actionCell);
    employeeTableBody.appendChild(row);
  });

  updateEmployeeOptions();
}

function updateEmployeeOptions(): void {
  const options = employees
    .map((employee) => `<option value="${employee.id}">${employee.name}</option>`)
    .join('');
  shiftEmployeeSelect.innerHTML = `<option value="">選択してください</option>${options}`;
}

async function loadEmployees(): Promise<void> {
  employees = await window.api.listEmployees();
  renderEmployees();
}

shiftCancelButton.addEventListener('click', () => {
  resetShiftForm();
});

shiftForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!shiftEmployeeSelect.value) {
    alert('従業員を選択してください。');
    return;
  }
  const payload = {
    employeeId: Number(shiftEmployeeSelect.value),
    workDate: shiftDateInput.value,
    startTime: shiftStartInput.value,
    endTime: shiftEndInput.value
  };
  const shiftId = shiftIdInput.value ? Number(shiftIdInput.value) : undefined;

  try {
    if (shiftId) {
      await window.api.updateShift(shiftId, payload);
      showToast('シフトを更新しました。');
    } else {
      await window.api.createShift(payload);
      showToast('シフトを登録しました。');
    }
    resetShiftForm();
    await refreshShifts();
    await refreshSevenDaySummary();
  } catch (error) {
    handleError(error);
  }
});

function resetShiftForm(): void {
  shiftIdInput.value = '';
  shiftEmployeeSelect.value = '';
  shiftDateInput.value = '';
  shiftStartInput.value = '';
  shiftEndInput.value = '';
}

function ensureMonthInputs(): void {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const date = today.toISOString().slice(0, 10);
  if (!shiftMonthInput.value) {
    shiftMonthInput.value = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
  }
  if (!referenceDateInput.value) {
    referenceDateInput.value = date;
  }
  if (!exportMonthInput.value) {
    exportMonthInput.value = shiftMonthInput.value;
  }
  if (!exportReferenceInput.value) {
    exportReferenceInput.value = date;
  }
}

async function refreshShifts(): Promise<void> {
  ensureMonthInputs();
  const [year, month] = shiftMonthInput.value.split('-').map(Number);
  if (!year || !month) {
    currentShifts = [];
    renderShiftList();
    return;
  }
  currentShifts = await window.api.listShiftsByMonth(year, month);
  renderShiftList();
}

function renderShiftList(): void {
  const view = shiftViewInputs.find((input) => input.checked)?.value ?? 'date';
  if (currentShifts.length === 0) {
    shiftListContainer.innerHTML = '<p>選択した月のシフトはありません。</p>';
    return;
  }

  if (view === 'employee') {
    const byEmployee = new Map<number, Shift[]>();
    currentShifts.forEach((shift) => {
      const list = byEmployee.get(shift.employeeId) ?? [];
      list.push(shift);
      byEmployee.set(shift.employeeId, list);
    });

    const container = document.createElement('div');
    const sortedEntries = Array.from(byEmployee.entries()).sort(([aId], [bId]) => {
      const a = employees.find((e) => e.id === aId)?.name ?? '';
      const b = employees.find((e) => e.id === bId)?.name ?? '';
      return a.localeCompare(b, 'ja');
    });
    sortedEntries.forEach(([employeeId, shifts]) => {
      const employee = employees.find((e) => e.id === employeeId);
      const title = document.createElement('h3');
      title.textContent = employee ? employee.name : `ID ${employeeId}`;
      container.appendChild(title);
      container.appendChild(createShiftTable(shifts));
    });
    shiftListContainer.innerHTML = '';
    shiftListContainer.appendChild(container);
    return;
  }

  shiftListContainer.innerHTML = '';
  shiftListContainer.appendChild(createShiftTable(currentShifts));
}

function createShiftTable(shifts: Shift[]): HTMLElement {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['日付', '従業員', '開始', '終了', '勤務時間', '操作'].forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const sorted = [...shifts].sort((a, b) => {
    if (a.workDate === b.workDate) {
      if (a.startTime === b.startTime) {
        return a.employeeName.localeCompare(b.employeeName, 'ja');
      }
      return a.startTime.localeCompare(b.startTime);
    }
    return a.workDate.localeCompare(b.workDate);
  });
  sorted.forEach((shift) => {
    const row = document.createElement('tr');
    const durationText = formatDuration(shift.durationMinutes);

    row.appendChild(createCell(shift.workDate));
    row.appendChild(createCell(shift.employeeName));
    row.appendChild(createCell(shift.startTime));
    row.appendChild(createCell(shift.endTime));
    row.appendChild(createCell(durationText));

    const actionCell = document.createElement('td');
    actionCell.className = 'table-actions';

    const editButton = document.createElement('button');
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => {
      shiftIdInput.value = String(shift.id);
      shiftEmployeeSelect.value = String(shift.employeeId);
      shiftDateInput.value = shift.workDate;
      shiftStartInput.value = shift.startTime;
      shiftEndInput.value = shift.endTime;
      showSection('shifts');
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', async () => {
      const confirmed = window.confirm('このシフトを削除しますか？');
      if (!confirmed) {
        return;
      }
      try {
        await window.api.deleteShift(shift.id);
        showToast('シフトを削除しました。');
        await refreshShifts();
        await refreshSevenDaySummary();
      } catch (error) {
        handleError(error);
      }
    });

    actionCell.append(editButton, deleteButton);
    row.appendChild(actionCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}

function createCell(text: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

async function refreshSevenDaySummary(): Promise<void> {
  ensureMonthInputs();
  if (!referenceDateInput.value) {
    return;
  }
  currentSummary = await window.api.getSevenDaySummary(referenceDateInput.value);
  renderSevenDaySummary();
}

function renderSevenDaySummary(): void {
  summaryTableBody.innerHTML = '';
  const filter = statusFilterSelect.value;
  const filtered = currentSummary.filter((item) => {
    if (filter === 'ng') {
      return item.status === 'ng';
    }
    if (filter === 'warning') {
      return item.status === 'ng' || item.status === 'warning';
    }
    return true;
  });

  if (filtered.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.textContent = '対象となる従業員はいません。';
    row.appendChild(cell);
    summaryTableBody.appendChild(row);
    detailCard.classList.remove('visible');
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement('tr');
    row.className = `summary-row status-${item.status}`;
    row.addEventListener('click', () => void loadSevenDayDetail(item.employeeId));

    row.appendChild(createCell(item.employeeName));
    row.appendChild(createCell(formatDuration(item.totalMinutes)));

    const statusCell = document.createElement('td');
    statusCell.textContent = translateStatus(item.status);
    statusCell.className = `status-${item.status}`;
    row.appendChild(statusCell);

    summaryTableBody.appendChild(row);
  });
}

async function loadSevenDayDetail(employeeId: number): Promise<void> {
  try {
    const detail = await window.api.getSevenDayDetail(employeeId, referenceDateInput.value);
    renderSevenDayDetail(detail);
  } catch (error) {
    handleError(error);
  }
}

function renderSevenDayDetail(detail: SevenDayDetail): void {
  detailTitle.textContent = `${detail.employeeName} の直近7日間`;
  detailTableBody.innerHTML = '';
  detail.days.forEach((day) => {
    const row = document.createElement('tr');
    row.appendChild(createCell(day.date));
    row.appendChild(createCell(formatDuration(day.totalMinutes)));
    detailTableBody.appendChild(row);
  });
  detailTotal.textContent = `合計：${formatDuration(detail.totalMinutes)} / 判定：${translateStatus(
    detail.status
  )}`;
  detailCard.classList.add('visible');
}

referenceDateInput.addEventListener('change', () => {
  exportReferenceInput.value = referenceDateInput.value;
  void refreshSevenDaySummary();
});
statusFilterSelect.addEventListener('change', () => renderSevenDaySummary());
shiftMonthInput.addEventListener('change', () => {
  exportMonthInput.value = shiftMonthInput.value;
  void refreshShifts();
});
shiftViewInputs.forEach((input) => input.addEventListener('change', () => renderShiftList()));

exportShiftsButton.addEventListener('click', async () => {
  if (!exportMonthInput.value) {
    alert('対象月を入力してください。');
    return;
  }
  const [year, month] = exportMonthInput.value.split('-').map(Number);
  try {
    const result = await window.api.exportShiftsCsv(year, month);
    if (result.saved) {
      showToast(`CSVを出力しました：${result.filePath}`);
    }
  } catch (error) {
    handleError(error);
  }
});

exportStatusButton.addEventListener('click', async () => {
  if (!exportReferenceInput.value) {
    alert('基準日を入力してください。');
    return;
  }
  try {
    const result = await window.api.exportSevenDayCsv(exportReferenceInput.value);
    if (result.saved) {
      showToast(`CSVを出力しました：${result.filePath}`);
    }
  } catch (error) {
    handleError(error);
  }
});

backupButton.addEventListener('click', async () => {
  try {
    const result = await window.api.backupDatabase();
    if (result.saved) {
      showToast(`バックアップを保存しました：${result.filePath}`);
    }
  } catch (error) {
    handleError(error);
  }
});

termsAcceptButton.addEventListener('click', async () => {
  try {
    await window.api.acceptTerms();
    mustAcceptTerms = false;
    termsCloseButton.disabled = false;
    termsDialog.close();
    showToast('利用規約に同意しました。');
  } catch (error) {
    handleError(error);
  }
});

termsCloseButton.addEventListener('click', () => {
  if (mustAcceptTerms) {
    return;
  }
  termsDialog.close();
});

termsDialog.addEventListener('cancel', (event) => {
  if (mustAcceptTerms) {
    event.preventDefault();
  }
});

function openTerms(requireAcceptance: boolean): void {
  mustAcceptTerms = requireAcceptance;
  termsCloseButton.disabled = requireAcceptance;
  if (typeof termsDialog.showModal === 'function') {
    termsDialog.showModal();
  }
}

showTermsButton.addEventListener('click', () => {
  openTerms(false);
});

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}時間`);
  }
  parts.push(`${mins}分`);
  return parts.join('');
}

function translateStatus(status: SevenDaySummary['status']): string {
  switch (status) {
    case 'ng':
      return 'NG';
    case 'warning':
      return '注意';
    default:
      return 'OK';
  }
}

function handleError(error: unknown): void {
  const message = error instanceof Error ? error.message : '予期せぬエラーが発生しました。';
  alert(message);
}

let toastTimer: number | undefined;
function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add('visible');
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('visible');
  }, 4000);
}

async function init(): Promise<void> {
  ensureMonthInputs();
  await loadEmployees();
  await refreshShifts();
  await refreshSevenDaySummary();

  const settings = await window.api.getSettings();
  if (!settings.termsAccepted) {
    openTerms(true);
  }

  const info = await window.api.getAppInfo();
  appNameSpan.textContent = info.name;
  appVersionSpan.textContent = info.version;
  appContactSpan.textContent = `${info.contactEmail}（返信義務はありません）`;
}

window.addEventListener('DOMContentLoaded', () => {
  void init();
});
