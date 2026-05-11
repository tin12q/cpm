import "./App.css";
import SignIn from "./pages/signIn.js";
import { Route, Routes, useLocation } from "react-router-dom";
import ComplexNavbar from "./components/navbar";
import Projects from "./pages/projects";
import Project from "./pages/project";
import Tasks from "./pages/tasks";
import Task from "./pages/task";
import EmployeeTable from "./pages/employee";
import EmployeeDetail from "./pages/employeeDetail";
import CalendarPage from "./pages/calendar";
import DashboardAdmin from "./pages/dashboardAdmin";
import SkillsPage from "./pages/skills";
import StageTemplatesPage from "./pages/stageTemplates";
import ContactsPage from "./pages/contacts";
import Layout from "./components/layout";

function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/signin";

  const appRoutes = (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/" element={<DashboardAdmin />} />
      <Route path="/projects/*">
        <Route path="" element={<Projects />} />
        <Route path=":id" element={<Project />} />
      </Route>
      <Route path="/tasks/*">
        <Route path="" element={<Tasks />} />
        <Route path=":id" element={<Task />} />
      </Route>
      <Route path="employees/*">
        <Route path="" element={<EmployeeTable />} />
        <Route path=":id" element={<EmployeeDetail />} />
      </Route>
      <Route path="skills" element={<SkillsPage />} />
      <Route path="stage-templates" element={<StageTemplatesPage />} />
      <Route path="contacts" element={<ContactsPage />} />
      <Route path="calendar" element={<CalendarPage />} />
    </Routes>
  );

  return (
    <div className="app-root">
      {!isAuthRoute && <ComplexNavbar />}
      {isAuthRoute ? appRoutes : <Layout className="page-frame">{appRoutes}</Layout>}
    </div>
  );
}

export default App;
