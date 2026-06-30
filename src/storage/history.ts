import type { ScanResult } from '../scanner/types';

const HISTORY_KEY = 'scanHistory';
const MAX_HISTORY_ITEMS = 30;

export async function getScanHistory(): Promise<ScanResult[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];
}

export async function saveScanResult(scanResult: ScanResult): Promise<void> {
  const history = await getScanHistory();
  const nextHistory = [scanResult, ...history.filter((item) => item.url !== scanResult.url)].slice(0, MAX_HISTORY_ITEMS);
  await chrome.storage.local.set({ [HISTORY_KEY]: nextHistory });
}

export async function clearScanHistory(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY);
}
