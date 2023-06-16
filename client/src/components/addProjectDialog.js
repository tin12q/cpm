import React, { useEffect } from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import { Button, Card, CardBody, CardHeader, Dialog, Input, Option, Select, Typography, Alert } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";

export default function AddProject() {
    const [open, setOpen] = React.useState(false);
    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [dueDate, setDueDate] = React.useState("");
    const [status, setStatus] = React.useState("");
    const [teams, setTeams] = React.useState(null);
    const [selectedTeam, setSelectedTeam] = React.useState("");
    const [alert, setAlert] = React.useState(false);
    const [alertMessage, setAlertMessage] = React.useState("");
    const handleOpen = () => setOpen((cur) => !cur);
    const handleAlert = () => { setAlert((cur) => !cur); }
    useEffect(() => {
        axios.get('http://localhost:1337/api/teams', { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                setTeams(res.data);
            })
            .catch(err => alert(err));
    }, []);
    useEffect(() => {
        if (alert) {
            setTimeout(() => {
                handleAlert();
            }, 3000);
        }
    }, [alert]);

    if (!teams) {
        return <h1>Loading...</h1>
    }
    const handleSubmit = async e => {
        e.preventDefault();
        const cookies = cookie.parse(document.cookie);
        axios.post('http://localhost:1337/api/projects',
            {
                title,
                description,
                due_date: dueDate,
                status: 'in progress',
                team: selectedTeam
            }
            , { headers: { Authorization: `Bearer ${cookies.token}` } }).
            then(res => {
                setAlertMessage("Project added successfully!");
            }).
            catch(err => {
                setAlertMessage("Error adding project!");
            });
        handleAlert();
    }
    return (
        <React.Fragment>
            <Button className="flex items-center gap-3" color="blue" size="md" onClick={handleOpen}>
                <UserPlusIcon strokeWidth={2} className="h-4 w-4" /> Add Project
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
                            Add Project
                        </Typography>
                    </CardHeader>
                    <CardBody className="">
                        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                            <Input required label="Title" size="lg" onChange={(e) => setTitle(e.target.value)} />
                            <Input required label="Description" size="lg"
                                onChange={(e) => setDescription(e.target.value)} />
                            <Input required label="Due Date" size="lg" type="date"
                                onChange={(e) => setDueDate(new Date(e.target.value).getTime())} />
                            <Select label='Team' onChange={(value) => setSelectedTeam(value)}>
                                {teams.map((team) => {
                                    return <Option key={team._id} value={team._id}>{team.name}</Option>
                                })}
                            </Select>
                            <Button type="submit" variant="gradient" onClick={handleOpen} fullWidth>
                                Add
                            </Button>
                        </form>
                    </CardBody>

                </Card>
            </Dialog>
            <Alert className="fixed top-20 right-4" open={alert} onClick={handleAlert}>
                <div className="flex items-center gap-2">
                    <Typography color="white">{alertMessage}</Typography>
                </div>
            </Alert>
        </React.Fragment>
    );
}