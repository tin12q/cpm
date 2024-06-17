import React, { useEffect, useState } from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import { Button, Card, CardBody, CardHeader, Dialog, Input, Typography,Alert } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import { useParams } from "react-router-dom";
import Select from "react-select";

export default function AddTask(props) {
    const id = props.id;
    const idp = useParams().id;
    const [members, setMembers] = useState([]);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [assignedTo, setAssignedTo] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [alert, setAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [rerender, setRerender] = useState(false);

    const handleOpen = () => {
        setOpen((cur) => !cur);
        setAssignedTo([]);
    };
    const handleAlert = () => {
        setAlert((cur) => !cur);
    }
    useEffect(() => {
        if (alert) {
            setTimeout(() => {
                handleAlert();
            }, 3000);
        }
    }, [alert]);
    useEffect(() => {
        axios.get((process.env.REACT_APP_API_URL ?? `https://cpm.tin12q.org/`) + `api/teams/users/${id}`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {

                setMembers(res.data.map((member) => {
                    return {
                        value: member._id,
                        label: member.name
                    }
                }));
            })
            .catch(err => {
                alert(err);
            });

    }, []);
    if (!members) {
        return <h1>Loading...</h1>
    }
    const handleSubmit = async e => {
        e.preventDefault();
        const cookies = cookie.parse(document.cookie);
        axios.post((process.env.REACT_APP_API_URL ?? 'https://cpm.tin12q.org/') + 'api/tasks',
            {
                title,
                description,
                due_date: dueDate,
                status: 'in progress',
                project: idp,
                assigned_to: assignedTo
            }
            , { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {
                setAlertMessage("Task added successfully");
                setRerender((cur) => !cur);
            })
            .catch(err => {
                setAlertMessage("Something went wrong");
            });
            handleAlert();

    }

    return (
        <React.Fragment>
            <Button className="flex items-center gap-3" color="blue" size="sm" onClick={handleOpen}>
                <UserPlusIcon strokeWidth={2} className="h-4 w-4" /> Add Task
            </Button>
            <Dialog
                size="xs"
                open={open}
                handler={handleOpen}
                className="bg-transparent shadow-none"
            >
                <Card className="mx-auto w-full max-w-[24rem]">
                    <CardHeader
                        variant="gradient"
                        color="blue"
                        className="mb-4 grid h-28 place-items-center"
                    >
                        <Typography variant="h3" color="white">
                            Add Task
                        </Typography>
                    </CardHeader>
                    <CardBody className="">
                        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                            <Input required label="Title" size="lg" onChange={(e) => setTitle(e.target.value)} />
                            <Input required label="Description" size="lg"
                                onChange={(e) => setDescription(e.target.value)} />
                            <Input required label="Due Date" size="lg" type="date"
                                onChange={(e) => setDueDate(new Date(e.target.value).getTime())} />
                            {/* <Input label="Assigned To" size="lg"  onChange={(e) => setAssignedTo(e.target.value)} /> */}
                            {/*TODO: create menu list */}

                            <Select
                                required
                                isMulti
                                options={members}
                                onChange={(selected) => {
                                    setSelectedOption(selected);
                                    setAssignedTo(selected.map((option) => option.value));
                                }}
                                value={selectedOption}
                                placeholder="Assign to members"
                            />
                            <Button type="submit" variant="gradient" onClick={handleOpen} fullWidth>
                                Add Task
                            </Button>
                        </form>
                    </CardBody>

                </Card>
            </Dialog>
            <Alert  className="fixed top-20 right-4" open={alert} onClick={handleAlert}>
                <div className="flex items-center gap-2">
                    <Typography color="white">{alertMessage}</Typography>
                </div>
            </Alert>
        </React.Fragment>
    );
}