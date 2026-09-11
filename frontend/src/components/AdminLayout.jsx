import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

const AdminLayout = () => {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-transparent">
      <Header />

      <Sidebar />

      <main className="w-full min-w-0">
        <div className="mx-auto w-full max-w-[1216px] min-w-0 px-0 pb-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;