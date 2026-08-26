import { createHash } from 'node:crypto';

export const QBOT_WEB_CAPABILITY_ID = 'builtin:qbot_web';

export function webSearchBusinessVerdict(replyText, toolText = '') {
  const reply = String(replyText || '');
  const tools = String(toolText || '');
  const urls = [...reply.matchAll(/https:\/\/[^\s)\]}>，。；;"']+/gi)].map((match) => match[0]);
  const uniqueUrls = [...new Set(urls)];
  const officialUrls = uniqueUrls.filter((url) => {
    try {
      const parsed = new URL(url);
      return /(^|\.)openai\.com$/i.test(parsed.hostname);
    } catch {
      return false;
    }
  });
  const dateEvidence = (
    reply.match(/\b20\d{2}\s*(?:[-/.年]\s*)\d{1,2}(?:\s*(?:[-/.月]\s*)\d{1,2}\s*日?)?/g) || []
  ).length;
  const explicitShortage = /不足两条|不足\s*2\s*条|未找到足够|最近两条|暂无足够|只有一条/.test(reply);
  const toolEvidence = /qbot[_-]?web|web[_-]?(?:search|crawl)|网页搜索|搜索网页|搜索/.test(tools);
  return {
    ok: uniqueUrls.length >= 2 && officialUrls.length >= 1 && (dateEvidence >= 2 || explicitShortage) && toolEvidence,
    uniqueUrls,
    officialUrls,
    dateEvidence,
    explicitShortage,
    toolEvidence,
  };
}

export function confirmedSendTaskIdsForPrompt(sendReceipts, prompt) {
  const receipts = Array.isArray(sendReceipts)
    ? sendReceipts
    : (Array.isArray(sendReceipts?.receipts) ? sendReceipts.receipts : []);
  return [...new Set(receipts.flatMap((receipt) => {
    if (String(receipt?.prompt || '') !== prompt || !String(receipt?.confirmed_at || '').trim()) return [];
    return (receipt?.attempts || [])
      .filter((attempt) => (
        attempt?.receipt?.ok === true
        && String(attempt?.receipt?.snapshot?.activeId || '').trim()
        && (attempt?.receipt?.snapshot?.userTexts || []).some((text) => String(text) === prompt)
      ))
      .map((attempt) => String(attempt.receipt.snapshot.activeId).trim());
  }))];
}

export function webRuntimeAuthorityVerdict({
  runtimeEvidence = {},
  prompt = '',
  sendReceipts = [],
  expectedTaskId = '',
} = {}) {
  const promptText = String(prompt || '').trim();
  const promptSha256 = promptText ? createHash('sha256').update(promptText).digest('hex') : '';
  const diagnostics = runtimeEvidence?.diagnostics || {};
  const authority = diagnostics?.e2eCurrentTurnAuthority || {};
  const effectiveConnectorIds = Array.isArray(authority?.connectorRouting?.effectiveConnectorIds)
    ? authority.connectorRouting.effectiveConnectorIds.map(String)
    : [];
  const materializedConnectorIds = Array.isArray(authority?.connectorRuntimeMaterialization?.materializedConnectorIds)
    ? authority.connectorRuntimeMaterialization.materializedConnectorIds.map(String)
    : [];
  const unsupportedConnectorIds = Array.isArray(authority?.connectorRuntimeMaterialization?.unsupportedConnectorIds)
    ? authority.connectorRuntimeMaterialization.unsupportedConnectorIds.map(String)
    : [];
  const providerReceiptHash = String(authority?.providerReceiptHash || '');
  const confirmedTaskIds = confirmedSendTaskIdsForPrompt(sendReceipts, promptText);
  const confirmedTaskId = confirmedTaskIds.length === 1 ? confirmedTaskIds[0] : '';
  const taskId = String(expectedTaskId || confirmedTaskId || '').trim();
  const checks = {
    prompt_sha256_present: /^[a-f0-9]{64}$/i.test(promptSha256),
    confirmed_send_receipt_matches: Boolean(taskId) && confirmedTaskIds.length === 1 && confirmedTaskId === taskId,
    diagnostics_session_matches: Boolean(taskId) && String(diagnostics?.sessionId || '') === taskId,
    runtime_authority_ready: diagnostics?.e2eCurrentTurnAuthorityReadiness?.ready === true,
    effective_web_capability_observed: effectiveConnectorIds.includes(QBOT_WEB_CAPABILITY_ID),
    materialized_web_capability_observed: materializedConnectorIds.includes(QBOT_WEB_CAPABILITY_ID),
    web_capability_not_unsupported: !unsupportedConnectorIds.includes(QBOT_WEB_CAPABILITY_ID),
    provider_receipt_hash_valid: /^[a-f0-9]{64}$/i.test(providerReceiptHash),
  };
  return {
    ok: Object.values(checks).every(Boolean),
    taskId,
    promptSha256,
    confirmedTaskIds,
    capabilityId: QBOT_WEB_CAPABILITY_ID,
    effectiveConnectorIds,
    materializedConnectorIds,
    unsupportedConnectorIds,
    providerReceiptHash,
    routingMode: String(authority?.connectorRouting?.mode || ''),
    executionTarget: String(authority?.executionTarget || ''),
    routeTarget: String(authority?.routeTarget || ''),
    checks,
    failures: Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name),
  };
}

export function webPreviewOpenResult(result = null) {
  if (result?.ok === true && String(result?.url || '').trim()) return 'preview';
  if (String(result?.code || '') === 'external_opened') return 'external';
  return 'blocked';
}

export async function captureExternalWebLinkOutcome({ page, targetUrl, timeoutMs = 15_000 } = {}) {
  const requestedUrl = String(targetUrl || '').trim();
  if (!page || !requestedUrl) return { ok: false, reason: 'page_or_target_url_missing' };
  const links = page.locator('button.aui-md-web-link[data-href]');
  const count = await links.count().catch(() => 0);
  let link = null;
  let observedHref = '';
  for (let index = 0; index < count; index += 1) {
    const candidate = links.nth(index);
    const href = String(await candidate.getAttribute('data-href').catch(() => '') || '').trim();
    let same = href === requestedUrl;
    try { same ||= new URL(href).href === new URL(requestedUrl).href; } catch {}
    if (!same || !(await candidate.isVisible().catch(() => false))) continue;
    link = candidate;
    observedHref = href;
    break;
  }
  if (!link) return { ok: false, reason: 'visible_markdown_link_not_found', requestedUrl, linkCount: count };

  const wrapper = await page.evaluate(() => {
    const captureKey = '__qbotQaOpenPreviewCapture';
    if (window[captureKey]?.installed) return { ok: false, reason: 'capture_already_installed' };
    const originalAgent = window.agent;
    const originalShell = originalAgent?.shell;
    const originalOpenPreview = originalShell?.openPreview;
    if (typeof originalOpenPreview !== 'function') return { ok: false, reason: 'openPreview_unavailable' };
    const calls = [];
    const publicResult = (result) => ({
      ok: result?.ok === true,
      code: String(result?.code || ''),
      url: String(result?.url || ''),
      redactedUrl: String(result?.redactedUrl || ''),
      title: String(result?.title || ''),
      error: String(result?.error || ''),
    });
    const wrapped = async (...args) => {
      const startedAt = new Date().toISOString();
      try {
        const result = await Reflect.apply(originalOpenPreview, originalShell, args);
        calls.push({
          startedAt,
          finishedAt: new Date().toISOString(),
          request: {
            url: String(args[0]?.url || ''),
            title: String(args[0]?.title || ''),
            source: String(args[0]?.source || ''),
            embedMode: String(args[0]?.embedMode || ''),
            embedIntent: String(args[0]?.embedIntent || ''),
          },
          result: publicResult(result),
        });
        return result;
      } catch (error) {
        calls.push({
          startedAt,
          finishedAt: new Date().toISOString(),
          request: { url: String(args[0]?.url || ''), source: String(args[0]?.source || '') },
          error: String(error?.message || error),
        });
        throw error;
      }
    };
    let restore = null;
    try {
      const methodDescriptor = Object.getOwnPropertyDescriptor(originalShell, 'openPreview');
      if (!methodDescriptor || methodDescriptor.writable || methodDescriptor.configurable) {
        Object.defineProperty(originalShell, 'openPreview', {
          enumerable: methodDescriptor?.enumerable === true,
          configurable: true,
          writable: true,
          value: wrapped,
        });
        if (originalShell.openPreview === wrapped) {
          restore = () => {
            if (methodDescriptor) Object.defineProperty(originalShell, 'openPreview', methodDescriptor);
            else delete originalShell.openPreview;
          };
        }
      }
    } catch {}
    if (!restore) {
      try {
        const agentDescriptor = Object.getOwnPropertyDescriptor(window, 'agent');
        if (agentDescriptor?.configurable || agentDescriptor?.writable) {
          const shellProxy = new Proxy(originalShell, {
            get(target, property, receiver) {
              return property === 'openPreview' ? wrapped : Reflect.get(target, property, receiver);
            },
          });
          const agentProxy = new Proxy(originalAgent, {
            get(target, property, receiver) {
              return property === 'shell' ? shellProxy : Reflect.get(target, property, receiver);
            },
          });
          Object.defineProperty(window, 'agent', {
            enumerable: agentDescriptor?.enumerable === true,
            configurable: true,
            writable: true,
            value: agentProxy,
          });
          if (window.agent?.shell?.openPreview === wrapped) {
            restore = () => Object.defineProperty(window, 'agent', agentDescriptor);
          }
        }
      } catch {}
    }
    if (!restore) return { ok: false, reason: 'openPreview_capture_not_installable' };
    window[captureKey] = { installed: true, calls, restore };
    return { ok: true };
  });
  if (!wrapper.ok) return { ok: false, reason: wrapper.reason, requestedUrl, observedHref };

  const dialogs = [];
  const onDialog = async (dialog) => {
    const message = String(dialog.message() || '');
    const safeInformation = /无法.*预览|无法.*打开/i.test(message);
    dialogs.push({ type: dialog.type(), message, safeInformation, observedAt: new Date().toISOString() });
    if (safeInformation) await dialog.accept().catch(() => dialog.dismiss().catch(() => {}));
    else await dialog.dismiss().catch(() => {});
  };
  page.on('dialog', onDialog);
  let clickError = '';
  try {
    await link.click({ timeout: Math.min(timeoutMs, 10_000) });
    await page.waitForFunction(() => window.__qbotQaOpenPreviewCapture?.calls?.length > 0, null, { timeout: timeoutMs });
  } catch (error) {
    clickError = String(error?.message || error);
  } finally {
    page.off('dialog', onDialog);
  }
  const capture = await page.evaluate(() => {
    const current = window.__qbotQaOpenPreviewCapture;
    const calls = Array.isArray(current?.calls) ? current.calls : [];
    try { current?.restore?.(); } catch {}
    delete window.__qbotQaOpenPreviewCapture;
    return { calls };
  }).catch((error) => ({ calls: [], restoreError: String(error?.message || error) }));
  const feedbackTexts = await page.locator('[role="alert"], [role="status"], [data-testid*="toast"], [data-testid*="feedback"]').allInnerTexts().catch(() => []);
  const falseFailureFeedback = feedbackTexts.filter((text) => /无法.*预览|无法.*打开/i.test(String(text || '')));
  const call = capture.calls.at(-1) || null;
  const publicResult = webPreviewOpenResult(call?.result);
  return {
    ok: !clickError && Boolean(call),
    requestedUrl,
    observedHref,
    clickError,
    calls: capture.calls,
    dialogs,
    feedbackTexts,
    falseFailureFeedback,
    publicResult,
    resultEnumValid: ['preview', 'external', 'blocked'].includes(publicResult),
  };
}
