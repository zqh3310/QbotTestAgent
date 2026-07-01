import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, writeCsv } from './fs.mjs';
import { FLOW_COLUMNS } from './automation.mjs';
import { ISSUE_SCOPE_COLUMNS } from './issue-intelligence.mjs';
import { TEST_CASE_COLUMNS } from './testcases.mjs';

export function writeTabularOutputs({ outDir, issueMatrix, issueScopeRows = [], testCases, automationFlows }) {
  const files = {};
  files.test_cases_csv = path.join(outDir, 'qbot-functional-test-cases.csv');
  files.automation_flows_csv = path.join(outDir, 'qbot-codex-automation-flows.csv');
  files.issue_matrix_csv = path.join(outDir, 'qbot-issue-matrix.csv');
  files.issue_scope_csv = path.join(outDir, 'qbot-product-issue-scope.csv');
  writeCsv(files.test_cases_csv, testCases, TEST_CASE_COLUMNS);
  writeCsv(files.automation_flows_csv, automationFlows, FLOW_COLUMNS);
  writeCsv(files.issue_matrix_csv, issueMatrix, Object.keys(issueMatrix[0] || { iid: '', title: '' }));
  writeCsv(files.issue_scope_csv, issueScopeRows, ISSUE_SCOPE_COLUMNS);

  files.workbook_xlsx = path.join(outDir, 'qbot-test-plan.xlsx');
  writeXlsx(files.workbook_xlsx, [
    { name: 'ProductIssueScope', rows: issueScopeRows, columns: ISSUE_SCOPE_COLUMNS },
    { name: 'FunctionalCases', rows: testCases, columns: TEST_CASE_COLUMNS },
    { name: 'CodexFlows', rows: automationFlows, columns: FLOW_COLUMNS },
    { name: 'IssueMatrix', rows: issueMatrix, columns: Object.keys(issueMatrix[0] || { iid: '', title: '' }) },
  ]);
  return files;
}

function writeXlsx(file, sheets) {
  ensureDir(path.dirname(file));
  const zip = new ZipWriter();
  zip.add('[Content_Types].xml', contentTypesXml(sheets.length));
  zip.add('_rels/.rels', rootRelsXml());
  zip.add('xl/workbook.xml', workbookXml(sheets));
  zip.add('xl/_rels/workbook.xml.rels', workbookRelsXml(sheets.length));
  sheets.forEach((sheet, index) => {
    zip.add(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet.rows, sheet.columns));
  });
  fs.writeFileSync(file, zip.toBuffer());
}

function worksheetXml(rows, columns) {
  const allRows = [columns, ...rows.map((row) => columns.map((column) => row[column]))];
  const xmlRows = allRows.map((values, rowIndex) => {
    const cells = values.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cellValue(value))}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return xmlHeader(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`);
}

function workbookXml(sheets) {
  const sheetXml = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  return xmlHeader(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetXml}</sheets></workbook>`);
}

function workbookRelsXml(count) {
  const rels = Array.from({ length: count }, (_, index) => {
    return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`;
  }).join('');
  return xmlHeader(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
}

function rootRelsXml() {
  return xmlHeader('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
}

function contentTypesXml(count) {
  const sheetOverrides = Array.from({ length: count }, (_, index) => {
    return `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join('');
  return xmlHeader(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}</Types>`);
}

function xmlHeader(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}

function cellValue(value) {
  if (Array.isArray(value)) return value.join('; ');
  if (value == null) return '';
  return String(value);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

function columnName(index) {
  let name = '';
  let current = index;
  while (current > 0) {
    const mod = (current - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    current = Math.floor((current - mod) / 26);
  }
  return name;
}

class ZipWriter {
  constructor() {
    this.files = [];
  }

  add(name, content) {
    const data = Buffer.from(content, 'utf8');
    this.files.push({ name, data, crc: crc32(data) });
  }

  toBuffer() {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const file of this.files) {
      const name = Buffer.from(file.name, 'utf8');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0, 6);
      local.writeUInt16LE(0, 8);
      local.writeUInt16LE(0, 10);
      local.writeUInt16LE(0, 12);
      local.writeUInt32LE(file.crc, 14);
      local.writeUInt32LE(file.data.length, 18);
      local.writeUInt32LE(file.data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);
      localParts.push(local, name, file.data);

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(0, 12);
      central.writeUInt16LE(0, 14);
      central.writeUInt32LE(file.crc, 16);
      central.writeUInt32LE(file.data.length, 20);
      central.writeUInt32LE(file.data.length, 24);
      central.writeUInt16LE(name.length, 28);
      central.writeUInt16LE(0, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38);
      central.writeUInt32LE(offset, 42);
      centralParts.push(central, name);

      offset += local.length + name.length + file.data.length;
    }

    const centralOffset = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(this.files.length, 8);
    end.writeUInt16LE(this.files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralOffset, 16);
    end.writeUInt16LE(0, 20);
    return Buffer.concat([...localParts, ...centralParts, end]);
  }
}

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
