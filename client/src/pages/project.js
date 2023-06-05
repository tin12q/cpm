import { useEffect, useState } from 'react';
import cookie from 'cookie';
import axios from 'axios';
import { useParams } from 'react-router-dom';


function Project() {
  const [projectData, setProjectData] = useState(null);
  const [tasks, setTasks] = useState(null);
  const id = useParams().id;
  useEffect(() => {
    console.log(id);
    const cookies = cookie.parse(document.cookie);
    axios.get(`http://localhost:1337/api/projects/${id}`,{headers: { Authorization: `Bearer ${cookies.token}` }})
      .then(response => setProjectData(response.data))
      .catch(error => console.error(error));
    axios.get(`http://localhost:1337/api/tasks/project/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
    .then(res => {
        console.log(res.data);
        setTasks(res.data);
    })
    .catch(err => {console.log(err);});
  }, [id]);

  //get tasks that in this project

  if (!projectData|| !tasks) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{projectData.title}</h1>
      <p>{projectData.description}</p>
      {/* Render other project data here */}
      {tasks.map((task) =>{return (
            <h1>{task.title}</h1>
        )}  
      )}
    </div>
  );
}
export default Project;