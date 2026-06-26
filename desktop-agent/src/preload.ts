import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('flexAgent', {
  getDeviceInfo: () => ipcRenderer.invoke('agent:get-device-info'),
  testConnection: (apiBaseUrl: string) => ipcRenderer.invoke('agent:test-connection', apiBaseUrl),
  register: (payload: Record<string, unknown>) => ipcRenderer.invoke('agent:register', payload),
  revoke: () => ipcRenderer.invoke('agent:revoke'),
  getConfig: () => ipcRenderer.invoke('agent:get-config'),
  recordInput: (type: string, data?: { x?: number; y?: number }) =>
    ipcRenderer.invoke('agent:record-input', type, data),
});

declare global {
  interface Window {
    flexAgent: {
      getDeviceInfo: () => Promise<Record<string, unknown>>;
      testConnection: (apiBaseUrl: string) => Promise<{ ok: true; url: string }>;
      register: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
      revoke: () => Promise<{ success: boolean }>;
      getConfig: () => Promise<Record<string, unknown> | null>;
      recordInput: (type: string, data?: { x?: number; y?: number }) => Promise<void>;
    };
  }
}
