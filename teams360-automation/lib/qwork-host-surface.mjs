export async function readQworkHostSurface(host) {
  return host.evaluate(() => {
    const views = [...document.querySelectorAll('webview')].filter((node) =>
      /\.deepbank\/ui\//i.test(node.getAttribute('src') || ''));
    const visible = views.filter((node) => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    return { document_visible: document.visibilityState === 'visible',
      qwork_webview_count: views.length, visible_qwork_webview_count: visible.length };
  });
}

const ready = (state) => state?.document_visible === true
  && state.qwork_webview_count === 1 && state.visible_qwork_webview_count === 1;

// A cached WebView survives switching Teams back to chat. Its DOM and CDP still
// respond, but it is not an actionable or capturable user-visible workbench.
export async function ensureQworkHostSurface(pages, { openQwork = false } = {}) {
  const hosts = pages.filter((page) => {
    try { const url = new URL(page.url()); return ['localhost', '127.0.0.1'].includes(url.hostname)
      && url.pathname === '/' && url.hash.startsWith('#/main'); } catch { return false; }
  });
  if (hosts.length !== 1) return { status: 'blocked', reason: 'unique_teams_host_not_found' };
  const host = hosts[0], before = await readQworkHostSurface(host);
  let after = before, clicked = false;
  if (!ready(before) && openQwork) {
    await host.bringToFront();
    const entry = host.locator('.sidenav-item').filter({ hasText: /^QWork$/ });
    if (await entry.count() !== 1 || !await entry.isVisible()) {
      return { status: 'blocked', reason: 'unique_visible_qwork_sidebar_entry_not_found', before };
    }
    await entry.click({ timeout: 5000 });
    clicked = true;
    for (let attempt = 0; attempt < 60; attempt++) {
      after = await readQworkHostSurface(host);
      if (ready(after)) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return { status: ready(after) ? 'ready' : 'blocked',
    reason: ready(after) ? '' : 'qwork_host_surface_hidden', before, after,
    entry_receipt: { real_sidebar_click: clicked, click_count: clicked ? 1 : 0 } };
}

export async function prepareQworkHostSurface(cdpUrl) {
  const { chromium } = await import('playwright');
  const browser = await chromium.connectOverCDP(cdpUrl);
  return ensureQworkHostSurface(browser.contexts().flatMap((context) => context.pages()), { openQwork: true });
}

export function inspectionIsReady(inspection) {
  return Boolean(inspection?.qbot_target && inspection?.host_precondition?.status === 'ready'
    && inspection?.screenshots?.qbot_target);
}
