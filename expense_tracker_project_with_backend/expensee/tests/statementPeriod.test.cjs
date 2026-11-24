const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual TypeScript modules and PDF libraries with isolated settings.
// No server or personal financial database is used by these checks.
function loadModule(relative, overrides = {}) {
  const filename = path.resolve(__dirname, '../src/lib', relative);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, Date, Intl, console,
    require: name => {
      if (name in overrides) return overrides[name];
      if (name.startsWith('./')) return loadModule(`${name.slice(2)}.ts`, overrides);
      return require(name);
    }
  }, { filename });
  return module.exports;
}

const period = loadModule('statementPeriod.ts');
const pdf = loadModule('monthlyStatementPDF.ts', {
  './storage': { getUserSettingsSync: () => ({ currency: 'BDT', softwareName: 'Expense Tracker' }) }
});
const transaction = (date, title, type = 'income', amount = 100) => ({
  id: title, voucherId: title, title, date, type, amount,
  userId: 'test-user', categoryId: 'test-category'
});

test('inclusive range handles Dhaka midnight and excludes the following day', () => {
  const selected = period.createStatementPeriod('2026-11-01', '2026-11-24');
  const rows = [
    transaction('2026-10-31T17:59:59.999Z', 'before'),
    transaction('2026-10-31T18:00:00Z', 'first'),
    transaction('2026-11-24', 'date-only'),
    transaction('2026-11-24T23:59:59.999+06:00', 'last'),
    transaction('2026-11-25T00:00:00+06:00', 'after'),
    transaction('invalid', 'invalid')
  ];
  assert.deepEqual(Array.from(period.selectStatementTransactions(rows, selected), row => row.title), ['first', 'date-only', 'last']);
  assert.equal(selected.filename, 'statement-2026-11-01-to-2026-11-24.pdf');
});

test('single day, leap years and cross-year ranges work', () => {
  const selected = period.createStatementPeriod('2026-11-24', '2026-11-24');
  assert.equal(selected.endExclusive - selected.startTime, 86400000);
  assert.equal(period.createMonthlyPeriod(2024, 1).end, '2024-02-29');
  assert.equal(period.createMonthlyPeriod(2026, 1).end, '2026-02-28');
  assert.equal(period.createMonthlyPeriod(2026, 11).filename, 'statement-December-2026.pdf');
  const crossYear = period.createStatementPeriod('2025-12-31', '2026-01-01');
  assert.equal(period.selectStatementTransactions([transaction('2025-12-31', 'a'), transaction('2026-01-01', 'b')], crossYear).length, 2);
});

test('missing, impossible and reversed dates are rejected', () => {
  for (const invalid of ['', '2026-02-30', '2026-13-01', '2026-1-01']) {
    assert.throws(() => period.createStatementPeriod(invalid, '2026-11-24'), /valid From and To/);
  }
  assert.throws(() => period.createStatementPeriod('2026-11-25', '2026-11-24'), /on or before/);
});

test('real generated PDF contains only selected rows, correct period and totals', () => {
  const rows = [
    transaction('2026-10-31', 'OUTSIDE', 'income', 9999),
    transaction('2026-11-24', 'SELECTED-OUT', 'expense', 25),
    transaction('2026-11-01', 'SELECTED-IN', 'income', 100)
  ];
  const originalOrder = rows.map(row => row.id);
  const selected = period.createStatementPeriod('2026-11-01', '2026-11-24');
  const document = pdf.generateStatementPDF(rows, [], [], selected);
  const content = document.output();
  assert.ok(content.startsWith('%PDF-'));
  for (const text of ['01/11/2026 - 24/11/2026', 'From: 01/11/2026', 'To: 24/11/2026', 'SELECTED-IN', 'SELECTED-OUT', 'BDT 100.00', 'BDT 25.00', 'BDT 75.00']) {
    assert.ok(content.includes(text), `PDF must include ${text}`);
  }
  assert.ok(!content.includes('OUTSIDE'));
  assert.ok(!content.includes('9999.00'));
  assert.deepEqual(rows.map(row => row.id), originalOrder);
});

test('continued pages show the chosen range and monthly exports remain compatible', () => {
  const rows = Array.from({ length: 100 }, (_, index) => transaction('2026-11-24', `ROW-${index}`));
  const document = pdf.generateStatementPDF(rows, [], [], period.createStatementPeriod('2026-11-01', '2026-11-24'));
  assert.ok(document.getNumberOfPages() > 1);
  const content = document.output();
  assert.ok(content.includes('01/11/2026 - 24/11/2026 Statement'));
  assert.ok(content.includes('Continued'));
  const monthly = pdf.generateMonthlyStatementPDF(rows.slice(0, 1), [], [], 10, 2026).output();
  assert.ok(monthly.includes('November 2026'));
  assert.ok(monthly.includes('To: 30/11/2026'));
});
