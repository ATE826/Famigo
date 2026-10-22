import { Outlet, matchPath, useLocation } from "react-router-dom";
import AlertBanner from "../components/AlertBanner/AlertBanner";
import BottomNav from "../components/BottomNav/BottomNav";
import PageTransition from "../components/PageTransition/PageTransition";
import Sidebar from "../components/Sidebar/Sidebar";
import TopBar from "../components/TopBar/TopBar";
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
  const withNav = NAV_PATHS.some((path) => matchPath(path, pathname));

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
    </div>
  );
}
