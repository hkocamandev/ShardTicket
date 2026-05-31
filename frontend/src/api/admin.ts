import { apiClient } from './client';

export interface EventSummary {
  tenantId: string;
  eventId: string;
  remainingTickets: number;
  totalTickets: number;
}

export interface ShardInfo {
  _id: string;
  host: string;
  state?: number;
}

export interface TenantTicketCount {
  _id: string;
  count: number;
}

export interface ShardDistribution {
  shards: ShardInfo[];
  ticketsByTenant: TenantTicketCount[];
}

export type AppMode = 'tx' | 'nontx';
export type SeedMode = 'hot' | 'multi';

export interface ModeResponse {
  mode: AppMode;
}

export type FlagName = 'USE_REDIS_CACHE' | 'USE_REDIS_LOCK';

export interface FlagsResponse {
  USE_REDIS_CACHE: boolean;
  USE_REDIS_LOCK: boolean;
}

export interface FlagSetResponse {
  flag: FlagName;
  value: boolean;
  restartingInMs: number;
}

export interface RedisHealth {
  ready: boolean;
  pong: boolean;
}

export interface ScriptResult {
  ok?: boolean;
  output?: string;
  exitCode?: number;
  ticketsDeleted?: number;
  eventsDeleted?: number;
}

export const adminApi = {
  events: () =>
    apiClient.get<EventSummary[]>('/admin/events').then((r) => r.data),
  ticketsCount: () =>
    apiClient.get<{ count: number }>('/admin/tickets/count').then((r) => r.data),
  shardDistribution: () =>
    apiClient
      .get<ShardDistribution>('/admin/shard-distribution')
      .then((r) => r.data),

  getMode: () =>
    apiClient.get<ModeResponse>('/admin/mode').then((r) => r.data),
  setMode: (mode: AppMode) =>
    apiClient.post<{ mode: AppMode; restartingInMs: number }>('/admin/mode', { mode })
      .then((r) => r.data),

  seed: (mode: SeedMode) =>
    apiClient.post<ScriptResult>('/admin/seed', { mode }).then((r) => r.data),
  postSeedSharding: () =>
    apiClient.post<ScriptResult>('/admin/sharding/post-seed').then((r) => r.data),
  reset: () =>
    apiClient.post<ScriptResult>('/admin/reset').then((r) => r.data),

  getFlags: () =>
    apiClient.get<FlagsResponse>('/admin/flags').then((r) => r.data),
  setFlag: (flag: FlagName, value: boolean) =>
    apiClient
      .post<FlagSetResponse>('/admin/flags', { flag, value })
      .then((r) => r.data),
  redisHealth: () =>
    apiClient.get<RedisHealth>('/admin/redis/health').then((r) => r.data),
};
