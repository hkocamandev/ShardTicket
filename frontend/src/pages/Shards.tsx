import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useShardDistribution } from '../api/hooks';

export default function Shards() {
  const q = useShardDistribution();

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold">Shards</h2>
        <span className="text-xs uppercase tracking-wider text-slate-500">
          refresh 5s
        </span>
      </header>

      <section>
        <h3 className="mb-3 text-lg font-medium">Cluster topology</h3>
        {q.error && (
          <p className="text-sm text-red-400">
            Failed to load shards — likely running in non-sharded mode
            (USE_TRANSACTIONS=false).
          </p>
        )}
        {q.data && q.data.shards.length === 0 && (
          <p className="text-sm text-slate-400">No shards reported.</p>
        )}
        {q.data && q.data.shards.length > 0 && (
          <div className="overflow-hidden rounded border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-32">Shard</th>
                  <th className="px-3 py-2">Host</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {q.data.shards.map((s) => (
                  <tr key={s._id}>
                    <td className="px-3 py-2 font-mono text-slate-200">
                      {s._id}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">
                      {s.host}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-medium">Tickets per tenant</h3>
        {q.data && q.data.ticketsByTenant.length === 0 && (
          <p className="text-sm text-slate-400">
            No ticket data yet — run a load test or seed the DB.
          </p>
        )}
        {q.data && q.data.ticketsByTenant.length > 0 && (
          <div className="h-80 rounded border border-slate-800 bg-slate-900 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={q.data.ticketsByTenant}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="_id" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 4,
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                  itemStyle={{ color: '#10b981' }}
                  cursor={{ fill: '#1e293b80' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
