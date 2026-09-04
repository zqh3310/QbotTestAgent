import { createHash } from 'node:crypto';

export const QBOT_WEB_CAPABILITY_ID = 'builtin:qbot_web';

const WEB_SEARCH_FIXED_QUOTA_REJECTIONS = Object.freeze([
  /(?:最多|至多|只能|仅能|限制为|上限(?:为|是)?)\s*(?:三|3)\s*(?:次|轮)(?:\s*(?:搜索|调用))?|(?:搜索|调用|查询)(?:次数|额度|配额).{0,12}(?:用尽|耗尽|已满|不足|超限|达到上限)|固定(?:次数|额度|配额|上限)|(?:服务端|服务器).{0,12}(?:拒绝|限制)/u,
  /\b(?:(?:can|may)\s+only\s+(?:search|query|request|call)\s+(?:three|3)\s+times?|(?:only|at\s+most|no\s+more\s+than|a\s+maximum\s+of)\s+(?:three|3)\s+(?:searches|queries|requests|rounds|calls))\b/iu,
  /\b(?:search|query|request)\s*(?:quota|limit)\s+(?:(?:has|had|is|was)\s+)?(?!(?:not|never)\b)(?:(?:already|fully)\s+)?(?:been\s+)?(?:exhausted|reached|exceeded|hit|depleted|used\s+up|run\s+out)\b/iu,
  /\b(?:server|service|backend)\s+(?:(?:has|had|is|was)\s+)?(?!(?:not|never)\b)(?:rejected|refused|denied|blocked)\s+(?:(?:the|an|any)\s+)?(?:fourth|4th|another|additional|further|next)\s+(?:search|query|request|round|call)\b/iu,
  /\b(?:the\s+)?(?:fourth|4th|another|additional|further|next)\s+(?:search|query|request|round|call)\s+(?:(?:has|had|is|was)\s+)?(?!(?:not|never)\b)(?:been\s+)?(?:rejected|refused|denied|blocked)\b/iu,
]);

function withoutExplicitlyNegatedChineseQuotaClaims(text) {
  return String(text || '')
    .replace(/(?:服务端|服务器).{0,8}(?:未|没有|并未|并没有|不会|不曾)\s*(?:拒绝|限制).{0,12}(?:第?四|4)(?:次|轮)?(?:搜索|查询|调用)?/gu, '')
    .replace(/(?:未|没有|并未|并没有|不会|不曾|不存在).{0,8}(?:服务端|服务器).{0,8}(?:拒绝|限制)/gu, '')
    .replace(/(?:搜索|调用|查询)(?:次数|额度|配额).{0,8}(?:未|没有|并未|并没有|不会|不曾|不存在).{0,8}(?:用尽|耗尽|已满|不足|超限|达到上限)/gu, '')
    .replace(/(?:未|没有|并未|并没有|不会|不曾|不存在).{0,8}(?:固定)?(?:搜索|调用|查询)?(?:次数|额度|配额|上限)/gu, '');
}

export function webSearchFixedQuotaRejection(text) {
  const value = withoutExplicitlyNegatedChineseQuotaClaims(text);
  return WEB_SEARCH_FIXED_QUOTA_REJECTIONS.some((pattern) => pattern.test(value));
}

function roundToolEvidenceText(round) {
  const toolTexts = Array.isArray(round?.tool_texts)
    ? round.tool_texts.map((item) => String(item))
    : [];
  return `${toolTexts.join('\n')}\n${JSON.stringify(round?.runtime_evidence ?? null)}`;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function webSearchQuotaTraceVerdict({
  caseId = '',
  legacyCaseId = '',
  rounds = [],
} = {}) {
  const items = Array.isArray(rounds) ? rounds : [];
  const roundTaskIds = items.map((item) => String(item?.task_id || '').trim());
  const taskIds = [...new Set(roundTaskIds)];
  const promptHashes = items.map((item) => String(item?.prompt_sha256 || '').trim());
  const computedPromptHashes = items.map((item) => {
    const prompt = String(item?.prompt || '').trim();
    return prompt ? createHash('sha256').update(prompt).digest('hex') : '';
  });
  let frozenTaskId = '';
  const recomputedRounds = items.map((item) => {
    const prompt = String(item?.prompt || '').trim();
    const businessOracle = webSearchBusinessVerdict(
      String(item?.reply || ''),
      roundToolEvidenceText(item),
    );
    const runtimeAuthority = webRuntimeAuthorityVerdict({
      runtimeEvidence: item?.runtime_evidence,
      prompt,
      sendReceipts: item?.send_receipts,
      expectedTaskId: frozenTaskId,
    });
    if (!frozenTaskId && runtimeAuthority.taskId) frozenTaskId = runtimeAuthority.taskId;
    return { businessOracle, runtimeAuthority };
  });
  const providerReceiptHashes = recomputedRounds
    .map((item) => String(item.runtimeAuthority.providerReceiptHash || '').trim());
  const evidenceChecks = {
    case_id_matches: String(caseId) === 'MRSMOKE-WEB-001',
    legacy_case_id_matches: String(legacyCaseId) === 'SIT-CONN-019',
    exactly_four_rounds: items.length === 4,
    round_sequence_matches: items.length === 4 && items.every((item, index) => Number(item?.round) === index + 1),
    prompts_present_and_unique: items.length === 4
      && items.every((item) => String(item?.prompt || '').trim())
      && new Set(items.map((item) => String(item.prompt).trim())).size === 4,
    prompt_hashes_valid_and_unique: promptHashes.length === 4
      && promptHashes.every((value) => /^[a-f0-9]{64}$/iu.test(value))
      && new Set(promptHashes).size === 4,
    prompt_hashes_match_prompts: items.length === 4
      && promptHashes.every((value, index) => value === computedPromptHashes[index]),
    one_nonempty_task_for_all_rounds: items.length === 4
      && roundTaskIds.every(Boolean)
      && taskIds.length === 1
      && Boolean(taskIds[0]),
    raw_send_receipts_present_each_round: items.length === 4
      && items.every((item) => Array.isArray(item?.send_receipts) && item.send_receipts.length > 0),
    raw_runtime_evidence_present_each_round: items.length === 4
      && items.every((item) => item?.runtime_evidence
        && typeof item.runtime_evidence === 'object'
        && !Array.isArray(item.runtime_evidence)
        && item.runtime_evidence?.diagnostics
        && typeof item.runtime_evidence.diagnostics === 'object'),
    confirmed_send_bound_each_round: items.length === 4
      && recomputedRounds.every((item) => item.runtimeAuthority.checks.confirmed_send_receipt_matches === true),
    runtime_authority_bound_each_round: items.length === 4
      && recomputedRounds.every((item, index) => item.runtimeAuthority.ok === true
        && Boolean(item.runtimeAuthority.taskId)
        && item.runtimeAuthority.taskId === roundTaskIds[index]),
    post_round_idle_bound_each_round: items.length === 4
      && items.every((item, index) => item?.post_round_state?.available === true
        && item.post_round_state?.running === false
        && String(item.post_round_state?.activeId || '').trim() === roundTaskIds[index]
        && item?.timeout_cleanup_ok === true),
    reported_business_oracles_match_raw: items.length === 4
      && items.every((item, index) => sameJson(
        item?.business_oracle,
        recomputedRounds[index].businessOracle,
      )),
    reported_runtime_authorities_match_raw: items.length === 4
      && items.every((item, index) => sameJson(
        item?.runtime_authority,
        recomputedRounds[index].runtimeAuthority,
      )),
    screenshots_complete: items.length === 4 && items.every((item) => (
      String(item?.screenshot?.path || '').trim()
      && Number(item?.screenshot?.bytes) > 0
      && /^[a-f0-9]{64}$/iu.test(String(item?.screenshot?.sha256 || ''))
    )),
  };
  const fourthReply = String(items[3]?.reply || '');
  const oracleChecks = {
    provider_receipts_valid_and_unique: providerReceiptHashes.length === 4
      && providerReceiptHashes.every((value) => /^[a-f0-9]{64}$/iu.test(value))
      && new Set(providerReceiptHashes).size === 4,
    business_search_valid_each_round: items.length === 4
      && recomputedRounds.every((item) => item.businessOracle.ok === true),
    fourth_round_provider_called: items.length === 4
      && recomputedRounds[3]?.runtimeAuthority?.checks?.materialized_web_capability_observed === true
      && recomputedRounds[3]?.runtimeAuthority?.checks?.provider_receipt_hash_valid === true,
    fourth_round_has_no_fixed_quota_rejection: items.length === 4
      && !webSearchFixedQuotaRejection(fourthReply),
  };
  const evidenceValid = Object.values(evidenceChecks).every(Boolean);
  const oracleValid = evidenceValid && Object.values(oracleChecks).every(Boolean);
  return {
    schema_version: 'qbot-web-search-quota-trace/v1',
    case_id: String(caseId),
    legacy_case_id: String(legacyCaseId),
    evidence_valid: evidenceValid,
    oracle_valid: oracleValid,
    task_id: roundTaskIds.length === 4 && roundTaskIds.every(Boolean) && taskIds.length === 1 ? taskIds[0] : '',
    round_count: items.length,
    prompt_sha256s: promptHashes,
    provider_receipt_hashes: providerReceiptHashes,
    evidence_checks: evidenceChecks,
    oracle_checks: oracleChecks,
    evidence_failures: Object.entries(evidenceChecks).filter(([, ok]) => !ok).map(([name]) => name),
    oracle_failures: Object.entries(oracleChecks).filter(([, ok]) => !ok).map(([name]) => name),
    rounds: items,
  };
}

const WEB_RESULT_FIELD = /\*{0,2}\s*(官方原始链接|官方链接|原始链接|发布日期|发布时间|Published\s+date|标题|Title|日期|Date|链接|URL|摘要|Summary)\s*\*{0,2}\s*[:：]/giu;
const WEB_DATE = /\b20\d{2}\s*(?:[-/.年]\s*)\d{1,2}(?:\s*(?:[-/.月]\s*)\d{1,2}\s*日?)?/gu;
const WEB_HTTPS_URL = /https:\/\/[^\s)\]}>，。；;"']+/giu;

function webResultFieldName(label) {
  const value = String(label || '').replace(/\s+/gu, '').toLowerCase();
  if (value === '标题' || value === 'title') return 'title';
  if (['发布日期', '发布时间', '日期', 'date', 'publisheddate'].includes(value)) return 'date';
  if (['官方原始链接', '官方链接', '原始链接', '链接', 'url'].includes(value)) return 'url';
  if (value === '摘要' || value === 'summary') return 'summary';
  return '';
}

function webUrls(value) {
  return [...String(value || '').matchAll(WEB_HTTPS_URL)].map((match) => match[0]);
}

function isOfficialOpenAiUrl(value) {
  try {
    return /(^|\.)openai\.com$/iu.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function compactWebField(value) {
  return String(value || '')
    .replace(/^[\s*_`\[\](){}<>-]+/u, '')
    .replace(/[\s*_`]+$/u, '')
    .trim();
}

function webStructuredResultBlocks(reply) {
  const allFields = [...String(reply || '').matchAll(WEB_RESULT_FIELD)];
  const titleFields = allFields.filter((match) => webResultFieldName(match[1]) === 'title');
  return titleFields.map((titleField, index) => {
    const start = titleField.index;
    const end = titleFields[index + 1]?.index ?? String(reply || '').length;
    return String(reply || '').slice(start, end);
  });
}

function webStructuredResult(block, index) {
  const matches = [...String(block || '').matchAll(WEB_RESULT_FIELD)];
  const fields = {};
  for (const [fieldIndex, match] of matches.entries()) {
    const name = webResultFieldName(match[1]);
    if (!name || Object.hasOwn(fields, name)) continue;
    const start = Number(match.index) + match[0].length;
    const end = matches[fieldIndex + 1]?.index ?? String(block || '').length;
    fields[name] = compactWebField(String(block || '').slice(start, end));
  }
  const urlsInField = webUrls(fields.url);
  const officialUrlsInField = urlsInField.filter(isOfficialOpenAiUrl);
  const datesInField = [...String(fields.date || '').matchAll(WEB_DATE)].map((match) => match[0]);
  const titleText = compactWebField(fields.title).replace(/https:\/\/\S+/giu, '').trim();
  const summaryText = compactWebField(fields.summary).replace(/https:\/\/\S+/giu, '').trim();
  const checks = {
    title_present: titleText.length >= 2,
    date_present_and_bound: datesInField.length === 1,
    one_url_present_and_bound: urlsInField.length === 1,
    url_is_official_openai: officialUrlsInField.length === 1,
    summary_present: summaryText.length >= 8,
  };
  return {
    index: index + 1,
    title: titleText,
    date: datesInField[0] || '',
    official_url: officialUrlsInField[0] || '',
    summary: summaryText,
    valid: Object.values(checks).every(Boolean),
    checks,
    failures: Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name),
  };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.filter(Boolean)) {
    const normalized = String(value).trim().toLowerCase();
    if (seen.has(normalized)) duplicates.add(value);
    seen.add(normalized);
  }
  return [...duplicates];
}

export function webSearchBusinessVerdict(replyText, toolText = '') {
  const reply = String(replyText || '');
  const tools = String(toolText || '');
  const urls = webUrls(reply);
  const uniqueUrls = [...new Set(urls)];
  const officialUrls = uniqueUrls.filter(isOfficialOpenAiUrl);
  const dateEvidence = [...reply.matchAll(WEB_DATE)].length;
  const explicitShortage = /不足两条|不足\s*2\s*条|未找到足够|暂无足够|(?:只|仅)有一条|(?:只|仅)找到一条/.test(reply);
  const toolEvidence = /qbot[_-]?web|web[_-]?(?:search|crawl)|网页搜索|搜索网页|搜索/.test(tools);
  const structuredResults = webStructuredResultBlocks(reply)
    .map((block, index) => webStructuredResult(block, index));
  const validOfficialResults = structuredResults.filter((result) => result.valid);
  const duplicateOfficialUrls = duplicateValues(structuredResults.map((result) => result.official_url));
  const duplicateTitles = duplicateValues(structuredResults.map((result) => result.title));
  const checks = {
    tool_evidence_present: toolEvidence,
    at_least_two_structured_results: structuredResults.length >= 2,
    every_structured_result_complete: structuredResults.length === validOfficialResults.length,
    at_least_two_valid_official_results: validOfficialResults.length >= 2,
    official_urls_independent: duplicateOfficialUrls.length === 0,
    titles_independent: duplicateTitles.length === 0,
    no_explicit_shortage_claim: !explicitShortage,
  };
  return {
    ok: Object.values(checks).every(Boolean),
    uniqueUrls,
    officialUrls,
    dateEvidence,
    explicitShortage,
    toolEvidence,
    structuredResults,
    validOfficialResults,
    officialResultCount: validOfficialResults.length,
    duplicateOfficialUrls,
    duplicateTitles,
    checks,
    failures: Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name),
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
