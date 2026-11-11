import { Outlet } from "react-router-dom";
import PageTransition from "../components/PageTransition/PageTransition";

export default function StandaloneLayout() {
  return (
    <PageTransition>
      <Outlet />
    </PageTransition>
  );
}
