import { NavLink } from 'react-router-dom';
import { useFlags, useMode, useRedisHealth } from '../api/hooks';

const items = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/load-tester', label: 'Load Tester' },
  { to: '/shards', label: 'Shards' },
  { to: '/metrics', label: 'Metrics' },
];

export default function Sidebar() {
  const mode = useMode();
  const flags = useFlags();
  const health = useRedisHealth();
  const redisDown = health.data?.ready === false;
  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900 p-6">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">ShardTicket</h1>
        <p className="text-xs uppercase tracking-wider text-slate-500">admin</p>
        <ModeBadge mode={mode.data?.mode} loading={mode.isLoading} />
        <FlagBadge
          label="Cache"
          on={flags.data?.USE_REDIS_CACHE}
          loading={flags.isLoading}
          redisDown={redisDown}
        />
        <FlagBadge
          label="Lock"
          on={flags.data?.USE_REDIS_LOCK}
          loading={flags.isLoading}
          redisDown={redisDown}
        />
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function ModeBadge({ mode, loading }: { mode: 'tx' | 'nontx' | undefined; loading: boolean }) {
  if (loading) {
    return <div className="mt-3 text-[10px] text-slate-600">loading mode…</div>;
  }
  if (!mode) {
    return (
      <div className="mt-3 inline-block rounded border border-red-800 bg-red-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-400">
        backend down
      </div>
    );
  }
  const isTx = mode === 'tx';
  return (
    <div
      className={`mt-3 inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        isTx
          ? 'bg-emerald-900/60 text-emerald-300'
          : 'bg-amber-900/60 text-amber-300'
      }`}
    >
      {isTx ? 'TX · sharded' : 'Non-TX · replica set'}
    </div>
  );
}

function FlagBadge({
  label,
  on,
  loading,
  redisDown,
}: {
  label: string;
  on: boolean | undefined;
  loading: boolean;
  redisDown: boolean;
}) {
  if (loading) {
    return <div className="mt-1 text-[10px] text-slate-600">loading {label.toLowerCase()}…</div>;
  }
  if (redisDown) {
    return (
      <div className="mt-1 inline-block rounded border border-red-800 bg-red-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-400">
        {label} · redis down
      </div>
    );
  }
  return (
    <div
      className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        on
          ? 'bg-sky-900/60 text-sky-300'
          : 'bg-slate-800/60 text-slate-500'
      }`}
      aria-label={`${label} flag is ${on ? 'on' : 'off'}`}
    >
      {label} · {on ? 'on' : 'off'}
    </div>
  );
}
