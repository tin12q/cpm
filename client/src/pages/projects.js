import { useEffect, useState } from 'react';
import axios from 'axios';
import cookie from 'cookie';
import { Card, CardBody, CardHeader, Typography } from '@material-tailwind/react';
import '../css/navbar.css';
import PCWM from '../components/projectCardWithMember';
import AddProject from '../components/addProjectDialog';

const Projects = () => {
    const cookies = cookie.parse(document.cookie);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        const cookies = cookie.parse(document.cookie);
        if (!cookies.token) {
            window.location.href = '/login';
        }
        axios.get('http://localhost:1337/api/projects', {
            headers: { Authorization: `Bearer ${cookies.token}` }
        })
            .then(res => {
                setProjects(res.data);
            })
            .catch(err => {
                alert(err);
            });
    }, []);
    if (!projects) {
        return <div>Loading...</div>;
    }
    const handleCreateProject = () => {
        axios.post('http://localhost:1337/api/projects', {

            title: 'test1',
            description: 'test1',
            due_date: new Date().getTime(),
            status: 'in progress',
            team: ['60f9b0b3e0b9c2a8b8f0b0b5']

        }, {
            headers: { Authorization: `Bearer ${cookies.token}` },

        },)
            .then(res => {
                setProjects(...res.data);
            })
            .catch(err => {
                alert(err);
            });
        // handle create project logic
    };
    return (
        <div className=" justify-items-center overflow-auto mt-20 ml-20 mr-20 ">
            <Card className="h-full w-full">
                <CardHeader floated={false} shadow={false} className="rounded-none">
                    <div className="mb-8 flex items-center justify-between gap-8">
                        <div>
                            <Typography variant="h2" color="blue-gray">
                                Projects List
                            </Typography>
                            <Typography color="gray" className="mt-1 font-normal">
                                See information about all project
                            </Typography>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">

                            {(cookies.role === 'admin') && <AddProject />}
                        </div>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className="flex justify-evenly flex-wrap pb-10 gap-10 overflow-auto">
                        {projects.map(project => (
                            <PCWM

                                key={project._id}
                                id={project._id}
                                title={project.title}
                                dueDate={project.due_date}
                                status={project.status}
                                members={project.team}
                            />
                        ))}
                    </div>
                </CardBody>

            </Card>
        </div>


    );
};

export default Projects;