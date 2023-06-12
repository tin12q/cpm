import { useEffect, useState } from 'react';
import cookie from 'cookie';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Card, Chip, CardHeader, CardBody, Typography, Progress } from '@material-tailwind/react';
import '../css/project.css';
import TaskTable from '../components/tasksTable';
import TaskComp from '../components/taskComp';
import MemberComp from '../components/memberComp';

function Project() {
  const [projectData, setProjectData] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [members, setMembers] = useState(null);
  const [completedTasks, setCompletedTasks] = useState(null);
  const [late, setLate] = useState(null);

  const id = useParams().id;
  useEffect(() => {
    console.log(id);
    const cookies = cookie.parse(document.cookie);
    axios.get(`http://localhost:1337/api/projects/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
      .then(response => {
        setProjectData(response.data);

      })
      .catch(error => console.error(error));
    axios.get(`http://localhost:1337/api/tasks/project/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
      .then(res => {
        console.log(res.data);
        setTasks(res.data);
      })
      .catch(err => { console.log(err); });
    axios.get(`http://localhost:1337/api/tasks/completed/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
      .then(res => {
        console.log(res.data);
        setCompletedTasks(res.data);
      })
      .catch(err => { console.log(err); });
    axios.get(`http://localhost:1337/api/tasks/lated/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
      .then(res => {
        console.log(res.data);
        setLate(res.data);
      })
      .catch(err => { console.log(err); });
  }, [id]);

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
            {/*increase font */}
            <Typography color="blue-gray">{projectData.description}</Typography>

          </div>
          <div className='w-4/12 mt-5 '>
            <Progress color="lightBlue" value={(completedTasks.completed == null) ? '0' : completedTasks.completed} label='Completed' className='h-7 mb-5' />

            <Progress color='red' value={(late.lated == null) ? '0' : late.lated} label='Late' className='h-7' />
          </div>
          <div className='w-1/12 text-right mr-10'>
            <Chip
              className='w-max ml-10'
              variant="ghost"
              size="sm"
              value={(projectData.status === 'in progress') ? "In progress" : (projectData.status === "completed") ? "Completed" : "Late"}
              color={(projectData.status === 'in progress') ? "blue-gray" : (projectData.status === "completed") ? "green" : "red"}
            />
            <Typography color="blue-gray">{new Date(projectData.due_date).toISOString().split('T')[0]}</Typography>

          </div>
        </CardBody>
      </Card>

      <div className='mt-10 mb-10 row '>
        <div className='w-3/4 pr-10'>

          <TaskComp />

        </div>
        <div className='w-1/4'>
          <MemberComp />
        </div>
      </div>
    </div>

  );
}
export default Project;