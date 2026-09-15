import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

const AdminLayout = () => {
  return (
    <div className="cc-admin-layout">
      <Header />

      <Sidebar />

      <main className="cc-admin-main">
        <div className="mx-auto w-full max-w-[1216px] min-w-0 px-0 pb-0">
          <Outlet />
        </div>
      </main>

      <footer className="cc-system-footer">
        <div className="cc-system-footer-inner">
          <div className="cc-director-badge" aria-label="Director Víctor Rojas L.">
            <span className="cc-director-icon">♟</span>
            <span>Dir. Víctor Rojas L.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminLayout;