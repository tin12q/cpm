import ProfileCard from "../components/profileCard";
import axios from "axios";
import cookie from "cookie";
import ProjectCard from "../components/projectCard";
import ReactDOM from "react-dom";
const getProjects = () => {
    const cookies = cookie.parse(document.cookie);
    axios.get("http://localhost:1337/api/projects", { headers: { Authorization: "Bearer " + cookies.token } }).then((res) => {
        console.log(res.data);
        const projects = res.data.map((project) => {
            console.log(project);
            return (<ProjectCard title={project.title} due_date={project.due_date} status={project.status} description={project.description} />);
        });
        ReactDOM.render(<div id="project-cards">{projects}</div>, document.getElementById("root"));
    }).catch((err) => {
        console.log(err);
    });
}


const Dashboard = () => {
    return (
        <div className="grid grid-cols-2 gap-5 justify-items-center overflow-auto mt-20">
            <ProjectCard title="Project 1" due_date="2021-10-01" status="in progress" description="This is a description" />
            {getProjects}
        </div>
    );
}

export default Dashboard;