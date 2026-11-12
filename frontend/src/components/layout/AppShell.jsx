import { Outlet } from 'react-router-dom';

import Sidebar from './Sidebar.jsx';

export default function AppShell() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
