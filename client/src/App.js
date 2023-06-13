import logo from "./logo.svg";
import "./App.css";
import SignIn from "./pages/signIn.js";
import { Routes, Route } from "react-router-dom";
import { useLocation } from "react-router-dom";
import ComplexNavbar from "./components/navbar";
import Dashboard from "./pages/dashboard";
import Project from "./pages/project";
import { useParams } from "react-router-dom";
import Tasks from "./pages/tasks";
import Task from "./pages/task";
import EmployeeTable from "./pages/employee";
import CalendarPage from "./pages/calendar";
import LandingPage from "./pages/landing";

function App() {
  const location = useLocation();

  return (<>
    {location.pathname !== "/signin" && <ComplexNavbar />}
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route
        path="/"
        element={
          <LandingPage />
        }
      />
      <Route path="/projects/*">
        <Route path="" element={<Dashboard />} />
        <Route path=":id" element={<Project />} />
      </Route>
      <Route path="/tasks/*">
        <Route path="" element={<Tasks />} />
        <Route path=":id" element={<Task />} />
      </Route>
      <Route path='employees/*'>
        <Route path='' element={<EmployeeTable />} />
        <Route path=':id' element={<Dashboard />} />
      </Route>
      <Route path='calendar' element={<CalendarPage />} />
    </Routes>
  </>);
}

export default App;
