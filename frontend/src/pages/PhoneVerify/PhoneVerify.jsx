import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import styles from "./PhoneVerify.module.css";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

function PhoneVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUserId, updateMember } = useData();
  const phone = location.state?.phone;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  if (!phone) {
    return <Navigate to="/profile/phone" replace />;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError(t("auth.codeDigits", { count: CODE_LENGTH }));
      return;
    }
    updateMember(currentUserId, { phone, phoneVerified: true });
    navigate("/profile", { replace: true });
  }

  return (
    <FormScreen onSubmit={handleSubmit} footer={<Button type="submit">{t("common.confirm")}</Button>}>
      <PageHeader title={t("phone.verifyTitle")} to="/profile/phone" />

      <p className={styles.text}>
        {t("phone.sent", { count: CODE_LENGTH })} <b>{phone}</b>
      </p>

      <Input
        id="code"
        label={t("phone.code")}
        type="text"
        inputMode="numeric"
        numeric
        autoComplete="one-time-code"
        placeholder="000000"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
          setError("");
        }}
        hint={error}
      />

      <button
        type="button"
        className={styles.resend}
        disabled={seconds > 0}
        onClick={() => setSeconds(RESEND_SECONDS)}
      >
        {seconds > 0 ? t("phone.resendIn", { count: seconds }) : t("phone.resend")}
      </button>
    </FormScreen>
  );
}

export default PhoneVerify;
