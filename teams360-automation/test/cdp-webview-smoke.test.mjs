import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceQworkSmokeReplySettlement,
  isQworkSmokePendingReply,
  QWORK_SMOKE_RUNNING_SELECTOR,
  readQworkSmokeChatState,
} from '../lib/cdp-webview.mjs';

test('QWork smoke reads running state from the stable composer cancel control', async () => {
  let evaluatedSource = '';
  const expectedState = { running: true };
  const state = await readQworkSmokeChatState({
    evaluate(source) {
      evaluatedSource = source;
      return expectedState;
    },
  });

  assert.deepEqual(state, expectedState);
  assert.match(QWORK_SMOKE_RUNNING_SELECTOR, /\[data-testid="composer-cancel"\]/u);
  assert.ok(evaluatedSource.includes(`const runningSelector = ${JSON.stringify(QWORK_SMOKE_RUNNING_SELECTOR)};`));
  assert.match(evaluatedSource, /running: visible\(runningSelector\)/u);
  assert.match(
    evaluatedSource,
    /lastAssistantContent\?\.innerText\s*\|\|\s*lastAssistantContent\?\.textContent/u,
    '正文 innerText 暂不可见时必须先回退正文 textContent，不能误读助手身份标题',
  );
  assert.doesNotMatch(evaluatedSource, /lastAssistantRoot\.(?:innerText|textContent)/u);
});

test('QWork smoke does not settle the loading placeholder observed before the real reply', () => {
  const placeholder = '已经接住了，正在把回应接回来\n·\n开场热身有点久，但我已经上场。';
  assert.equal(isQworkSmokePendingReply(placeholder), true);

  const result = advanceQworkSmokeReplySettlement({
    beforeAssistantCount: 0,
    state: {
      assistantCount: 1,
      lastAssistant: placeholder,
      running: false,
      sendButtonVisible: true,
    },
    stableText: placeholder,
    stableSince: 100,
    now: 10_000,
  });

  assert.equal(result.candidate, false);
  assert.equal(result.complete, false);
  assert.equal(result.pending, true);
  assert.equal(result.stableText, '');
});

test('QWork smoke waits for running=false and a stable final assistant reply', () => {
  const finalReply = 'QWORK_CORE_SMOKE_OK';
  const whileRunning = advanceQworkSmokeReplySettlement({
    beforeAssistantCount: 0,
    state: { assistantCount: 1, lastAssistant: finalReply, running: true, sendButtonVisible: false },
    now: 7_000,
  });
  assert.equal(whileRunning.complete, false);
  assert.equal(whileRunning.candidate, false);

  const stopped = advanceQworkSmokeReplySettlement({
    beforeAssistantCount: 0,
    state: { assistantCount: 1, lastAssistant: finalReply, running: false, sendButtonVisible: true },
    stableText: whileRunning.stableText,
    stableSince: whileRunning.stableSince,
    stableSamples: whileRunning.stableSamples,
    now: 7_100,
  });
  assert.equal(stopped.complete, false);
  assert.equal(stopped.candidate, true);

  const almostStable = advanceQworkSmokeReplySettlement({
    beforeAssistantCount: 0,
    state: { assistantCount: 1, lastAssistant: finalReply, running: false, sendButtonVisible: true },
    stableText: stopped.stableText,
    stableSince: stopped.stableSince,
    stableSamples: stopped.stableSamples,
    now: 8_299,
  });
  assert.equal(almostStable.complete, false);

  const settled = advanceQworkSmokeReplySettlement({
    beforeAssistantCount: 0,
    state: { assistantCount: 1, lastAssistant: finalReply, running: false, sendButtonVisible: true },
    stableText: almostStable.stableText,
    stableSince: almostStable.stableSince,
    stableSamples: almostStable.stableSamples,
    now: 8_300,
  });
  assert.equal(settled.complete, true);
  assert.equal(settled.pending, false);
});

test('QWork smoke fails closed when running state is absent', () => {
  const result = advanceQworkSmokeReplySettlement({
    beforeAssistantCount: 0,
    state: { assistantCount: 1, lastAssistant: 'QWORK_CORE_SMOKE_OK', sendButtonVisible: true },
    stableText: 'QWORK_CORE_SMOKE_OK',
    stableSince: 1,
    now: 10_000,
  });

  assert.equal(result.candidate, false);
  assert.equal(result.complete, false);
});

test('QWork smoke requires the send button to be visible again after generation', () => {
  const result = advanceQworkSmokeReplySettlement({
    beforeAssistantCount: 0,
    state: {
      assistantCount: 1,
      lastAssistant: 'QWORK_CORE_SMOKE_OK',
      running: false,
      sendButtonVisible: false,
    },
    stableText: 'QWORK_CORE_SMOKE_OK',
    stableSince: 1,
    stableSamples: 99,
    now: 10_000,
  });

  assert.equal(result.candidate, false);
  assert.equal(result.complete, false);
});
