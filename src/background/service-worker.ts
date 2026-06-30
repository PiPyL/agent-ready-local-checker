import { runLocalScan } from '../scanner/runScan';
import type { DomInsight, ScanRequest } from '../scanner/types';
import { saveScanResult } from '../storage/history';

chrome.runtime.onMessage.addListener((message: ScanRequest & { type?: string }, _sender, sendResponse) => {
  if (message?.type !== 'RUN_SCAN') return false;

  void handleRunScan(message)
    .then((result) => sendResponse({ ok: true, data: result }))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown scan error'
      });
    });

  return true;
});

async function handleRunScan(request: ScanRequest) {
  const domInsight = request.tabId ? await getDomInsight(request.tabId) : null;
  const result = await runLocalScan(request.url, domInsight);
  await saveScanResult(result);
  return result;
}

async function getDomInsight(tabId: number): Promise<DomInsight | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_DOM_INSIGHT' });
    if (response?.ok) return response.data as DomInsight;
  } catch {
    // The content script may not be available on internal pages or newly loaded tabs.
  }

  return null;
}
