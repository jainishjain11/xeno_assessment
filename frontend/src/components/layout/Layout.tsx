import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { FloatingChat } from '@/components/ai/FloatingChat';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-slate-100">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Scrollable main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Global Floating Chat Widget */}
      <FloatingChat />
    </div>
  );
}
