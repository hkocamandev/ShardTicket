import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './layout/AppShell';
import Dashboard from './pages/Dashboard';
import LoadTester from './pages/LoadTester';
import Metrics from './pages/Metrics';
import Shards from './pages/Shards';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/load-tester" element={<LoadTester />} />
        <Route path="/shards" element={<Shards />} />
        <Route path="/metrics" element={<Metrics />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
