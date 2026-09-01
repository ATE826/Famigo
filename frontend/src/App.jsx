import { BrowserRouter, Routes, Route } from "react-router-dom";

// import Budget from "./pages/Budget.jsx";
// import Calendar from "./pages/Calendar.jsx";
// import Chats from "./pages/Chats.jsx";
// import Family from "./pages/Family.jsx";
// import House from "./pages/House.jsx";
import Login from "./pages/Login.jsx";
// import Main from "./pages/Main.jsx";
// import Map from "./pages/Map.jsx";
// import Notion from "./pages/Notions.jsx";
// import Profile from "./pages/Profile.jsx";
// import Register from "./pages/Register.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* <Route path="/budget" element={<Budget />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/family" element={<Family />} />
        <Route path="/house" element={<House />} />
        <Route path="/main" element={<Main />} />
        <Route path="/map" element={<Map />} />
        <Route path="/notion" element={<Notion />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/register" element={<Register />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
