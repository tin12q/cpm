import { useEffect, useState } from 'react';
import cookie from 'cookie';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Card, CardBody, Chip, Typography } from '@material-tailwind/react';
import '../css/project.css';
import TaskComp from '../components/taskComp';
import MemberComp from '../components/memberComp';
import PieChart from '../components/PieChart';

function Project() {
    const [projectData, setProjectData] = useState(null);
    const [tasks, setTasks] = useState(null);
    const [members, setMembers] = useState(null);
    const [completedTasks, setCompletedTasks] = useState(null);
    const [late, setLate] = useState(null);

    const id = useParams().id;
    useEffect(() => {
        const cookies = cookie.parse(document.cookie);
        axios.get(`http://localhost:1337/api/projects/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(response => {
                setProjectData(response.data);

            })
            .catch(error => console.error(error));
        axios.get(`http://localhost:1337/api/tasks/project/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {

                setTasks(res.data);
            })
            .catch(err => {
                alert(err);
            });
        axios.get(`http://localhost:1337/api/tasks/completed/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {

                setCompletedTasks(res.data);
            })
            .catch(err => {
                alert(err);
            });
        axios.get(`http://localhost:1337/api/tasks/lated/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {

                setLate(res.data);
            })
            .catch(err => {
                alert(err);
            });
    }, []);

    //get tasks that in this project

    if (!projectData || !tasks || !completedTasks || !late) {
        return <div>Loading...</div>;
    }

    return (
        <div className='mt-20 pl-20 pr-20 w-screen justify-items-center overflow-auto'>

            <Card className=' '>
                <CardBody className='mt-5 pl-5 row justify-between'>
                    <div className='w-6/12'>
                        <Typography className='mb-5' variant="h1" color="blue-gray">{projectData.title}</Typography>
                        <Typography color="blue-gray">{projectData.description}</Typography>

                    </div>
                    <div className='w-4/12 mt-5 '>
                        <div className='w-96 h-96'>
                            <PieChart completed={completedTasks.completed} late={late.lated} />
                        </div>
                        {/* <div className="w-full mb-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <Typography color="blue" variant="h6">Completed</Typography>
                <Typography color="blue" variant="h6">{completedTasks.completed + '%'}</Typography>
              </div>
              <Progress value={completedTasks.completed} />
            </div>
            <div className="w-full">
              <div className="flex items-center justify-between gap-4 mb-2">
                <Typography color="red" variant="h6">Late</Typography>
                <Typography color="red" variant="h6">{late.lated + '%'}</Typography>
              </div>
              <Progress color='red' value={late.lated} />
            </div> */}
                    </div>
                    <div className='w-1/12 text-right mr-10'>
                        <Chip
                            className='w-max ml-10'
                            variant="ghost"
                            size="sm"
                            value={(projectData.status === 'in progress') ? "In progress" : (projectData.status === "completed") ? "Completed" : "Late"}
                            color={(projectData.status === 'in progress') ? "blue-gray" : (projectData.status === "completed") ? "green" : "red"}
                        />
                        <Typography
                            color="blue-gray">{new Date(projectData.due_date).toISOString().split('T')[0]}</Typography>

                    </div>
                </CardBody>
            </Card>

            <div className='mt-10 mb-10 row '>
                <div className='w-3/4 pr-10'>
                    <TaskComp id={projectData.team} />
                </div>
                <div className='w-1/4'>
                    <MemberComp id={projectData.team} />
                </div>
            </div>
        </div>

    );
}

export default Project;