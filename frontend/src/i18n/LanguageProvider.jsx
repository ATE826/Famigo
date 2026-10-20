import { Fragment, useEffect, useState } from "react";
import { applyLang, getLang } from "./index";
import { LanguageContext } from "./LanguageContext";

export default function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getLang);

  useEffect(() => {
    applyLang(lang);
  }, [lang]);

  function setLang(value) {
    applyLang(value);
    setLangState(value);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}
