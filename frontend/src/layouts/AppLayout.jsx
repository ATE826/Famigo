import { Outlet } from "react-router-dom";
import BottomNav from "../components/BottomNav/BottomNav";
import styles from "./AppLayout.module.css";

export default function AppLayout() {
  return (
    <div className={styles.layout}>
      <div className={styles.content}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
