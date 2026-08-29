import { ReactNode } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen"><Navbar /><div className="flex min-h-[calc(100vh-3.5rem)]"><Sidebar /><main className="flex-1 min-w-0">{children}</main></div></div>;
}
