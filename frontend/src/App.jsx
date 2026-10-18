import { BrowserRouter, Routes, Route } from "react-router-dom";

// import Budget from "./pages/Budget/Budget.jsx";
// import Calendar from "./pages/Calendar/Calendar.jsx";
// import Chats from "./pages/Chats/Chats.jsx";
// import Family from "./pages/Family/Family.jsx";
// import House from "./pages/House/House.jsx";
import Login from "./pages/Login/Login.jsx";
import Main from "./pages/Main/Main.jsx";
// import Map from "./pages/Map/Map.jsx";
// import Notion from "./pages/Notions/Notions.jsx";
// import Profile from "./pages/Profile/Profile.jsx";
import Register from "./pages/Register/Register.jsx";
import FamilyCreate from "./pages/FamilyCreate/FamilyCreate.jsx";
import Verify from "./pages/Verify/Verify.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/family-create" element={<FamilyCreate />} />
        <Route path="/main" element={<Main />} />

        {/* <Route path="/budget" element={<Budget />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/family" element={<Family />} />
        <Route path="/house" element={<House />} />
        <Route path="/map" element={<Map />} />
        <Route path="/notion" element={<Notion />} />
        <Route path="/profile" element={<Profile />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
