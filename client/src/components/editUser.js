import React, { useEffect, useState } from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import { Button, Card, CardBody, CardHeader, Dialog, Input, Option, Select, Typography,Alert } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";


export default function EditUser(props) {
    const id = props.id;
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [dob, setDob] = useState(null);
    const [role, setRole] = useState("");
    const [team, setTeam] = useState([]);
    const [teamMap, setTeamMap] = useState({});
    const [selectedTeam, setSelectedTeam] = useState('');
    const [alert, setAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const handleOpen = () => {
        setOpen((cur) => !cur);
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
        axios.get((process.env.REACT_APP_API_URL ?? `https://cpm.tin12q.org/`) + `api/users/${id}`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                setUsername(res.data.username);
                setName(res.data.name);
                setEmail(res.data.email);
                setRole(res.data.role);
                setSelectedTeam(res.data.team);
            })
            .catch(err => {
                alert(err);
            });
        axios.get((process.env.REACT_APP_API_URL ?? `https://cpm.tin12q.org/`) + `api/teams/`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                setTeam(res.data);
            })
            .catch(err => {
                alert(err);
            });
    }, []);

    if (!team) {
        return <h1>Loading...</h1>
    }
    const handleSubmit = async e => {
        e.preventDefault();
        const cookies = cookie.parse(document.cookie);
        axios.put((process.env.REACT_APP_API_URL ?? `https://cpm.tin12q.org/`) + `api/users/${id}`, {
            name,
            dob: dob,
            role,
            email,
            username,
            password,
            team: selectedTeam,
        }, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                setAlertMessage("User Updated Successfully");
            })
            .catch(err => {
                
                setAlertMessage("User Updation Failed");
            });
        handleAlert();
    }
    return (
        <React.Fragment>
            <Button className="flex items-center gap-3" color="blue" size="sm" onClick={handleOpen}>
                <UserPlusIcon strokeWidth={2} className="h-4 w-4" /> Update User
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
                            Update User
                        </Typography>
                    </CardHeader>
                    <CardBody className="">
                        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                            <Input required disabled label="Username" type="text" color="lightBlue" value={username} />
                            <Input required label='Password' type="password" color="lightBlue" value={password}
                                onChange={(e) => setPassword(e.target.value)} />
                            <Input required label='Name' type="text" color="lightBlue" value={name}
                                onChange={(e) => setName(e.target.value)} />
                            <Input required label='Email' type="email" color="lightBlue" value={email}
                                onChange={(e) => setEmail(e.target.value)} />
                            <Input required label='Date of Birth' type="date" color="lightBlue"
                                onChange={(e) => setDob(new Date(e.target.value).getTime())} />
                            <Select
                                label='Role'
                                value={role}
                                onChange={(value) => {
                                    setRole(value)
                                }}>
                                <Option value="admin">Admin</Option>
                                <Option value="manager">Manager</Option>
                                <Option value="employee">Employee</Option>
                            </Select>
                            <Select label='Team' value={selectedTeam} onChange={(value) => setSelectedTeam(value)}>
                                {team.map((team) => {
                                    return <Option key={team._id} value={team._id}>{team.name}</Option>
                                })}
                            </Select>
                            <Button type="submit" variant="gradient" onClick={handleOpen} fullWidth>
                                Update User
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