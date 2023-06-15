import "./App.css";
import SignIn from "./pages/signIn.js";
import { Route, Routes, useLocation } from "react-router-dom";
import ComplexNavbar from "./components/navbar";
import Projects from "./pages/projects";
import Project from "./pages/project";
import Tasks from "./pages/tasks";
import Task from "./pages/task";
import EmployeeTable from "./pages/employee";
import CalendarPage from "./pages/calendar";
import DashboardAdmin from "./pages/dashboardAdmin";

function App() {
    const location = useLocation();

    return (<>
        {location.pathname !== "/signin" && <ComplexNavbar />}
        <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route
                path="/"
                element={
                    <DashboardAdmin />
                }
            />
            <Route path="/projects/*">
                <Route path="" element={<Projects />} />
                <Route path=":id" element={<Project />} />
            </Route>
            <Route path="/tasks/*">
                <Route path="" element={<Tasks />} />
                <Route path=":id" element={<Task />} />
            </Route>
            <Route path='employees/*'>
                <Route path='' element={<EmployeeTable />} />
                <Route path=':id' element={<Projects />} />
            </Route>
            <Route path='calendar' element={<CalendarPage />} />
        </Routes>
    </>);
}

export default App;
