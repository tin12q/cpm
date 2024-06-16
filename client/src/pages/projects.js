import { useEffect, useState } from 'react';
import axios from 'axios';
import cookie from 'cookie';
import { Card, CardBody, CardHeader, Typography, CardFooter, Button, Input } from '@material-tailwind/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import '../css/navbar.css';
import { useNavigate } from 'react-router-dom';
import PCWM from '../components/projectCardWithMember';
import AddProject from '../components/addProjectDialog';

const Projects = () => {
    const navigate = useNavigate();
    const cookies = cookie.parse(document.cookie);
    const [projects, setProjects] = useState([]);
    const [page, setPage] = useState(1);
    function handleNextPage() {
        setPage(page + 1);
    }
    function handlePrevPage() {
        if (page > 1) setPage(page - 1);
    }

    const [search, setSearch] = useState('');
    function handleSearch(e) {
        setSearch(e.target.value);
    }
    useEffect(() => {
        if (!cookies.token) {
            navigate('/signin');
        }
    }, []);
    useEffect(() => {
        axios.get(`http://localhost:1337/api/projects?page=${page}`, {
            headers: { Authorization: `Bearer ${cookies.token}` }
        })
            .then(res => {
                setProjects(res.data);
            })
            .catch(err => {
                // alert(err);
            });
    }, [page]);
    useEffect(() => {
        axios.get(`http://localhost:1337/api/projects/search?search=${search}`, {
            headers: { Authorization: `Bearer ${cookies.token}` }
        })
            .then(res => {
                setProjects(res.data);
            }).catch(err => {
                // alert(err);
            });
    }, [search]);
    if (!projects) {
        return <div>Loading...</div>;
    }
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

                        <div className="w-full md:w-96 ">
                            <Input label="Search" icon={<MagnifyingGlassIcon className="h-5 w-5" />} onChange={handleSearch} />
                        </div><div className="flex shrink-0 flex-col gap-2 sm:flex-row">

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
                <CardFooter className="flex items-center justify-between border-t border-blue-gray-50 p-4">
                    <Typography variant="small" color="blue-gray" className="font-normal">
                        Page {page}
                    </Typography>
                    <div className="flex gap-2">
                        <Button variant="outlined" color="blue-gray" size="sm" onClick={handlePrevPage}>
                            Previous
                        </Button>
                        <Button variant="outlined" color="blue-gray" size="sm" onClick={handleNextPage}>
                            Next
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>


    );
};

export default Projects;