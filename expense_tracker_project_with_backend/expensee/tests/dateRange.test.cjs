const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Same loader as statementPeriod.test.cjs: transpile the real module and run it in isolation.
function loadModule(relative) {
  const filename = path.resolve(__dirname, '../src/lib', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, Date, Intl, console,
    require: name => (name.startsWith('./') ? loadModule(`${name.slice(2)}.ts`) : require(name))
  }, { filename });
  return module.exports;
}

const range = loadModule('dateRange.ts');
const dhaka = loadModule('dhakaTime.ts');
const r = (start, end) => ({ start, end });
const plain = value => JSON.parse(JSON.stringify(value));

test('stored UTC timestamps map to the Dhaka calendar day', () => {
  // 18:30Z is 00:30 the next day in Dhaka
  assert.equal(dhaka.getStoredDateInputValue('2026-11-20T18:30:00.000Z'), '2026-11-21');
  assert.equal(dhaka.getStoredDateInputValue('2026-11-20T17:59:59.000Z'), '2026-11-20');
  assert.equal(dhaka.getStoredDateInputValue('2026-11-20T23:59:00+06:00'), '2026-11-20');
  assert.equal(dhaka.getStoredDateInputValue('2026-11-20'), '2026-11-20');
  assert.equal(range.dayKeyOf('2026-11-20T18:30:00.000Z'), '2026-11-21');
  assert.equal(range.dayKeyOf('not a date'), '');
});

test('day arithmetic handles month ends and leap years', () => {
  assert.equal(range.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(range.addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(range.addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(range.endOfMonth('2024-02-10'), '2024-02-29');
  assert.equal(range.dayCount(r('2026-11-01', '2026-11-20')), 20);
  assert.equal(range.inRange('2026-11-20', r('2026-11-01', '2026-11-20')), true);
  assert.equal(range.inRange('2026-11-21', r('2026-11-01', '2026-11-20')), false);
  assert.equal(range.inRange('1999-01-01', null), true);
  assert.equal(range.isDayKey('2026-02-30'), false);
});

test('comparison periods follow accounting conventions', () => {
  // whole month, whole year, multi-month
  assert.deepEqual(plain(range.previousPeriod(r('2026-10-01', '2026-10-31'))), r('2026-09-01', '2026-09-30'));
  assert.deepEqual(plain(range.previousPeriod(r('2026-03-01', '2026-03-31'))), r('2026-02-01', '2026-02-28'));
  assert.deepEqual(plain(range.previousPeriod(r('2025-01-01', '2025-12-31'))), r('2024-01-01', '2024-12-31'));
  // month, quarter and year to date
  assert.deepEqual(plain(range.previousPeriod(r('2026-11-01', '2026-11-27'))), r('2026-10-01', '2026-10-27'));
  assert.deepEqual(plain(range.previousPeriod(r('2026-10-01', '2026-11-27'))), r('2026-07-01', '2026-08-27'));
  assert.deepEqual(plain(range.previousPeriod(r('2026-01-01', '2026-11-27'))), r('2025-01-01', '2025-11-27'));
  // arbitrary range: the same number of days just before
  assert.deepEqual(plain(range.previousPeriod(r('2026-11-05', '2026-11-14'))), r('2026-10-26', '2026-11-04'));
});

test('presets produce valid inclusive ranges and are recognised', () => {
  for (const preset of range.RANGE_PRESETS) {
    const value = preset.range();
    assert.ok(range.isDayKey(value.start) && range.isDayKey(value.end), preset.id);
    assert.ok(value.start <= value.end, preset.id);
    assert.equal(range.matchPreset(value)?.id === undefined, false, preset.id);
  }
  assert.equal(range.matchPreset(r('2001-01-01', '2001-01-09')), undefined);
});

test('calendar dates convert without time zone drift', () => {
  const key = '2026-11-01';
  assert.equal(range.localDateToDayKey(range.dayKeyToLocalDate(key)), key);
  assert.equal(range.formatDayRange(r('2026-11-01', '2026-11-20')), '1 Nov 2026 – 20 Nov 2026');
  assert.equal(range.formatDayRange(r('2026-11-01', '2026-11-01')), '1 Nov 2026');
});
