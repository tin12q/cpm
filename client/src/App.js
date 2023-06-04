import logo from "./logo.svg";
import "./App.css";
import CardList from "./components/card.js";
import Sidebar from "./components/sidebar.js";
import SignIn from "./pages/signIn.js";
import { Routes, Route } from "react-router-dom";
function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route
        path="/"
        element={
          <div>
            <Sidebar />
          </div>
        }
      />
      <Route
        path="/ecom"
        element={
          <div>
            <Sidebar />

          </div>
        }
      />
      <Route
        path="/analytics"
        element={
          <div>
            <Sidebar />
            <h1>analytics</h1>
          </div>
        }
      />
    </Routes>
  );
}

export default App;
