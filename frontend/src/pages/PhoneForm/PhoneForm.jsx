import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import FormScreen from "../../components/FormScreen/FormScreen";
import Input from "../../components/Input/Input";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { formatPhone } from "../../utils/validation";

function PhoneForm() {
  const navigate = useNavigate();
  const { members, currentUserId } = useData();
  const me = members.find((m) => m.id === currentUserId);
  const [phone, setPhone] = useState("");

  const hasPhone = Boolean(me?.phone);
  const complete = phone.replace(/\D/g, "").length === 11;
  const isSame = complete && phone === me?.phone;
  const valid = complete && !isSame;

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    navigate("/profile/phone/verify", { state: { phone } });
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      footer={
        <Button type="submit" disabled={!valid}>
          Подтвердить номер
        </Button>
      }
    >
      <PageHeader title={hasPhone ? "Новый номер" : "Добавить телефон"} to="/profile" icon="close" />

      <Input
        id="phone"
        label={hasPhone ? "Новый номер телефона" : "Номер телефона"}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+7(000)000-00-00"
        value={phone}
        onChange={(e) => setPhone(formatPhone(e.target.value))}
        hint={isSame ? "Это ваш текущий номер" : "Мы отправим SMS с 6-значным кодом на этот номер"}
      />
    </FormScreen>
  );
}

export default PhoneForm;
