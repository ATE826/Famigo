import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GeoConsentDialog from "../components/GeoConsent/GeoConsentDialog";
import { useData } from "../store/DataContext";

export default function useGeoSharing() {
  const { members, currentUserId, sharing, setSharing, updateMember, plan } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const me = members.find((m) => m.id === currentUserId);
  const on = plan.geo && sharing[currentUserId] !== false;

  function setConsent(value) {
    updateMember(currentUserId, { consents: { ...me?.consents, geo: value } });
  }

  function request(value) {
    if (value && !plan.geo) {
      navigate("/premium", { state: { reason: "geo" } });
    } else if (!value) {
      setSharing(false);
      setConsent(null);
    } else if (me?.consents?.geo) {
      setSharing(true);
    } else {
      setOpen(true);
    }
  }

  function confirm() {
    setConsent(new Date().toISOString());
    setSharing(true);
    setOpen(false);
  }

  const dialog = open ? <GeoConsentDialog onConfirm={confirm} onCancel={() => setOpen(false)} /> : null;

  return { on, request, dialog, allowed: plan.geo };
}
