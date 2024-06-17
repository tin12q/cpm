import { useEffect, useState } from 'react';
import cookie from 'cookie';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Textarea } from '@material-tailwind/react';

const Task = () => {
    const [task, setTask] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState('');
    const [assignedTo, setAssignedTo] = useState('');

    const navigate = useNavigate();

    const id = useParams().id;
    useEffect(() => {
        const cookies = cookie.parse(document.cookie);
        axios.get((process.env.REACT_APP_API_URL ?? `https://cpm.tin12q.org/`) + `api/tasks/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {
                setTask(res.data);
                setTitle(res.data.title);
                setDescription(res.data.description);
                setDueDate(new Date(res.data.due_date).toISOString().split('T')[0]);
                setStatus(res.data.status);
                setAssignedTo(res.data.assigned_to);
            })
            .catch(err => {
                alert(err);
            });
    }, [id]);
    const handleSubmit = async e => {
        e.preventDefault();
        try {
            const cookies = cookie.parse(document.cookie);
            const res = await axios.put(
                (process.env.REACT_APP_API_URL ?? `https://cpm.tin12q.org/`) + `api/tasks/${id}`,
                {
                    title,
                    description,
                    due_date: new Date(dueDate).getTime(),
                    status,
                    assigned_to: assignedTo
                },
                { headers: { Authorization: `Bearer ${cookies.token}` } }
            );
            navigate('/tasks');
        } catch (error) {
            alert(error);
        }
    };

    if (!task) {
        return <div>Loading... </div>
    }
    return (
        <div className="gap-10 flex justify-center justify-items-center overflow-auto mt-20">
            <div className="flex justify-between items-center mb-5">
                <h1 className="text-2xl font-bold">Edit Task</h1>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="mb-5">
                    <Input
                        type="text"
                        value={title}
                        label='Title'
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Title"
                        size="lg"
                        fullWidth
                    />
                </div>
                <div className="mb-5">
                    <Textarea
                        value={description}
                        label='Description'
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Description"
                        size="regular"
                        fullWidth
                    />
                </div>
                <div className="mb-5">
                    <Input
                        type="date"

                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        placeholder="Due Date"
                        size="lg"
                        fullWidth
                    />
                </div>
                <div className="mb-5">
                    <Input
                        type="text"
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        placeholder="Status"
                        size="lg"
                        fullWidth
                    />
                </div>
                <div className="mb-5">
                    <Input
                        type="text"
                        value={assignedTo}
                        onChange={e => setAssignedTo(e.target.value)}
                        placeholder="Assigned To"
                        size="lg"
                        fullWidth
                    />
                </div>
                <Button color="blue" type="submit" size="lg" ripple="light">
                    Save
                </Button>
            </form>
        </div>
    )
};

export default Task;