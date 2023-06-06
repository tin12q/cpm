import logo from "./logo.svg";
import "./App.css";
import CardList from "./components/card.js";
import Sidebar from "./components/sidebar.js";
import SignIn from "./pages/signIn.js";
import { Routes, Route } from "react-router-dom";
import { useLocation } from "react-router-dom";
import ComplexNavbar from "./components/navbar";
import Dashboard from "./pages/dashboard";
import Project from "./pages/project";


function App() {
  const location = useLocation();
  return (<>
    {location.pathname !== "/signin" && <ComplexNavbar />}
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route
        path="/"
        element={
          <Dashboard />
        }
      />
      <Route path="/projects/*">
        <Route path=":id" element={<Project/>} />
      </Route>
    </Routes>
  </>);
}

export default App;
