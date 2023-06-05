import { useState, useEffect } from 'react';
import axios from 'axios';
import cookie from 'cookie';
import ProjectCard from '../components/projectCard';

const Dashboard = () => {
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        const cookies = cookie.parse(document.cookie);
        axios.get('http://localhost:1337/api/projects', {
            headers: { Authorization: `Bearer ${cookies.token}` }
        })
            .then(res => {
                console.log(res.data);
                setProjects(res.data);
            })
            .catch(err => {
                console.log(err);
            });
    }, []);

    return (
        <div className="grid grid-cols-2 gap-5 justify-items-center overflow-auto mt-20">
            {projects.map(project => (
                <ProjectCard
                    key={project._id}
                    id={project._id}
                    title={project.title}
                    due_date={project.due_date}
                    status={project.status}
                    description={project.description}
                />
            ))}
        </div>
    );
};

export default Dashboard;