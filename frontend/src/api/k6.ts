import { apiClient } from './client';

export type K6Scenario =
  | 'hot_event'
  | 'hot_event_sharded'
  | 'non_transactional';

export type AppMode = 'tx' | 'nontx';

export interface K6ScenarioMeta {
  name: K6Scenario;
  modes: AppMode[];
}

export interface K6RunParams {
  scenario: K6Scenario;
  vus?: number;
  iterations?: number;
  duration?: string;
}

export interface K6RunResponse {
  pid: number;
  scenario: K6Scenario;
  params: { vus: number | null; iterations: number | null; duration: string | null };
  summaryPath: string;
  startedAt: string;
}

export interface K6Status {
  status: 'idle' | 'running';
  scenario: K6Scenario | null;
  params: { vus: number | null; iterations: number | null; duration: string | null } | null;
  pid: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  logTail: string[];
  summaryPath: string | null;
  lastResult: unknown;
}

export interface K6Results {
  summaryPath: string;
  summary: {
    metrics: Record<string, Record<string, number>>;
    root_group?: unknown;
  };
}

export const k6Api = {
  scenarios: () =>
    apiClient
      .get<{ scenarios: K6ScenarioMeta[] }>('/k6/scenarios')
      .then((r) => r.data.scenarios),
  status: () => apiClient.get<K6Status>('/k6/status').then((r) => r.data),
  run: (params: K6RunParams) =>
    apiClient.post<K6RunResponse>('/k6/run', params).then((r) => r.data),
  stop: () =>
    apiClient.post<{ ok: boolean }>('/k6/stop').then((r) => r.data),
  results: () => apiClient.get<K6Results>('/k6/results').then((r) => r.data),
};
