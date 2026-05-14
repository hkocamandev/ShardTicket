const GRAFANA_BASE =
  import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3001';
const DASHBOARD_UID = 'shardticket';

const iframeUrl = `${GRAFANA_BASE}/d/${DASHBOARD_UID}/buy-flow?orgId=1&kiosk=tv&theme=dark&refresh=5s`;
const grafanaHomeUrl = `${GRAFANA_BASE}/d/${DASHBOARD_UID}/buy-flow?orgId=1&theme=dark&refresh=5s`;

export default function Metrics() {
  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold">Metrics</h2>
        <a
          href={grafanaHomeUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs uppercase tracking-wider text-emerald-400 hover:text-emerald-300"
        >
          Open in Grafana ↗
        </a>
      </header>

      <div className="flex-1 overflow-hidden rounded border border-slate-800 bg-slate-900">
        <iframe
          title="ShardTicket Grafana dashboard"
          src={iframeUrl}
          className="h-full w-full border-0"
          style={{ minHeight: '70vh' }}
        />
      </div>

      <p className="text-xs text-slate-500">
        Embedded from {GRAFANA_BASE}. If the dashboard is blank, make sure
        Prometheus is scraping the backend and run a load test first.
      </p>
    </div>
  );
}
