import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import DataProvider from "./store/DataProvider.jsx";
import ThemeProvider from "./store/ThemeProvider.jsx";
import LanguageProvider from "./i18n/LanguageProvider.jsx";
import LegalProvider from "./components/LegalModal/LegalProvider.jsx";

import AppLayout from "./layouts/AppLayout.jsx";

import AuthLayout from "./layouts/AuthLayout.jsx";
import StandaloneLayout from "./layouts/StandaloneLayout.jsx";
import Verify from "./pages/Verify/Verify.jsx";
import FamilyCreate from "./pages/FamilyCreate/FamilyCreate.jsx";

import Main from "./pages/Main/Main.jsx";
import Budget from "./pages/Budget/Budget.jsx";
import BudgetAdd from "./pages/BudgetAdd/BudgetAdd.jsx";
import BudgetHistory from "./pages/BudgetHistory/BudgetHistory.jsx";
import Calendar from "./pages/Calendar/Calendar.jsx";
import CalendarCreate from "./pages/CalendarCreate/CalendarCreate.jsx";
import Chats from "./pages/Chats/Chats.jsx";
import Chat from "./pages/Chat/Chat.jsx";
import ChatInfo from "./pages/ChatInfo/ChatInfo.jsx";
import More from "./pages/More/More.jsx";
import Family from "./pages/Family/Family.jsx";
import Member from "./pages/Member/Member.jsx";
import Invite from "./pages/Invite/Invite.jsx";
import Homes from "./pages/Homes/Homes.jsx";
import HomeCreate from "./pages/HomeCreate/HomeCreate.jsx";
import House from "./pages/House/House.jsx";
import TaskCreate from "./pages/TaskCreate/TaskCreate.jsx";
import Fridge from "./pages/Fridge/Fridge.jsx";
import FridgeProduct from "./pages/FridgeProduct/FridgeProduct.jsx";
import Profile from "./pages/Profile/Profile.jsx";
import PhoneForm from "./pages/PhoneForm/PhoneForm.jsx";
import PhoneVerify from "./pages/PhoneVerify/PhoneVerify.jsx";
import ProfilePersonal from "./pages/ProfilePersonal/ProfilePersonal.jsx";
import ProfileFood from "./pages/ProfileFood/ProfileFood.jsx";
import ProfileNotifications from "./pages/ProfileNotifications/ProfileNotifications.jsx";
import ProfilePassword from "./pages/ProfilePassword/ProfilePassword.jsx";
import Notifications from "./pages/Notifications/Notifications.jsx";
import Settings from "./pages/Settings/Settings.jsx";
import Language from "./pages/Language/Language.jsx";
import Map from "./pages/Map/Map.jsx";
import Legal from "./pages/Legal/Legal.jsx";
import NotFound from "./pages/NotFound/NotFound.jsx";
import Gallery from "./pages/Gallery/Gallery.jsx";
import Premium from "./pages/Premium/Premium.jsx";
import MapPlaces from "./pages/MapPlaces/MapPlaces.jsx";
import ProfileCheckin from "./pages/ProfileCheckin/ProfileCheckin.jsx";
import Recipes from "./pages/Recipes/Recipes.jsx";
import ReceiptScan from "./pages/ReceiptScan/ReceiptScan.jsx";

function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <LanguageProvider>
          <LegalProvider>
            <BrowserRouter basename="/Famigo">
              <Routes>
                <Route element={<AuthLayout />}>
                  <Route path="/" element={null} />
                  <Route path="/register" element={null} />
                </Route>
                <Route element={<StandaloneLayout />}>
                  <Route path="/verify" element={<Verify />} />
                  <Route path="/family-create" element={<FamilyCreate />} />
                  <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
                  <Route path="/legal/:doc" element={<Legal />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route element={<AppLayout />}>
                  <Route path="/main" element={<Main />} />
                  <Route path="/budget" element={<Budget />} />
                  <Route path="/budget/history" element={<BudgetHistory />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/more" element={<More />} />
                  <Route path="/more/family" element={<Family />} />
                  <Route path="/more/family/:id" element={<Member />} />
                  <Route path="/more/homes" element={<Homes />} />
                  <Route path="/more/home/:id" element={<House />} />
                  <Route path="/more/fridge" element={<Fridge />} />
                  <Route path="/map" element={<Map />} />
                  <Route path="/map/places" element={<MapPlaces />} />
                  <Route path="/more/fridge/recipes" element={<Recipes />} />
                  <Route path="/budget/scan" element={<ReceiptScan />} />
                  <Route path="/profile/checkin" element={<ProfileCheckin />} />
                  <Route path="/gallery" element={<Gallery />} />
                  <Route path="/premium" element={<Premium />} />
                  <Route path="/budget/add" element={<BudgetAdd />} />
                  <Route path="/calendar/create" element={<CalendarCreate />} />
                  <Route path="/chats/:id" element={<Chat />} />
                  <Route path="/chats/:id/info" element={<ChatInfo />} />
                  <Route path="/more/invite" element={<Invite />} />
                  <Route path="/more/homes/add" element={<HomeCreate />} />
                  <Route path="/more/home/:id/edit" element={<HomeCreate />} />
                  <Route path="/more/home/:id/tasks/add" element={<TaskCreate />} />
                  <Route path="/more/fridge/add" element={<FridgeProduct />} />
                  <Route path="/more/fridge/:id/edit" element={<FridgeProduct />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/personal" element={<ProfilePersonal />} />
                  <Route path="/profile/food" element={<ProfileFood />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/language" element={<Language />} />
                  <Route path="/settings/notifications" element={<ProfileNotifications />} />
                  <Route path="/settings/password" element={<ProfilePassword />} />
                  <Route path="/profile/phone" element={<PhoneForm />} />
                  <Route path="/profile/phone/verify" element={<PhoneVerify />} />
                  <Route path="/notifications" element={<Notifications />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </LegalProvider>
        </LanguageProvider>
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
