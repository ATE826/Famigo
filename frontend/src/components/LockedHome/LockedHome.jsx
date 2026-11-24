import Page from "../Page/Page";
import PageHeader from "../PageHeader/PageHeader";
import Paywall from "../Paywall/Paywall";
import { t } from "../../i18n";

export default function LockedHome({ home }) {
  return <Page>
    <PageHeader title={home.name} to="/more/homes" />
    <Paywall title={t("homeAccess.title")} text={t("homeAccess.text")}
      cta={t("homes.upgrade")} reason="homes" />
  </Page>;
}
