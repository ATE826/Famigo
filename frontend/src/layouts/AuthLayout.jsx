import { Navigate, useLocation } from "react-router-dom";
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import Splash from "../components/Splash/Splash";
import { useData } from "../store/DataContext";
import { t } from "../i18n";
import styles from "./AuthLayout.module.css";

export default function AuthLayout() {
  const { pathname } = useLocation();
  const mode = pathname === "/register" ? "register" : "login";
  const { status } = useData();

  // Уже вошли — сразу в приложение.
  if (status === "loading") return <Splash />;
  if (status === "ready") return <Navigate to="/main" replace />;
  if (status === "noFamily") return <Navigate to="/family-create" replace />;

  return (
    <main className={styles.shell} data-mode={mode}>
      <section className={`${styles.pane} ${styles.loginPane}`} inert={mode !== "login"}>
        <Login />
      </section>

      <section className={`${styles.pane} ${styles.registerPane}`} inert={mode !== "register"}>
        <Register />
      </section>

      <aside className={styles.panel} aria-hidden="true">
        <span className={styles.bigLetter}>F</span>
        <div className={styles.brand}>
          <span className={styles.logo}>F</span>
          <span className={styles.brandName}>Famigo</span>
        </div>
        <p className={styles.slogan}>{t("auth.slogan")}</p>
      </aside>
    </main>
  );
}
