import assert from 'node:assert/strict';
import { availableTestBrowser } from '../../scripts/prepare-test-browser.mjs';
import test from 'node:test';
import { chromium } from 'playwright';
import { searchCoreCapability, dismissCoreMenus, hoverCoreExpertCard, resolveCoreExpertCard } from '../lib/qwork-core-smoke.mjs';
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
    await page.setContent(`<div role="menu"><input placeholder="搜索技能"><div
      id="option" data-testid="composer-skill-option-caveman" style="margin-top:2500px">caveman</div></div>`);
    await page.evaluate(() => {
      document.querySelector('input').addEventListener('input', () => {
        document.querySelector('#option').style.marginTop = '0';
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') document.querySelector('[role="menu"]')?.remove();
      });
    });
    const receipt = await searchCoreCapability(client, 'skill', 'caveman');
    assert.equal(receipt.search_input_confirmed, true);
    assert.equal(await page.locator('input').inputValue(), 'caveman');
    assert.ok((await page.locator('#option').boundingBox()).y < 500);
    await searchCoreCapability(client, 'skill', 'another-skill');
    assert.equal(await page.locator('input').inputValue(), 'another-skill');
    await dismissCoreMenus(client);
    assert.equal(await page.locator('[role="menu"]').count(), 0);
    await page.setContent('<style>.card .actions{opacity:0;pointer-events:none}.card:hover .actions{opacity:1;pointer-events:auto}</style><div class="card" style="width:300px;height:200px"><button class="actions">召唤</button></div>');
    await hoverCoreExpertCard(client, '.card');
    assert.equal(await page.locator('.actions').evaluate((node) => getComputedStyle(node).pointerEvents), 'auto');
    await page.setContent(`<style>
      .exp-card {width:300px;height:180px;position:relative}
      .exp-card-actions {opacity:0;pointer-events:none}
      .exp-card:hover .exp-card-actions {opacity:1;pointer-events:auto}
      [data-testid="experts-recommended"] .exp-card-actions {display:none}
      </style>
      <section data-testid="experts-recommended"><div class="exp-card" data-testid="expert-card-qa">
        Recommended duplicate<div class="exp-card-actions"><button class="exp-card-summon">召唤</button></div></div></section>
      <section data-testid="experts-market"><div class="exp-card" data-testid="expert-card-qa">
        Market card<div class="exp-card-actions"><button class="exp-card-summon">召唤</button></div></div></section>`);
    const market = await resolveCoreExpertCard(client, 'qa');
    assert.match(market, /experts-market/);
    await hoverCoreExpertCard(client, market);
    assert.equal(await page.locator(`${market} .exp-card-actions`).evaluate(node => getComputedStyle(node).pointerEvents), 'auto');
    await page.locator(`${market} .exp-card-summon`).click();
    await page.locator('[data-testid="experts-market"]').evaluate(node => node.remove());
    await assert.rejects(resolveCoreExpertCard(client, 'qa'), /available summon action/);
  } finally { await browser.close(); }
});
