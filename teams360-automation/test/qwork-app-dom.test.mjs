import assert from 'node:assert/strict';
import { availableTestBrowser } from '../../scripts/prepare-test-browser.mjs';
import test from 'node:test';
import { chromium } from 'playwright';
import { prepareComposer, readAppSanityState } from '../lib/qwork-app-sanity.mjs';

test('real nested message DOM counts each user once and excludes assistant identity text', async () => {
  // CI installs Chromium; local macOS can use Chrome with an isolated headless profile.
  const options = availableTestBrowser();
  assert.ok(options, 'Run npm run pretest to prepare the test browser.');
  const browser = await chromium.launch(options);
  try {
    const page = await browser.newPage();
    await page.setContent(`<div data-testid="qbot-app" data-active-session-id="qa-task">
      <div data-role="user"><div class="aui-user-message-content">one prompt</div></div>
      <div data-role="assistant" class="aui-assistant-message-root">
        <header>QWork</header><div class="aui-assistant-message-content">EXACT_OK</div>
      </div>
    </div>`);
    const client = { evaluate: (expression) => page.evaluate(expression) };
    const one = await readAppSanityState(client);
    assert.equal(one.userCount, 1);
    assert.equal(one.lastUser, 'one prompt');
    assert.equal(one.assistantCount, 1);
    assert.equal(one.lastAssistant, 'EXACT_OK');
    assert.equal(one.messageCount, 2);
    await page.evaluate(() => {
      document.querySelector('[data-testid="qbot-app"]').insertAdjacentHTML('beforeend',
        '<div data-role="user"><div class="aui-user-message-content">second prompt</div></div>');
      document.querySelector('.aui-assistant-message-content').remove();
    });
    const two = await readAppSanityState(client);
    assert.equal(two.userCount, 2);
    assert.equal(two.lastUser, 'second prompt');
    assert.equal(two.assistantCount, 0);
    assert.equal(two.lastAssistant, '');
    await page.setContent(`<div data-testid="composer-input" contenteditable="true"><span
      contenteditable="false" data-testid="composer-skill-chip-qa-skill" data-skill-name="qa-skill">QA Skill</span></div>
      <div class="aui-user-message-content"><span class="skill-reference-state"><button
      data-skill-reference-identity="qa-skill">QA Skill</button></span> read only prompt</div>`);
    const cdp = await page.context().newCDPSession(page);
    client.send = (method, args) => cdp.send(method, args);
    assert.equal(await prepareComposer(client, 'read only prompt', { skillId: 'qa-skill' }), true);
    assert.equal(await page.locator('[data-skill-name="qa-skill"]').count(), 1);
    const selected = await readAppSanityState(client);
    assert.equal(selected.composerPlainText, 'read only prompt');
    assert.equal(selected.capabilityChipCount, 1);
    assert.equal(selected.lastUserPlainText, 'read only prompt');
    assert.deepEqual(selected.lastUserSkillIds, ['qa-skill']);
    // Refuse to erase an existing draft or a different selected Skill.
    assert.equal(await prepareComposer(client, 'replacement', { skillId: 'qa-skill' }), false);
    assert.equal(await prepareComposer(client, 'replacement', { skillId: 'different' }), false);
  } finally { await browser.close(); }
});
