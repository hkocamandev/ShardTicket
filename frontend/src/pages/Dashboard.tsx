import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useEvents,
  useFlags,
  useMode,
  useRedisHealth,
  useTicketsCount,
} from '../api/hooks';
import { adminApi, type AppMode, type FlagName, type SeedMode } from '../api/admin';

export default function Dashboard() {
  const events = useEvents();
  const tickets = useTicketsCount();
  const mode = useMode();
  const flags = useFlags();
  const redisHealth = useRedisHealth();
  const queryClient = useQueryClient();

  const [restarting, setRestarting] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentMode = mode.data?.mode;
  const cacheOn = flags.data?.USE_REDIS_CACHE ?? false;
  const lockOn = flags.data?.USE_REDIS_LOCK ?? false;
  const redisReady = redisHealth.data?.ready ?? false;

  const setModeMutation = useMutation({
    mutationFn: (m: AppMode) => adminApi.setMode(m),
    onSuccess: () => {
      setRestarting(true);
      setActionError(null);
    },
    onError: (err) => setActionError(extractError(err)),
  });

  // When restarting, watch mode polls — when refreshed mode matches the last
  // requested mode, the new backend process is up.
  const requestedMode = setModeMutation.variables;
  const observedMode = mode.data?.mode;
  useEffect(() => {
    if (restarting && requestedMode && observedMode === requestedMode) {
      setRestarting(false);
      setLastAction(`Mode switched to ${observedMode.toUpperCase()}`);
    }
  }, [restarting, requestedMode, observedMode]);

  const setFlagMutation = useMutation({
    mutationFn: ({ flag, value }: { flag: FlagName; value: boolean }) =>
      adminApi.setFlag(flag, value),
    onSuccess: () => {
      setRestarting(true);
      setActionError(null);
    },
    onError: (err) => setActionError(extractError(err)),
  });

  // Same restart-watch pattern as mode: end the overlay once the polled flag
  // value matches what we just asked for.
  const requestedFlag = setFlagMutation.variables;
  const observedCache = flags.data?.USE_REDIS_CACHE;
  const observedLock = flags.data?.USE_REDIS_LOCK;
  useEffect(() => {
    if (!restarting || !requestedFlag) return;
    const observed =
      requestedFlag.flag === 'USE_REDIS_CACHE' ? observedCache : observedLock;
    if (observed === requestedFlag.value) {
      setRestarting(false);
      setLastAction(
        `${requestedFlag.flag.replace('USE_REDIS_', '').toLowerCase()} ${requestedFlag.value ? 'enabled' : 'disabled'}`,
      );
    }
  }, [restarting, requestedFlag, observedCache, observedLock]);

  const seedMutation = useMutation({
    mutationFn: (m: SeedMode) => adminApi.seed(m),
    onSuccess: (_d, m) => {
      setLastAction(`Seed (${m}) completed`);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => setActionError(extractError(err)),
  });

  const shardingMutation = useMutation({
    mutationFn: () => adminApi.postSeedSharding(),
    onSuccess: () => {
      setLastAction('Post-seed sharding completed');
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'shardDistribution'] });
    },
    onError: (err) => setActionError(extractError(err)),
  });

  const resetMutation = useMutation({
    mutationFn: () => adminApi.reset(),
    onSuccess: (d) => {
      setLastAction(
        `Reset: ${d.ticketsDeleted ?? 0} tickets + ${d.eventsDeleted ?? 0} events deleted`,
      );
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => setActionError(extractError(err)),
  });

  const anyMutationPending =
    seedMutation.isPending ||
    shardingMutation.isPending ||
    resetMutation.isPending ||
    setModeMutation.isPending ||
    setFlagMutation.isPending;

  const totalRemaining = events.data?.reduce((s, e) => s + e.remainingTickets, 0);

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <span className="text-xs uppercase tracking-wider text-slate-500">
          refresh 5s
        </span>
      </header>

      <ControlPanel
        currentMode={currentMode}
        loadingMode={mode.isLoading}
        cacheOn={cacheOn}
        lockOn={lockOn}
        redisReady={redisReady}
        loadingFlags={flags.isLoading}
        onSelectMode={(m) => {
          if (m === currentMode) return;
          const proceed = confirm(
            `Switch to ${m.toUpperCase()} mode? Backend will restart (~5–10s downtime).`,
          );
          if (proceed) setModeMutation.mutate(m);
        }}
        onToggleFlag={(flag, value) => {
          setFlagMutation.mutate({ flag, value });
        }}
        onSeed={(m) => seedMutation.mutate(m)}
        onSharding={() => shardingMutation.mutate()}
        onReset={() => {
          if (confirm('Delete ALL tickets and events?')) resetMutation.mutate();
        }}
        seeding={seedMutation.isPending ? (seedMutation.variables ?? null) : null}
        sharding={shardingMutation.isPending}
        resetting={resetMutation.isPending}
        anyBusy={anyMutationPending || restarting}
      />

      {(lastAction || actionError) && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            actionError
              ? 'border-red-800 bg-red-950/40 text-red-300'
              : 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          {actionError ?? lastAction}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Tickets sold"
          value={tickets.data?.count}
          loading={tickets.isLoading}
          error={tickets.error}
        />
        <StatCard
          label="Events tracked"
          value={events.data?.length}
          loading={events.isLoading}
          error={events.error}
        />
        <StatCard
          label="Remaining inventory"
          value={totalRemaining}
          loading={events.isLoading}
          error={events.error}
        />
      </section>

      <section>
        <h3 className="mb-3 text-lg font-medium">Events</h3>
        {events.error && (
          <p className="text-sm text-red-400">Failed to load events.</p>
        )}
        {events.data && events.data.length === 0 && (
          <p className="text-sm text-slate-400">
            No events yet — click <span className="font-mono">Seed hot</span> or{' '}
            <span className="font-mono">Seed multi</span> above.
          </p>
        )}
        {events.data && events.data.length > 0 && (
          <div className="overflow-hidden rounded border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2 w-44">Sold / Total</th>
                  <th className="px-3 py-2">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {events.data.map((e) => {
                  const sold = e.totalTickets - e.remainingTickets;
                  const pct =
                    e.totalTickets > 0 ? (sold / e.totalTickets) * 100 : 0;
                  return (
                    <tr key={`${e.tenantId}/${e.eventId}`}>
                      <td className="px-3 py-2 text-slate-300">{e.tenantId}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">
                        {e.eventId}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-300">
                        {sold.toLocaleString()} /{' '}
                        {e.totalTickets.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <ProgressBar pct={pct} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {restarting && <RestartingOverlay />}
    </div>
  );
}

function ControlPanel({
  currentMode,
  loadingMode,
  cacheOn,
  lockOn,
  redisReady,
  loadingFlags,
  onSelectMode,
  onToggleFlag,
  onSeed,
  onSharding,
  onReset,
  seeding,
  sharding,
  resetting,
  anyBusy,
}: {
  currentMode: AppMode | undefined;
  loadingMode: boolean;
  cacheOn: boolean;
  lockOn: boolean;
  redisReady: boolean;
  loadingFlags: boolean;
  onSelectMode: (m: AppMode) => void;
  onToggleFlag: (flag: FlagName, value: boolean) => void;
  onSeed: (m: SeedMode) => void;
  onSharding: () => void;
  onReset: () => void;
  seeding: SeedMode | null;
  sharding: boolean;
  resetting: boolean;
  anyBusy: boolean;
}) {
  return (
    <section className="rounded border border-slate-800 bg-slate-900 p-4">
      <div className="grid gap-4 lg:grid-cols-[max-content_1fr] lg:items-start">
        <ControlGroup label="Mode">
          <div className="flex gap-2">
            <ModeBtn
              active={currentMode === 'tx'}
              onClick={() => onSelectMode('tx')}
              disabled={loadingMode || anyBusy}
            >
              TX (sharded)
            </ModeBtn>
            <ModeBtn
              active={currentMode === 'nontx'}
              onClick={() => onSelectMode('nontx')}
              disabled={loadingMode || anyBusy}
            >
              Non-TX (replica set)
            </ModeBtn>
          </div>
        </ControlGroup>

        <ControlGroup label="Redis">
          <div className="flex flex-wrap gap-2">
            <ModeBtn
              active={cacheOn}
              onClick={() => onToggleFlag('USE_REDIS_CACHE', !cacheOn)}
              disabled={loadingFlags || anyBusy || !redisReady}
            >
              Cache: {cacheOn ? 'ON' : 'OFF'}
            </ModeBtn>
            <ModeBtn
              active={lockOn}
              onClick={() => onToggleFlag('USE_REDIS_LOCK', !lockOn)}
              disabled={
                loadingFlags || anyBusy || !redisReady || currentMode === 'tx'
              }
              title={
                currentMode === 'tx'
                  ? 'TX modunda lock kullanılmaz — buyTicket transaction zaten atomik.'
                  : undefined
              }
            >
              Lock: {lockOn ? 'ON' : 'OFF'}
            </ModeBtn>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Cache wraps the admin GETs in cache-aside (5s TTL). Lock wraps the
            non-TX buy in SET NX EX + Lua release to prevent ghost tickets — TX
            mode is already atomic, so lock toggle is disabled there.
            {!redisReady && ' Redis unreachable — toggles disabled.'}
          </p>
        </ControlGroup>

        <ControlGroup label="Data">
          <div className="flex flex-wrap gap-2">
            <ActionBtn
              onClick={() => onSeed('hot')}
              pending={seeding === 'hot'}
              disabled={anyBusy}
              title="1 tenant × 1 event × 10,000 tickets — hot partition / race condition demo"
            >
              Seed hot
            </ActionBtn>
            <ActionBtn
              onClick={() => onSeed('multi')}
              pending={seeding === 'multi'}
              disabled={anyBusy || currentMode === 'nontx'}
              title={
                currentMode === 'nontx'
                  ? 'Seed multi only makes sense in TX mode (sharded). Non-TX has no sharding, and the non_transactional scenario hits a single event.'
                  : '3 tenants × 10 events × 5,000 tickets each — distributed multi-tenant workload'
              }
            >
              Seed multi
            </ActionBtn>
            <ActionBtn
              onClick={onSharding}
              pending={sharding}
              disabled={anyBusy || currentMode !== 'tx'}
              title={
                currentMode !== 'tx'
                  ? 'Sharding setup requires TX mode (mongos)'
                  : 'Enable sharding + split chunks + move tenant_2 chunk to shard2'
              }
            >
              Run post-seed sharding
            </ActionBtn>
            <ActionBtn
              onClick={onReset}
              pending={resetting}
              disabled={anyBusy}
              variant="danger"
              title="deleteMany on tickets + events. Sharding setup is preserved."
            >
              Reset (delete data)
            </ActionBtn>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Seed hot works in both modes (race / hot-partition demo). Seed
            multi and sharding setup are TX-only (require sharded cluster).
          </p>
        </ControlGroup>
      </div>
    </section>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="lg:contents">
      <div className="text-xs uppercase tracking-wider text-slate-500 lg:pt-2">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ModeBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-emerald-600 text-white'
          : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function ActionBtn({
  onClick,
  pending,
  disabled,
  title,
  variant = 'default',
  children,
}: {
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  title?: string;
  variant?: 'default' | 'danger';
  children: ReactNode;
}) {
  const base =
    'rounded px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';
  const themed =
    variant === 'danger'
      ? 'border border-red-700 text-red-300 hover:bg-red-950/50'
      : 'border border-slate-700 text-slate-300 hover:bg-slate-800';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      title={title}
      className={`${base} ${themed}`}
    >
      {pending ? 'Working…' : children}
    </button>
  );
}

function RestartingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
        <p className="text-sm text-slate-200">Backend restarting…</p>
        <p className="mt-1 text-xs text-slate-500">
          Waiting for new mode to come online (~5–10s)
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  error,
}: {
  label: string;
  value: number | undefined;
  loading?: boolean;
  error?: unknown;
}) {
  const display =
    error ? '—' : loading ? '…' : value !== undefined ? value.toLocaleString() : '—';
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-100">
        {display}
      </div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-slate-500">
        {clamped.toFixed(0)}%
      </span>
    </div>
  );
}

function extractError(err: unknown): string {
  const e = err as {
    response?: { data?: { error?: string; detail?: string; output?: string } };
    message?: string;
  };
  return (
    e.response?.data?.detail ??
    e.response?.data?.error ??
    e.message ??
    'unknown error'
  );
}
