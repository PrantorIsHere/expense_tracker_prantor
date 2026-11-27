const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load the real module; map the '@/data/*.json' imports to the files on disk.
function loadModule(relative) {
  const filename = path.resolve(__dirname, '../src/lib', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console,
    require: name => {
      if (name.startsWith('@/data/')) return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data', name.slice(7)), 'utf8'));
      if (name.startsWith('./')) return loadModule(`${name.slice(2)}.ts`);
      return require(name);
    }
  }, { filename });
  return module.exports;
}

const dir = loadModule('bankDirectory.ts');
const id = bank => bank && bank.id;

test('directory entries are complete and unique', () => {
  const ids = new Set();
  for (const bank of dir.BANKS) {
    assert.ok(bank.id && bank.name && bank.short && bank.category, JSON.stringify(bank));
    assert.ok(dir.BANK_CATEGORIES.includes(bank.category), bank.category);
    assert.ok(!ids.has(bank.id), `duplicate ${bank.id}`);
    ids.add(bank.id);
    if (bank.logo) assert.ok(fs.existsSync(path.resolve(__dirname, '../public', bank.logo.slice(1))), `missing file ${bank.logo}`);
  }
  assert.ok(dir.BANKS.length >= 60);
});

test('account names match the most specific bank', () => {
  assert.equal(id(dir.matchBank('MTB')), 'mtb');
  assert.equal(id(dir.matchBank('Mutual Trust Bank salary')), 'mtb');
  assert.equal(id(dir.matchBank('Trust Bank savings')), 'trust-bank');
  assert.equal(id(dir.matchBank('Islami Bank')), 'islami-bank');
  assert.equal(id(dir.matchBank('Social Islami Bank')), 'social-islami-bank');
  assert.equal(id(dir.matchBank('Standard Chartered card')), 'standard-chartered');
  assert.equal(id(dir.matchBank('bKash personal')), 'bkash');
  assert.equal(id(dir.matchBank('DBBL')), 'dutch-bangla-bank');
  assert.equal(id(dir.matchBank('National Bank of Pakistan')), 'national-bank-of-pakistan');
  assert.equal(dir.matchBank('Cash'), undefined);
  assert.equal(dir.matchBank('Household money'), undefined);
});

test('the saved bank name wins over the account name', () => {
  assert.equal(id(dir.matchBank('My salary account', 'Eastern Bank PLC')), 'eastern-bank');
  assert.equal(id(dir.matchBank('Trust Bank', 'Mutual Trust Bank PLC')), 'mtb');
  assert.equal(id(dir.findBankByName('BRAC Bank PLC')), 'brac-bank');
});

test('search covers names, short names and aliases', () => {
  const ids = q => dir.searchBanks(q).map(b => b.id);
  assert.ok(ids('dutch').includes('dutch-bangla-bank'));
  assert.ok(ids('ibbl').includes('islami-bank'));
  assert.ok(ids('nagad').includes('nagad'));
  assert.equal(ids('zzzz').length, 0);
});
