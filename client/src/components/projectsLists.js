import axios from "axios";
import cookie from "cookie";
import ProjectCard from "../components/projectCard";
import React from "react";

const ProjectList = () => {
    const cookies = cookie.parse(document.cookie);
    axios.get("http://localhost:1337/api/projects", { headers: { Authorization: "Bearer " + cookies.token } }).then((res) => {
        res.data.map((project) => {
            return (React.createElement(ProjectCard, {
                title: project.title,
                due_date: project.due_date,
                status: project.status,
                description: project.description
            }));
        });
    }).catch((err) => {
        alert(err);
    });
}
export default ProjectList;
