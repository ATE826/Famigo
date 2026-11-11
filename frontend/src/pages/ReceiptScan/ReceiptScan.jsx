import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import FutureNotice from "../../components/FutureNotice/FutureNotice";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { parseReceipt } from "../../utils/receipt";
import styles from "./ReceiptScan.module.css";

const canDetect = typeof window !== "undefined" && "BarcodeDetector" in window;

function ReceiptScan() {
  const navigate = useNavigate();
  const { plan } = useData();
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [cameraOff, setCameraOff] = useState(!canDetect);

  function accept(raw) {
    const receipt = parseReceipt(raw);
    if (!receipt) {
      setError(t("receipt.invalid"));
      return;
    }
    navigate("/budget/add", { replace: true, state: { prefill: receipt } });
  }

  useEffect(() => {
    if (!canDetect || !plan.receipts) return undefined;
    let stream;
    let timer;
    let stopped = false;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = setInterval(async () => {
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const hit = codes.find((c) => parseReceipt(c.rawValue));
          if (hit) {
            clearInterval(timer);
            navigate("/budget/add", { replace: true, state: { prefill: parseReceipt(hit.rawValue) } });
          }
        }, 400);
      } catch {
        setCameraOff(true);
      }
    }
    start();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [navigate, plan.receipts]);

  if (!plan.receipts) return <Navigate to="/premium" state={{ reason: "receipts" }} replace />;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!canDetect) {
      setError(t("receipt.unsupported"));
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(bitmap);
      const raw = codes.find((c) => parseReceipt(c.rawValue))?.rawValue;
      if (raw) accept(raw);
      else setError(t("receipt.notFound"));
    } catch {
      setError(t("receipt.notFound"));
    }
  }

  return (
    <Page>
      <PageHeader title={t("receipt.title")} to="/budget/add" icon="close" />

      <FutureNotice />

      {!cameraOff ? (
        <div className={styles.camera}>
          <video ref={videoRef} className={styles.video} muted playsInline />
          <span className={styles.frame} />
          <p className={styles.hint}>{t("receipt.hint")}</p>
        </div>
      ) : (
        <p className={styles.notice} role="status">
          <Icon name="camera" size={18} strokeWidth={1.8} />
          {canDetect ? t("receipt.noCamera") : t("receipt.unsupported")}
        </p>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <label className={styles.upload}>
        <Icon name="upload" size={18} strokeWidth={1.8} />
        {t("receipt.upload")}
        <input type="file" accept="image/*" className={styles.file} onChange={handleFile} />
      </label>

      <form
        className={styles.manual}
        onSubmit={(e) => {
          e.preventDefault();
          accept(manual);
        }}
      >
        <label htmlFor="receipt-raw" className={styles.label}>
          {t("receipt.paste")}
        </label>
        <input
          id="receipt-raw"
          className={styles.input}
          value={manual}
          placeholder="t=20260512T1830&s=1250.00&fn=…"
          onChange={(e) => {
            setManual(e.target.value);
            setError("");
          }}
        />
        <Button type="submit" disabled={!manual.trim()}>
          {t("receipt.apply")}
        </Button>
      </form>

      <p className={styles.footnote}>{t("receipt.itemsNote")}</p>
    </Page>
  );
}

export default ReceiptScan;
