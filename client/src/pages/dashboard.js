import { useState, useEffect } from 'react';
import axios from 'axios';
import cookie from 'cookie';
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Input, Button, Card, CardHeader, CardBody, Typography, CardFooter } from '@material-tailwind/react';
import '../css/navbar.css';
import PCWM from '../components/projectCardWithMember';
import AddTask from '../components/addTaskDialog';
import AddProject from '../components/addProjectDialog';

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
    const handleCreateProject = () => {
        const cookies = cookie.parse(document.cookie);
        console.log(cookies.token);
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
                console.log(res.data);
                setProjects(...res.data);
            })
            .catch(err => {
                alert(err);
            });
        // handle create project logic
    };
    return (
        <div className="justify-items-center overflow-auto mt-20 ml-20 mr-20">
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

                            <AddProject />
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
                                members={project.members}
                            />
                        ))}
                    </div>
                </CardBody>

            </Card>
        </div>


    );
};

export default Dashboard;