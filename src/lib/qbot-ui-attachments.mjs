import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BUTTON_SELECTOR = '[data-testid="composer-add-attachment"]';
const DOCUMENT_BUTTON_SELECTOR = '[data-testid="composer-add-document"]';
const DOCUMENT_EXTENSIONS = new Set(['.csv', '.docx', '.json', '.md', '.markdown', '.pdf', '.pptx', '.txt', '.xls', '.xlsx']);

export async function uploadAttachmentsInComposer(page, files, {
  buttonSelector = DEFAULT_BUTTON_SELECTOR,
  timeoutMs = 4000,
} = {}) {
  const resolved = files.map((file) => path.resolve(file));
  const existing = resolved.filter((file) => fs.existsSync(file));
  const missing = resolved.filter((file) => !fs.existsSync(file));
  if (!existing.length) {
    return {
      status: 'blocked',
      attached: [],
      missing,
      expected_names: [],
      visible_names: [],
      reason: `测试附件文件不存在：${missing.join(', ') || files.join(', ')}`,
    };
  }

  const documentFiles = existing.filter(isDocumentFile);
  const genericFiles = existing.filter((file) => !isDocumentFile(file));

  if (documentFiles.length) {
    const staged = await uploadViaElectronDocumentBridge(page, documentFiles, missing);
    if (staged.status !== 'not_available' && staged.status !== 'passed') return staged;
    if (!genericFiles.length && staged.status === 'passed') return staged;
    if (!genericFiles.length && staged.status === 'not_available') {
      return uploadViaGenericAttachmentEntry(page, existing, missing, { buttonSelector, timeoutMs });
    }
    const generic = await uploadViaGenericAttachmentEntry(page, genericFiles, [], { buttonSelector, timeoutMs });
    return mergeUploadResults([staged, generic], existing, missing);
  }

  return uploadViaGenericAttachmentEntry(page, existing, missing, { buttonSelector, timeoutMs });
}

async function uploadViaGenericAttachmentEntry(page, existing, missing, { buttonSelector, timeoutMs }) {
  const directInput = page.locator('input[type="file"]').first();
  if (await directInput.count().catch(() => 0)) {
    await directInput.setInputFiles(existing);
    await page.waitForTimeout(1200);
    return verifyAttachmentEvidence(page, {
      status: 'passed',
      attached: existing,
      missing,
      method: 'input[type=file]',
    });
  }

  const button = page.locator(buttonSelector).first();
  if (!(await visible(button, 3000))) {
    return {
      status: 'failed',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      reason: `未找到附件入口：${buttonSelector}`,
    };
  }

  const chooserPromise = page.waitForEvent('filechooser', { timeout: timeoutMs }).catch(() => null);
  await button.click({ force: true });
  const chooser = await chooserPromise;
  if (!chooser) {
    const lateInput = page.locator('input[type="file"]').first();
    if (await lateInput.count().catch(() => 0)) {
      await lateInput.setInputFiles(existing);
      await page.waitForTimeout(1200);
      return verifyAttachmentEvidence(page, {
        status: 'passed',
        attached: existing,
        missing,
        method: `input[type=file]:after-click:${buttonSelector}`,
      });
    }
    return {
      status: 'failed',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      reason: '点击附件入口后未触发网页 filechooser。',
      method: `filechooser:${buttonSelector}`,
    };
  }
  await chooser.setFiles(existing);
  await page.waitForTimeout(1200);
  return verifyAttachmentEvidence(page, {
    status: 'passed',
    attached: existing,
    missing,
    method: `filechooser:${buttonSelector}`,
  });
}

function mergeUploadResults(results, existing, missing) {
  const attached = results.flatMap((item) => item.attached || []);
  const visibleNames = Array.from(new Set(results.flatMap((item) => item.visible_names || [])));
  const failed = results.find((item) => item.status !== 'passed');
  if (failed) {
    return {
      status: failed.status,
      attached,
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: visibleNames,
      reason: results.map((item) => item.reason).filter(Boolean).join('；'),
      method: results.map((item) => item.method).filter(Boolean).join(' + '),
      parts: results,
    };
  }
  return {
    status: 'passed',
    attached,
    missing,
    expected_names: existing.map((file) => path.basename(file)),
    visible_names: visibleNames,
    reason: results.map((item) => item.reason).filter(Boolean).join('；'),
    method: results.map((item) => item.method).filter(Boolean).join(' + '),
    parts: results,
  };
}

function isDocumentFile(file) {
  return DOCUMENT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function electronAttachmentDiagnostics(page) {
  return page.evaluate(async () => {
    const shell = globalThis.window?.agent?.shell;
    const out = {
      hasStageDocumentAttachments: typeof shell?.stageDocumentAttachments === 'function',
      hasFeedbackDiagnostics: typeof shell?.getFeedbackDiagnostics === 'function',
      e2e: false,
      source: '',
      surface: '',
    };
    if (out.hasFeedbackDiagnostics) {
      try {
        const diagnostics = await shell.getFeedbackDiagnostics();
        out.e2e = diagnostics?.e2e === true;
        out.source = String(diagnostics?.source || '');
        out.surface = String(diagnostics?.surface || '');
      } catch {
        // Keep defaults; diagnostics are optional.
      }
    }
    return out;
  }).catch((error) => ({
    hasStageDocumentAttachments: false,
    hasFeedbackDiagnostics: false,
    e2e: false,
    source: '',
    surface: '',
    error: error.message,
  }));
}

async function uploadViaElectronDocumentBridge(page, existing, missing) {
  const diagnostics = await electronAttachmentDiagnostics(page);
  if (!diagnostics.hasStageDocumentAttachments) {
    return {
      status: 'not_available',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-document-bridge',
      reason: '当前页面未暴露 window.agent.shell.stageDocumentAttachments。',
      diagnostics,
    };
  }
  if (!diagnostics.e2e) {
    return {
      status: 'blocked',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-document-bridge',
      reason: 'QBot 当前不是 DEEPBANK_E2E=1 启动，产品会忽略自动化传入的 filePaths。请用 release-package 自动化或本地 E2E 启动方式重启 QBot 后再执行附件/文档用例。',
      diagnostics,
    };
  }

  const direct = await stageDocumentsDirectlyInComposer(page, existing);
  if (direct.status === 'passed') {
    await page.waitForTimeout(1200);
    return verifyAttachmentEvidence(page, {
      status: 'passed',
      attached: existing,
      missing,
      method: 'electron-document-bridge:stageDocumentAttachments(filePaths)+composer.addAttachment',
      diagnostics,
      staged_names: direct.names,
    });
  }
  if (direct.status === 'failed') {
    return {
      status: 'failed',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-document-bridge',
      reason: direct.reason,
      diagnostics: {
        ...diagnostics,
        direct,
      },
    };
  }

  const button = await firstVisibleLocator(page, [
    DOCUMENT_BUTTON_SELECTOR,
    DEFAULT_BUTTON_SELECTOR,
    '[aria-label="添加附件"]',
    '[aria-label="添加文档"]',
    'button:has-text("添加附件")',
    'button:has-text("添加文档")',
    '.aui-composer-attachment',
    '.aui-composer-document-attachment',
  ]);
  if (!(await visible(button, 3000))) {
    const candidates = [
      DOCUMENT_BUTTON_SELECTOR,
      DEFAULT_BUTTON_SELECTOR,
      'aria-label=添加附件',
      'aria-label=添加文档',
      '.aui-composer-attachment',
      '.aui-composer-document-attachment',
    ];
    return {
      status: 'failed',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-document-bridge',
      reason: `未找到文档/附件入口：${candidates.join(' / ')}`,
      diagnostics,
    };
  }

  const patched = await page.evaluate((filePaths) => {
    const shell = globalThis.window?.agent?.shell;
    if (!shell || typeof shell.stageDocumentAttachments !== 'function') return false;
    if (!shell.__qbotAutomationOriginalStageDocumentAttachments) {
      Object.defineProperty(shell, '__qbotAutomationOriginalStageDocumentAttachments', {
        value: shell.stageDocumentAttachments.bind(shell),
        configurable: true,
      });
    }
    shell.stageDocumentAttachments = (options = {}) => shell.__qbotAutomationOriginalStageDocumentAttachments({
      ...options,
      filePaths,
    });
    return true;
  }, existing).catch(() => false);

  if (!patched) {
    return {
      status: 'failed',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-document-bridge',
      reason: '无法注入文档附件路径到 window.agent.shell.stageDocumentAttachments。',
      diagnostics,
    };
  }

  try {
    await button.click({ force: true });
    await page.waitForTimeout(1500);
  } finally {
    await page.evaluate(() => {
      const shell = globalThis.window?.agent?.shell;
      if (shell?.__qbotAutomationOriginalStageDocumentAttachments) {
        shell.stageDocumentAttachments = shell.__qbotAutomationOriginalStageDocumentAttachments;
        delete shell.__qbotAutomationOriginalStageDocumentAttachments;
      }
    }).catch(() => {});
  }

  return verifyAttachmentEvidence(page, {
    status: 'passed',
    attached: existing,
    missing,
    method: 'electron-document-bridge:stageDocumentAttachments(filePaths)',
    diagnostics,
  });
}

async function stageDocumentsDirectlyInComposer(page, existing) {
  return page.evaluate(async (filePaths) => {
    const shell = globalThis.window?.agent?.shell;
    const composer = globalThis.window?.__aui?.threads?.main?.composer
      || globalThis.window?.__aui?._thread?.composer;
    if (!shell || typeof shell.stageDocumentAttachments !== 'function') {
      return { status: 'not_available', reason: 'window.agent.shell.stageDocumentAttachments 不可用。' };
    }
    if (!composer || typeof composer.addAttachment !== 'function') {
      return { status: 'not_available', reason: 'window.__aui composer.addAttachment 不可用。' };
    }
    const result = await shell.stageDocumentAttachments({ filePaths });
    if (!result || result.ok !== true) {
      return { status: 'failed', reason: result?.error || 'stageDocumentAttachments 返回失败。' };
    }
    const attachments = Array.isArray(result.attachments) ? result.attachments : [];
    if (!attachments.length) {
      return { status: 'failed', reason: 'stageDocumentAttachments 未返回任何附件。' };
    }
    const prefix = 'qbot-document-attachment:';
    for (const attachment of attachments) {
      const mimeType = attachment.contentType || 'application/octet-stream';
      const payload = {
        id: attachment.id || null,
        name: attachment.name || 'document',
        kind: 'document',
        type: 'document',
        contentType: attachment.contentType || null,
        size: attachment.size ?? null,
        ext: attachment.ext || null,
        stagedPath: attachment.stagedPath || null,
        stageId: attachment.stageId || null,
        path: attachment.path || null,
        extractedPath: attachment.extractedPath || null,
        extractionStatus: attachment.extractionStatus || null,
        truncated: !!attachment.truncated,
      };
      await composer.addAttachment({
        id: attachment.id,
        type: 'document',
        name: attachment.name || 'document',
        contentType: mimeType,
        content: [{
          type: 'file',
          filename: attachment.name || 'document',
          mimeType,
          data: `${prefix}${JSON.stringify(payload)}`,
        }],
      });
    }
    return { status: 'passed', names: attachments.map((item) => item.name || 'document') };
  }, existing).catch((error) => ({
    status: 'failed',
    reason: `直接加入 composer 失败：${error.message}`,
  }));
}

async function uploadViaElectronNativeDialog(page, existing, missing, { buttonSelector }) {
  if (process.platform !== 'darwin') {
    return {
      status: 'blocked',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-native-dialog',
      reason: `检测到 QBot 使用 Electron 原生文件选择器；当前平台 ${process.platform} 的原生文件框自动化尚未接入。`,
    };
  }

  const permission = canUseMacSystemEvents();
  if (!permission.ok) {
    return {
      status: 'blocked',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-native-dialog',
      reason: [
        '检测到 QBot 使用 Electron 原生文件选择器，但当前终端没有 macOS 辅助功能按键权限。',
        `系统返回：${permission.reason}`,
        '优先解决方式：用 DEEPBANK_E2E=1 启动 QBot，让自动化通过 stageDocumentAttachments(filePaths) 直传文档；否则需要在「系统设置 > 隐私与安全性 > 辅助功能」允许当前终端/Codex/osascript 后才能操作原生文件框。',
      ].join(' '),
    };
  }

  const button = page.locator(buttonSelector).first();
  if (!(await visible(button, 3000))) {
    return {
      status: 'failed',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-native-dialog',
      reason: `未找到附件入口：${buttonSelector}`,
    };
  }

  for (const file of existing) {
    await button.click({ force: true });
    await page.waitForTimeout(600);
    const selected = selectMacNativeDialogFile(file);
    if (!selected.ok) {
      closeMacNativeDialog();
      return {
        status: 'blocked',
        attached: existing,
        missing,
        expected_names: existing.map((item) => path.basename(item)),
        visible_names: await visibleAttachmentNames(page, existing).catch(() => []),
        method: 'electron-native-dialog',
        reason: `macOS 原生文件框选择失败：${selected.reason}`,
      };
    }
    await page.waitForTimeout(1200);
  }

  return verifyAttachmentEvidence(page, {
    status: 'passed',
    attached: existing,
    missing,
    method: 'electron-native-dialog',
  });
}

function canUseMacSystemEvents() {
  try {
    execFileSync('osascript', ['-e', 'tell application "System Events" to key code 53'], {
      timeout: 3000,
      stdio: 'pipe',
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: compactError(error) };
  }
}

function selectMacNativeDialogFile(file) {
  const script = [
    'tell application "System Events"',
    'keystroke "g" using {command down, shift down}',
    'delay 0.25',
    `keystroke ${JSON.stringify(file)}`,
    'delay 0.15',
    'key code 36',
    'delay 0.45',
    'key code 36',
    'end tell',
  ].join('\n');
  try {
    execFileSync('osascript', ['-e', script], { timeout: 8000, stdio: 'pipe' });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: compactError(error) };
  }
}

function closeMacNativeDialog() {
  try {
    execFileSync('osascript', ['-e', 'tell application "System Events" to key code 53'], {
      timeout: 2000,
      stdio: 'pipe',
    });
  } catch {
    // If System Events is unavailable there is no safe non-interactive way to close the native dialog.
  }
}

function compactError(error) {
  return String(error?.stderr || error?.stdout || error?.message || error || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

async function verifyAttachmentEvidence(page, result) {
  const names = result.attached.map((file) => path.basename(file));
  const visibleNames = await visibleAttachmentNames(page, result.attached);
  const hasRemove = await page.locator([
    'button:has-text("Remove file")',
    'button[aria-label*="Remove"]',
    'button[aria-label*="移除"]',
    '[data-testid*="remove"]',
  ].join(',')).first().isVisible({ timeout: 800 }).catch(() => false);
  const allVisible = names.length > 0 && visibleNames.length === names.length;
  return {
    ...result,
    status: allVisible ? 'passed' : 'unverified',
    expected_names: names,
    visible_names: visibleNames,
    has_remove: hasRemove,
    reason: allVisible
      ? `页面已显示附件文件名：${visibleNames.join(', ')}`
      : `已尝试选择附件，但页面未完整显示附件文件名；期望：${names.join(', ')}；可见：${visibleNames.join(', ') || '无'}`,
  };
}

async function visibleAttachmentNames(page, files) {
  const body = await bodyText(page);
  const names = files.map((file) => path.basename(file));
  return names.filter((name) => body.includes(name));
}

async function firstVisibleLocator(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await visible(locator, 500)) return locator;
  }
  return page.locator(selectors[0]).first();
}

async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 8000 }).catch(() => '');
}

async function visible(locator, timeout = 1000) {
  return locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
}
