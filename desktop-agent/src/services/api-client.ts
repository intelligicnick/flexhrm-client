import Store from 'electron-store';
import { createHash } from 'crypto';
import { formatFetchError, normalizeApiBaseUrl } from './api-url';

interface AgentConfig {
  apiBaseUrl: string;
  companyKey: string;
  monitorHash: string;
  deviceName: string;
  authToken: string;
  deviceHash: string;
  agentId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  features: Record<string, boolean>;
  idle: { idleMinutes: number; longIdleMinutes: number };
  screenshot: { mode: string; intervalMinutes: number; blurSensitiveData?: boolean; disabledApps?: string[]; captureActiveWindowOnly?: boolean };
  keyboard?: { trackKeystrokes: boolean; trackMouseActivity: boolean; trackScrollActivity: boolean; summaryIntervalMinutes: number };
  blockedApps: string[];
  blockedWebsites: string[];
  workingHours?: { startTime: string; endTime: string; workDays: number[]; timezone?: string };
  liveView?: { enabled: boolean; maxSessionMinutes: number; captureIntervalSeconds: number };
  commands?: Array<{ id: string; type: string; liveViewSessionId?: string; expiresAt: string }>;
}

interface QueuedPayload {
  id: string;
  type: 'ingest' | 'screenshot' | 'heartbeat';
  payload: unknown;
  createdAt: string;
  retries: number;
}

const store = new Store<{ config: AgentConfig | null; queue: QueuedPayload[] }>({
  name: 'flexhrm-agent',
  defaults: { config: null, queue: [] },
});

export class ApiClient {
  private config: AgentConfig | null;

  constructor() {
    this.config = store.get('config');
  }

  getConfig(): AgentConfig | null {
    return this.config;
  }

  setConfig(config: AgentConfig) {
    this.config = config;
    store.set('config', config);
  }

  async revoke() {
    if (!this.config) return;
    try {
      await fetch(`${this.config.apiBaseUrl}/api/monitor/agent/revoke`, {
        method: 'POST',
        headers: this.headers(),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      /* clear local state even if server is unreachable */
    }
    this.clearConfig();
    store.set('queue', []);
  }

  clearConfig() {
    this.config = null;
    store.set('config', null);
  }

  private headers(): Record<string, string> {
    if (!this.config) throw new Error('Agent not configured');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.authToken}`,
      'X-Device-Hash': this.config.deviceHash,
    };
  }

  async testConnection(apiBaseUrl: string): Promise<{ ok: true; url: string }> {
    const base = normalizeApiBaseUrl(apiBaseUrl);
    const url = `${base}/api/monitor/agent/health`;
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        throw new Error(`Server responded with HTTP ${res.status}`);
      }
      return { ok: true, url: base };
    } catch (err) {
      throw new Error(formatFetchError(base, err));
    }
  }

  async register(body: Record<string, unknown>) {
    const base = normalizeApiBaseUrl(String(body.apiBaseUrl ?? this.config?.apiBaseUrl ?? 'http://127.0.0.1:3001'));
    const registerUrl = `${base}/api/monitor/agent/register`;
    let res: Response;
    try {
      res = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      throw new Error(formatFetchError(base, err));
    }
    if (!res.ok) {
      let err = 'Registration failed';
      try {
        const data = (await res.json()) as { message?: string | string[] };
        if (Array.isArray(data.message)) err = data.message.join(', ');
        else if (data.message) err = data.message;
      } catch {
        err = (await res.text()) || `Registration failed (HTTP ${res.status})`;
      }
      throw new Error(err);
    }
    const data = (await res.json()) as AgentConfig & { success: boolean; authToken: string };
    const config: AgentConfig = {
      apiBaseUrl: base,
      companyKey: String(body.companyKey),
      monitorHash: String(body.monitorHash ?? ''),
      deviceName: String(body.deviceName),
      authToken: data.authToken,
      deviceHash: String(body.deviceHash),
      agentId: data.agentId as string,
      employeeId: data.employeeId as string,
      employeeCode: (data.employeeCode as string) ?? '',
      employeeName: (data.employeeName as string) ?? '',
      features: (data.features as Record<string, boolean>) ?? {},
      idle: (data.idle as AgentConfig['idle']) ?? { idleMinutes: 5, longIdleMinutes: 15 },
      screenshot: (data.screenshot as AgentConfig['screenshot']) ?? { mode: 'fixed_10', intervalMinutes: 10 },
      blockedApps: (data.blockedApps as string[]) ?? [],
      blockedWebsites: (data.blockedWebsites as string[]) ?? [],
      workingHours: data.workingHours as AgentConfig['workingHours'],
      liveView: data.liveView as AgentConfig['liveView'],
      commands: (data.commands as AgentConfig['commands']) ?? [],
    };
    this.setConfig(config);
    return config;
  }

  async request(path: string, init?: RequestInit): Promise<Response> {
    if (!this.config) throw new Error('Not configured');
    const res = await fetch(`${this.config.apiBaseUrl}/api/monitor/agent${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers as Record<string, string> ?? {}) },
    });
    if (res.ok) return res;
    throw new Error(`HTTP ${res.status}`);
  }

  async heartbeat(payload: Record<string, unknown>) {
    try {
      await this.request('/heartbeat', { method: 'POST', body: JSON.stringify(payload) });
      await this.flushQueue();
    } catch {
      this.enqueue('heartbeat', payload);
    }
  }

  async ingest(payload: Record<string, unknown>) {
    try {
      await this.request('/ingest', { method: 'POST', body: JSON.stringify(payload) });
      await this.flushQueue();
    } catch {
      this.enqueue('ingest', payload);
    }
  }

  async refreshConfig(): Promise<AgentConfig | null> {
    if (!this.config) return null;
    try {
      const res = await fetch(`${this.config.apiBaseUrl}/api/monitor/agent/config`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return this.config;
      const data = await res.json() as Partial<AgentConfig> & { commands?: AgentConfig['commands'] };
      const merged: AgentConfig = {
        ...this.config,
        features: (data.features as Record<string, boolean>) ?? this.config.features,
        idle: (data.idle as AgentConfig['idle']) ?? this.config.idle,
        screenshot: (data.screenshot as AgentConfig['screenshot']) ?? this.config.screenshot,
        keyboard: (data.keyboard as AgentConfig['keyboard']) ?? this.config.keyboard,
        blockedApps: (data.blockedApps as string[]) ?? this.config.blockedApps,
        blockedWebsites: (data.blockedWebsites as string[]) ?? this.config.blockedWebsites,
        workingHours: data.workingHours ?? this.config.workingHours,
        liveView: data.liveView ?? this.config.liveView,
        commands: data.commands ?? [],
      };
      this.setConfig(merged);
      return merged;
    } catch {
      return this.config;
    }
  }

  async completeCommand(commandId: string, screenshotId?: string, failed = false) {
    try {
      await this.request(`/commands/${commandId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ screenshotId, failed }),
      });
    } catch {
      /* ignore */
    }
  }

  async uploadScreenshot(payload: Record<string, unknown>) {
    try {
      await this.request('/screenshot', { method: 'POST', body: JSON.stringify(payload) });
    } catch {
      this.enqueue('screenshot', payload);
    }
  }

  enqueue(type: QueuedPayload['type'], payload: unknown) {
    const queue = store.get('queue') ?? [];
    queue.push({
      id: createHash('sha256').update(JSON.stringify(payload) + Date.now()).digest('hex').slice(0, 16),
      type,
      payload,
      createdAt: new Date().toISOString(),
      retries: 0,
    });
    store.set('queue', queue.slice(-500));
  }

  async flushQueue() {
    const queue = store.get('queue') ?? [];
    if (!queue.length || !this.config) return;
    const remaining: QueuedPayload[] = [];
    for (const item of queue) {
      try {
        const path = item.type === 'heartbeat' ? '/heartbeat' : item.type === 'screenshot' ? '/screenshot' : '/ingest';
        const res = await fetch(`${this.config.apiBaseUrl}/api/monitor/agent${path}`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) remaining.push({ ...item, retries: item.retries + 1 });
      } catch {
        remaining.push({ ...item, retries: item.retries + 1 });
      }
    }
    store.set('queue', remaining.filter((q) => q.retries < 10));
  }
}

export const apiClient = new ApiClient();
