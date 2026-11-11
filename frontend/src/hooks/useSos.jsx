import { useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog/ConfirmDialog";
import FutureNotice from "../components/FutureNotice/FutureNotice";
import { useData } from "../store/DataContext";
import { t } from "../i18n";

export default function useSos() {
  const { plan, sendSos } = useData();
  const [open, setOpen] = useState(false);

  function request() {
    setOpen(true);
  }

  const dialog = open ? (
    <ConfirmDialog
      icon="alert"
      title={t("safety.sos.title")}
      text={plan.geo ? t("safety.sos.text") : t("safety.sos.textFree")}
      cancelLabel={t("common.cancel")}
      confirmLabel={t("safety.sos.send")}
      onConfirm={() => {
        sendSos();
        setOpen(false);
      }}
      onClose={() => setOpen(false)}
    >
      <FutureNotice />
    </ConfirmDialog>
  ) : null;

  return { request, dialog };
}
