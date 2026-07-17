import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BUTTON_SELECTOR = '[data-testid="composer-add-attachment"]';
const DOCUMENT_BUTTON_SELECTOR = '[data-testid="composer-add-document"]';
const DOCUMENT_EXTENSIONS = new Set([
  '.csv',
  '.docx',
  '.htm',
  '.html',
  '.js',
  '.json',
  '.md',
  '.markdown',
  '.pdf',
  '.pptx',
  '.ts',
  '.txt',
  '.xls',
  '.xlsx',
]);
const IMAGE_EXTENSIONS = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS]);
const INLINE_TEXT_EXTENSIONS = new Set(['.csv', '.htm', '.html', '.js', '.json', '.md', '.markdown', '.ts', '.txt']);

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
  const unsupported = existing.filter((file) => !SUPPORTED_ATTACHMENT_EXTENSIONS.has(path.extname(file).toLowerCase()));
  if (unsupported.length) {
    return {
      status: 'blocked',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'attachment-type-precheck',
      reason: `当前 E2E 附件桥不支持这些附件类型：${unsupported.map((file) => path.extname(file).toLowerCase() || path.basename(file)).join(', ')}；未进入产品附件处理链路。`,
    };
  }

  const staged = await uploadViaElectronUnifiedAttachmentBridge(page, existing, missing);
  if (staged.status !== 'not_available') {
    if (staged.status === 'failed' && /暂不支持的附件类型|unsupported/i.test(String(staged.reason || '')) && existing.every(isInlineTextFile)) {
      const inlineText = await uploadViaInlineTextComposer(page, existing, missing);
      return inlineText.status === 'passed' ? inlineText : bestUploadAttempt([staged, inlineText], existing, missing);
    }
    return staged;
  }

  const documentFiles = existing.filter(isDocumentFile);
  const genericFiles = existing.filter((file) => !isDocumentFile(file));

  if (documentFiles.length) {
    const staged = await uploadViaElectronDocumentBridge(page, documentFiles, missing);
    if (staged.status !== 'not_available') {
      if (!genericFiles.length || staged.status !== 'passed') return staged;
    }

    const directDocuments = staged.status === 'not_available'
      ? await uploadViaDirectFileInput(page, documentFiles, missing)
      : staged;
    if (!genericFiles.length) {
      if (directDocuments.status === 'passed') return directDocuments;
      return directDocuments.status === 'not_available'
        ? {
            status: 'blocked',
            attached: [],
            missing,
            expected_names: documentFiles.map((file) => path.basename(file)),
            visible_names: [],
            method: 'document-upload-no-e2e-bridge',
            reason: '文档附件上传必须通过 Electron E2E bridge 或网页 file input；当前二者都不可用。为避免干扰用户桌面，文档类用例不再自动操作 macOS 原生文件选择框。',
            parts: [staged, directDocuments],
          }
        : directDocuments;
    }

    const genericOnly = await uploadViaGenericAttachmentEntry(page, genericFiles, [], { buttonSelector, timeoutMs });
    if (genericOnly.status === 'passed' && directDocuments.status === 'passed') {
      return mergeUploadResults([directDocuments, genericOnly], existing, missing);
    }
    return bestUploadAttempt([directDocuments, genericOnly], existing, missing);
  }

  return uploadViaGenericAttachmentEntry(page, existing, missing, { buttonSelector, timeoutMs });
}

async function uploadViaDirectFileInput(page, existing, missing) {
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
  return {
    status: 'not_available',
    attached: [],
    missing,
    expected_names: existing.map((file) => path.basename(file)),
    visible_names: [],
    method: 'input[type=file]',
    reason: '当前页面没有可直接 setInputFiles 的网页 file input。',
  };
}

async function uploadViaGenericAttachmentEntry(page, existing, missing, {
  buttonSelector,
  timeoutMs,
  allowNativeDialog = true,
} = {}) {
  const direct = await uploadViaDirectFileInput(page, existing, missing);
  if (direct.status === 'passed') return direct;

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
    const fileChooserFailure = {
      status: 'failed',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      reason: '点击附件入口后未触发网页 filechooser。',
      method: `filechooser:${buttonSelector}`,
    };
    if (!allowNativeDialog) {
      return {
        status: 'blocked',
        attached: [],
        missing,
        expected_names: existing.map((file) => path.basename(file)),
        visible_names: [],
        reason: `${fileChooserFailure.reason} 当前用例禁用 macOS 原生文件选择框兜底。`,
        method: fileChooserFailure.method,
        parts: [fileChooserFailure],
      };
    }
    const native = await uploadViaElectronNativeDialog(page, existing, missing, { buttonSelector, assumeDialogOpen: true });
    return native.status === 'passed' ? native : bestUploadAttempt([fileChooserFailure, native], existing, missing);
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

function bestUploadAttempt(results, existing, missing) {
  const passed = results.find((item) => item?.status === 'passed');
  if (passed) return passed;
  const preferred = results.find((item) => item?.status === 'blocked')
    || results.find((item) => item?.status === 'unverified')
    || results.find((item) => item?.status === 'failed')
    || results.find(Boolean);
  return {
    status: preferred?.status || 'failed',
    attached: Array.from(new Set(results.flatMap((item) => item?.attached || []))),
    missing,
    expected_names: existing.map((file) => path.basename(file)),
    visible_names: Array.from(new Set(results.flatMap((item) => item?.visible_names || []))),
    reason: results.map((item) => item?.reason).filter(Boolean).join('；') || '附件上传未完成。',
    method: results.map((item) => item?.method).filter(Boolean).join(' + '),
    parts: results.filter(Boolean),
  };
}

function isDocumentFile(file) {
  return DOCUMENT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isImageFile(file) {
  return IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isInlineTextFile(file) {
  return INLINE_TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function textContentTypeForFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv') return 'text/csv';
  if (ext === '.htm' || ext === '.html') return 'text/html';
  if (ext === '.js' || ext === '.ts') return 'text/plain';
  if (ext === '.json') return 'text/json';
  if (ext === '.md' || ext === '.markdown') return 'text/markdown';
  return 'text/plain';
}

async function electronAttachmentDiagnostics(page) {
  return page.evaluate(async () => {
    const shell = globalThis.window?.agent?.shell;
    const out = {
      hasStageAttachments: typeof shell?.stageAttachments === 'function',
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
    hasStageAttachments: false,
    hasStageDocumentAttachments: false,
    hasFeedbackDiagnostics: false,
    e2e: false,
    source: '',
    surface: '',
    error: error.message,
  }));
}

async function uploadViaInlineTextComposer(page, existing, missing) {
  const descriptors = [];
  for (const file of existing) {
    try {
      descriptors.push({
        id: `qbot-inline-text-${Date.now()}-${descriptors.length}`,
        name: path.basename(file),
        contentType: textContentTypeForFile(file),
        text: fs.readFileSync(file, 'utf8'),
      });
    } catch (error) {
      return {
        status: 'failed',
        attached: [],
        missing,
        expected_names: existing.map((item) => path.basename(item)),
        visible_names: [],
        method: 'composer.addAttachment:inline-text',
        reason: `读取文本附件失败：${path.basename(file)}：${error.message}`,
      };
    }
  }
  const added = await page.evaluate(async (items) => {
    const composer = globalThis.window?.__aui?.threads?.main?.composer
      || globalThis.window?.__aui?._thread?.composer;
    if (!composer || typeof composer.addAttachment !== 'function') {
      return { status: 'not_available', reason: 'window.__aui composer.addAttachment 不可用。' };
    }
    for (const item of items) {
      await composer.addAttachment({
        id: item.id,
        type: 'document',
        name: item.name,
        contentType: item.contentType || 'text/plain',
        content: [{ type: 'text', text: item.text || '' }],
      });
    }
    return { status: 'passed', names: items.map((item) => item.name) };
  }, descriptors).catch((error) => ({
    status: 'failed',
    reason: `直接加入文本附件失败：${error.message}`,
  }));
  if (added.status !== 'passed') {
    return {
      status: added.status || 'failed',
      attached: [],
      missing,
      expected_names: existing.map((item) => path.basename(item)),
      visible_names: [],
      method: 'composer.addAttachment:inline-text',
      reason: added.reason || '文本附件直接加入 composer 失败。',
    };
  }
  await page.waitForTimeout(1200);
  return verifyAttachmentEvidence(page, {
    status: 'passed',
    attached: existing,
    missing,
    method: 'composer.addAttachment:inline-text',
    staged_names: added.names,
  });
}

async function uploadViaElectronUnifiedAttachmentBridge(page, existing, missing) {
  const diagnostics = await electronAttachmentDiagnostics(page);
  if (!diagnostics.hasStageAttachments) {
    return {
      status: 'not_available',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-attachment-bridge',
      reason: '当前页面未暴露 window.agent.shell.stageAttachments。',
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
      method: 'electron-attachment-bridge',
      reason: 'QBot 当前不是 DEEPBANK_E2E=1 启动；附件类用例必须使用 E2E bridge 注入本机 filePaths，避免打开或操作用户桌面的原生文件框。',
      diagnostics,
    };
  }

  const direct = await stageAttachmentsDirectlyInComposer(page, existing);
  if (direct.status === 'passed') {
    await page.waitForTimeout(1200);
    return verifyAttachmentEvidence(page, {
      status: 'passed',
      attached: existing,
      missing,
      method: 'electron-attachment-bridge:stageAttachments(filePaths)+composer.addAttachment',
      diagnostics,
      staged_names: direct.names,
      staged_kinds: direct.kinds,
    });
  }
  if (direct.status === 'not_available') {
    return {
      status: 'not_available',
      attached: [],
      missing,
      expected_names: existing.map((file) => path.basename(file)),
      visible_names: [],
      method: 'electron-attachment-bridge',
      reason: direct.reason,
      diagnostics: {
        ...diagnostics,
        direct,
      },
    };
  }
  return {
    status: 'failed',
    attached: [],
    missing,
    expected_names: existing.map((file) => path.basename(file)),
    visible_names: [],
    method: 'electron-attachment-bridge',
    reason: direct.reason,
    diagnostics: {
      ...diagnostics,
      direct,
    },
  };
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

async function stageAttachmentsDirectlyInComposer(page, existing) {
  return page.evaluate(async (filePaths) => {
    const shell = globalThis.window?.agent?.shell;
    const composer = globalThis.window?.__aui?.threads?.main?.composer
      || globalThis.window?.__aui?._thread?.composer;
    if (!shell || typeof shell.stageAttachments !== 'function') {
      return { status: 'not_available', reason: 'window.agent.shell.stageAttachments 不可用。' };
    }
    if (!composer || typeof composer.addAttachment !== 'function') {
      return { status: 'not_available', reason: 'window.__aui composer.addAttachment 不可用。' };
    }
    const result = await shell.stageAttachments({ filePaths });
    if (!result || result.ok !== true) {
      return { status: 'failed', reason: result?.error || 'stageAttachments 返回失败。' };
    }
    const attachments = Array.isArray(result.attachments) ? result.attachments : [];
    if (!attachments.length) {
      return { status: 'failed', reason: 'stageAttachments 未返回任何附件。' };
    }
    const documentPrefix = 'qbot-document-attachment:';
    const descriptorFor = (attachment) => {
      // Keep this mapping identical to the product's
      // stagedAttachmentToDescriptor(). Current desktop attachments are
      // reference-first: images and text files do not carry renderer-visible
      // bytes/data URLs. Converting them to inline image/text parts here would
      // therefore manufacture an empty attachment and invalidate the E2E.
      const mimeType = attachment.contentType || 'application/octet-stream';
      const kind = attachment.kind || attachment.type || 'document';
      const payload = {
        id: attachment.id || null,
        name: attachment.name || kind,
        originalName: attachment.originalName || null,
        displayName: attachment.displayName || attachment.originalName || attachment.name || null,
        kind,
        type: attachment.type || kind,
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
      return {
        id: attachment.id,
        type: kind === 'image' ? 'image' : 'document',
        name: attachment.name || kind,
        contentType: mimeType,
        content: [{
          type: 'file',
          filename: attachment.name || kind,
          mimeType,
          data: `${documentPrefix}${JSON.stringify(payload)}`,
        }],
      };
    };
    for (const attachment of attachments) {
      await composer.addAttachment(descriptorFor(attachment));
    }
    return {
      status: 'passed',
      names: attachments.map((item) => item.name || 'attachment'),
      kinds: attachments.map((item) => item.kind || item.type || 'attachment'),
    };
  }, existing).catch((error) => ({
    status: 'failed',
    reason: `直接加入 composer 失败：${error.message}`,
  }));
}

async function uploadViaElectronNativeDialog(page, existing, missing, { buttonSelector, assumeDialogOpen = false }) {
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

  const permission = assumeDialogOpen ? { ok: true } : canUseMacSystemEvents();
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

  for (let index = 0; index < existing.length; index += 1) {
    const file = existing[index];
    if (!(assumeDialogOpen && index === 0)) {
      await button.click({ force: true });
      await page.waitForTimeout(600);
    }
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
  const attachmentControlEvidence = await visibleAttachmentControlEvidence(page, names);
  const imageTileEvidence = await visibleImageAttachmentTileEvidence(page, result.attached);
  const allVisible = names.length > 0 && visibleNames.length === names.length;
  const attachedControlVisible = names.length > 0 && attachmentControlEvidence.ok;
  const stagedNames = Array.isArray(result.staged_names) ? result.staged_names.map((name) => String(name || '')) : [];
  const allStaged = names.length > 0 && names.every((name) => stagedNames.includes(name));
  const imageTileVisible = allStaged && imageTileEvidence.ok;
  return {
    ...result,
    status: allVisible || attachedControlVisible || imageTileVisible ? 'passed' : 'unverified',
    expected_names: names,
    visible_names: visibleNames,
    attachment_control: attachedControlVisible ? attachmentControlEvidence : imageTileEvidence.ok ? imageTileEvidence : attachmentControlEvidence,
    has_remove: attachmentControlEvidence.ok || imageTileEvidence.ok,
    reason: allVisible
      ? `页面已显示附件文件名：${visibleNames.join(', ')}`
      : attachedControlVisible
        ? `页面已显示明确附件控件，说明附件已进入输入区；文件名未完整展示：${names.join(', ')}；证据：${attachmentControlEvidence.reason}`
        : imageTileVisible
          ? `图片附件已通过 Electron E2E bridge 暂存并显示缩略图卡片；文件名：${names.join(', ')}；证据：${imageTileEvidence.reason}`
      : `已尝试选择附件，但页面未完整显示附件文件名；期望：${names.join(', ')}；可见：${visibleNames.join(', ') || '无'}`,
  };
}

async function visibleAttachmentNames(page, files) {
  const body = await bodyText(page);
  const names = files.map((file) => path.basename(file));
  return names.filter((name) => body.includes(name));
}

async function visibleAttachmentControlEvidence(page, names) {
  const expectedExtensions = names
    .map((name) => path.extname(name).toLowerCase())
    .filter(Boolean);
  const expectedStems = names
    .map((name) => path.basename(name, path.extname(name)).toLowerCase())
    .filter(Boolean);
  const expectedExtensionPattern = expectedExtensions.length
    ? new RegExp(`(?:${expectedExtensions.map(escapeRegExp).join('|')})\\b`, 'i')
    : /\.(txt|md|docx?|xlsx?|pdf|pptx?|png|jpe?g|csv|json)\b/i;
  const selectors = [
    '[data-testid*="attachment"]',
    '[data-testid*="file"]',
    '[class*="attachment"]',
    '[class*="file"]',
    '[aria-label*="附件"]',
    '[aria-label*="文件"]',
    '[title*="附件"]',
    '[title*="文件"]',
  ];

  for (const selector of selectors) {
    const locators = await page.locator(selector).all().catch(() => []);
    for (const locator of locators.slice(0, 50)) {
      if (!(await locator.isVisible({ timeout: 200 }).catch(() => false))) continue;
      const text = normalize(await locator.innerText({ timeout: 300 }).catch(() => ''));
      const aria = normalize(await locator.getAttribute('aria-label').catch(() => ''));
      const title = normalize(await locator.getAttribute('title').catch(() => ''));
      const data = normalize(await locator.evaluate((el) => {
        const attrs = ['data-testid', 'data-file-name', 'data-filename', 'data-name'];
        return attrs.map((attr) => el.getAttribute(attr) || '').filter(Boolean).join(' ');
      }).catch(() => ''));
      const haystack = [text, aria, title, data].filter(Boolean).join(' ');
      if (!haystack) continue;
      const lowerHaystack = haystack.toLowerCase();
      const isStaticAddEntry = /\bcomposer-add-(attachment|document)\b/i.test(data)
        || (/添加(附件|文档)/.test(haystack) && !names.some((name) => haystack.includes(name)));
      if (isStaticAddEntry) continue;

      const hasExactName = names.some((name) => haystack.includes(name));
      const hasExpectedStemAndExtension = expectedStems.some((stem) => lowerHaystack.includes(stem))
        && expectedExtensionPattern.test(haystack);
      const hasUploadedAttachmentMarker = /uploaded|staged|attachment-chip|attachment-card|file-chip|file-card/i.test(data)
        && expectedExtensionPattern.test(haystack);
      if (hasExactName || hasExpectedStemAndExtension || hasUploadedAttachmentMarker) {
        return { ok: true, selector, reason: `附件控件包含文件线索：${haystack.slice(0, 160)}` };
      }
    }
  }

  return {
    ok: false,
    reason: '未找到包含文件名、文件扩展名或明确附件语义的可见附件控件；单独的移除按钮不再作为附件上传成功证据。',
  };
}

async function visibleImageAttachmentTileEvidence(page, files) {
  const imageFiles = files.filter(isImageFile);
  if (!imageFiles.length) {
    return {
      ok: false,
      reason: '当前附件不是图片类型。',
    };
  }
  const selectors = [
    '.aui-composer-attachments .aui-attachment-root:has(.aui-attachment-tile)',
    '.aui-composer-attachments .aui-attachment-tile[aria-label*="Image attachment"]',
    '.aui-composer-attachments [aria-label*="Image attachment"]',
  ];
  for (const selector of selectors) {
    const locators = await page.locator(selector).all().catch(() => []);
    for (const locator of locators.slice(0, 20)) {
      if (!(await locator.isVisible({ timeout: 300 }).catch(() => false))) continue;
      const haystack = normalize([
        await locator.innerText({ timeout: 300 }).catch(() => ''),
        await locator.getAttribute('aria-label').catch(() => ''),
        await locator.getAttribute('title').catch(() => ''),
        await locator.evaluate((el) => {
          const attrs = ['class', 'data-testid', 'aria-label', 'title'];
          const self = attrs.map((attr) => el.getAttribute(attr) || '').join(' ');
          const descendants = [...el.querySelectorAll('*')]
            .slice(0, 12)
            .map((child) => attrs.map((attr) => child.getAttribute(attr) || '').join(' '))
            .join(' ');
          return `${self} ${descendants}`;
        }).catch(() => ''),
      ].join(' '));
      const hasImageMarker = /Image attachment|aui-attachment-tile|aui-attachment-root|attachment-tile-image/i.test(haystack);
      const hasRemove = await locator.locator('button[aria-label*="Remove"], button[aria-label*="移除"], .aui-attachment-tile-remove').first()
        .isVisible({ timeout: 300 })
        .catch(() => false);
      if (hasImageMarker) {
        return {
          ok: true,
          selector,
          reason: `图片附件缩略图卡片可见${hasRemove ? '，且带移除按钮' : ''}：${clipText(haystack, 160)}`,
        };
      }
    }
  }
  return {
    ok: false,
    reason: '未找到可见图片附件缩略图卡片。',
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clipText(value, max = 1000) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 8)}...[截断]` : text;
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
