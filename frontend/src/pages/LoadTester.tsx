import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useK6Scenarios, useK6Status, useMode } from '../api/hooks';
import { k6Api, type K6Scenario } from '../api/k6';

type SummaryShape = {
  metrics?: Record<string, Record<string, number>>;
};

export default function LoadTester() {
  const scenarios = useK6Scenarios();
  const status = useK6Status(1000);
  const mode = useMode();
  const queryClient = useQueryClient();

  const isRunning = status.data?.status === 'running';
  const currentMode = mode.data?.mode;

  const availableScenarios = useMemo(
    () =>
      (scenarios.data ?? []).filter(
        (s) => !currentMode || s.modes.includes(currentMode),
      ),
    [scenarios.data, currentMode],
  );

  const [scenario, setScenario] = useState<K6Scenario>('hot_event');
  const [vus, setVus] = useState('20');
  const [iterations, setIterations] = useState('');
  const [duration, setDuration] = useState('30s');

  // Reset scenario if it's no longer valid for the current mode.
  useEffect(() => {
    if (availableScenarios.length === 0) return;
    const ok = availableScenarios.some((s) => s.name === scenario);
    if (!ok) setScenario(availableScenarios[0].name);
  }, [availableScenarios, scenario]);

  const runMutation = useMutation({
    mutationFn: k6Api.run,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['k6', 'status'] }),
  });

  const stopMutation = useMutation({
    mutationFn: k6Api.stop,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['k6', 'status'] }),
  });

  const logRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [status.data?.logTail]);

  const handleRun = () => {
    runMutation.reset();
    runMutation.mutate({
      scenario,
      vus: vus ? Number(vus) : undefined,
      iterations: iterations ? Number(iterations) : undefined,
      duration: duration || undefined,
    });
  };

  const summary = status.data?.lastResult as SummaryShape | null | undefined;
  const m = summary?.metrics;

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold">Load Tester</h2>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              isRunning ? 'animate-pulse bg-emerald-500' : 'bg-slate-600'
            }`}
          />
          <span className="uppercase tracking-wider text-slate-500">
            {isRunning ? 'Running' : 'Idle'}
          </span>
        </div>
      </header>

      <section className="rounded border border-slate-800 bg-slate-900 p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label={`Scenario  ${currentMode ? `(${currentMode} mode)` : ''}`}>
            <select
              className={inputCls}
              value={scenario}
              onChange={(e) => setScenario(e.target.value as K6Scenario)}
              disabled={isRunning || availableScenarios.length === 0}
            >
              {availableScenarios.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="VUs">
            <input
              type="number"
              min={1}
              className={inputCls}
              value={vus}
              onChange={(e) => setVus(e.target.value)}
              disabled={isRunning}
            />
          </Field>
          <Field label="Iterations">
            <input
              type="number"
              min={1}
              className={inputCls}
              value={iterations}
              onChange={(e) => setIterations(e.target.value)}
              disabled={isRunning}
            />
          </Field>
          <Field label="Duration (e.g. 30s)">
            <input
              type="text"
              placeholder="optional"
              className={inputCls}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={isRunning}
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning || runMutation.isPending}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runMutation.isPending ? 'Starting…' : 'Run'}
          </button>
          <button
            type="button"
            onClick={() => stopMutation.mutate()}
            disabled={!isRunning || stopMutation.isPending}
            className="rounded border border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Stop
          </button>
          {runMutation.error && (
            <span className="text-xs text-red-400">
              {extractError(runMutation.error)}
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Run state">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <Row k="Status" v={status.data?.status ?? '—'} />
            <Row k="Scenario" v={status.data?.scenario ?? '—'} />
            <Row k="PID" v={status.data?.pid?.toString() ?? '—'} />
            <Row k="Started" v={status.data?.startedAt ?? '—'} mono />
            <Row k="Finished" v={status.data?.finishedAt ?? '—'} mono />
            <Row k="Exit code" v={status.data?.exitCode?.toString() ?? '—'} />
          </dl>
        </Panel>

        <Panel title="Last result">
          {m ? (
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
              <Row k="success" v={fmt(m.success?.count)} />
              <Row k="conflict" v={fmt(m.conflict?.count)} />
              <Row k="error" v={fmt(m.error?.count)} />
              <Row k="iterations" v={fmt(m.iterations?.count)} />
              <Row k="http p95 (ms)" v={fmt(m.http_req_duration?.['p(95)'], 1)} />
              <Row k="http avg (ms)" v={fmt(m.http_req_duration?.avg, 1)} />
            </dl>
          ) : (
            <p className="text-sm text-slate-400">No result yet.</p>
          )}
        </Panel>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">
          Log
        </h3>
        <pre
          ref={logRef}
          className="h-72 overflow-auto rounded border border-slate-800 bg-black p-3 font-mono text-xs leading-relaxed text-slate-300"
        >
          {status.data?.logTail?.length
            ? status.data.logTail.join('\n')
            : '(no output)'}
        </pre>
      </section>
    </div>
  );
}

const inputCls =
  'w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className={mono ? 'font-mono text-xs text-slate-300' : 'text-slate-300'}>
        {v}
      </dd>
    </>
  );
}

function fmt(n: number | undefined, digits = 0): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return digits > 0 ? n.toFixed(digits) : n.toLocaleString();
}

function extractError(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e.response?.data?.error ?? e.message ?? 'unknown error';
}
