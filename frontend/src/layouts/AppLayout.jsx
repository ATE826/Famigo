import { Navigate, Outlet, matchPath, useLocation } from "react-router-dom";
import AlertBanner from "../components/AlertBanner/AlertBanner";
import BottomNav from "../components/BottomNav/BottomNav";
import PageTransition from "../components/PageTransition/PageTransition";
import Sidebar from "../components/Sidebar/Sidebar";
import TopBar from "../components/TopBar/TopBar";
import Splash from "../components/Splash/Splash";
import Toast from "../components/Toast/Toast";
import { useData } from "../store/DataContext";
import styles from "./AppLayout.module.css";

const NAV_PATHS = [
  "/main",
  "/budget",
  "/budget/history",
  "/calendar",
  "/chats",
  "/more",
  "/more/family",
  "/more/family/:id",
  "/more/homes",
  "/more/home/:id",
  "/more/fridge",
  "/map",
  "/gallery",
  "/premium",
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const { status } = useData();
  const withNav = NAV_PATHS.some((path) => matchPath(path, pathname));

  // Без входа — на экран входа, без семьи — на создание семьи.
  if (status === "loading") return <Splash />;
  if (status === "guest") return <Navigate to="/" replace />;
  if (status === "noFamily") return <Navigate to="/family-create" replace />;

  return (
    <div className={`${styles.layout} ${withNav ? styles.withNav : ""}`}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar />
        <AlertBanner />
        <div className={styles.content}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </div>
      {withNav && <BottomNav />}
      <Toast />
    </div>
  );
}
