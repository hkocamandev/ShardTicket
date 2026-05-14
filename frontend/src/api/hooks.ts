import { useQuery } from '@tanstack/react-query';
import { adminApi } from './admin';
import { k6Api } from './k6';

const POLL_MS = 5000;

export const useEvents = () =>
  useQuery({
    queryKey: ['admin', 'events'],
    queryFn: adminApi.events,
    refetchInterval: POLL_MS,
  });

export const useTicketsCount = () =>
  useQuery({
    queryKey: ['admin', 'ticketsCount'],
    queryFn: adminApi.ticketsCount,
    refetchInterval: POLL_MS,
  });

export const useShardDistribution = () =>
  useQuery({
    queryKey: ['admin', 'shardDistribution'],
    queryFn: adminApi.shardDistribution,
    refetchInterval: POLL_MS,
    retry: 0,
  });

export const useMode = () =>
  useQuery({
    queryKey: ['admin', 'mode'],
    queryFn: adminApi.getMode,
    refetchInterval: 1500,
    retry: 10,
    retryDelay: 1000,
  });

export const useK6Scenarios = () =>
  useQuery({
    queryKey: ['k6', 'scenarios'],
    queryFn: k6Api.scenarios,
    staleTime: Infinity,
  });

export const useK6Status = (refetchMs = 1000) =>
  useQuery({
    queryKey: ['k6', 'status'],
    queryFn: k6Api.status,
    refetchInterval: refetchMs,
  });
