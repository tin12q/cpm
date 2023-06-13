import React from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import {
    Button,
    Dialog,
    Card,
    CardHeader,
    CardBody,
    Typography,
    Input,
    Select,
    Option
} from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";


export default function AddUser() {
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
    const handleOpen = () => {
        setOpen((cur) => !cur);
    };
    useEffect(() => {
        axios.get(`/api/teams/`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                console.log(res.data);
                setTeam(res.data);
            })
            .catch(err => { console.log(err); });
    }, []);

    if (!team) {
        return <h1>Loading...</h1>
    }
    const handleSubmit = async e => {
        e.preventDefault();
        const cookies = cookie.parse(document.cookie);
        axios.post('/api/users', {
            name,
            dob: dob,
            role,
            email,
            username,
            password,
            team: selectedTeam,
        }, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .catch(err => { console.log(err); });
        window.location.reload();
    }
    return (
        <React.Fragment>
            <Button className="flex items-center gap-3" color="blue" size="sm" onClick={handleOpen}>
                <UserPlusIcon strokeWidth={2} className="h-4 w-4" /> Add User
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
                            Add User
                        </Typography>
                    </CardHeader>
                    <CardBody className="">
                        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                            <Input required label="Username" type="text" color="lightBlue" value={username} onChange={(e) => setUsername(e.target.value)} />
                            <Input required label='Password' type="password" color="lightBlue" value={password} onChange={(e) => setPassword(e.target.value)} />
                            <Input required label='Name' type="text" color="lightBlue" value={name} onChange={(e) => setName(e.target.value)} />
                            <Input required label='Email' type="email" color="lightBlue" value={email} onChange={(e) => setEmail(e.target.value)} />
                            <Input required label='Date of Birth' type="date" color="lightBlue" onChange={(e) => setDob(new Date(e.target.value).getTime())} />
                            <Select
                                label='Role'
                                value={role}
                                onChange={(value) => { setRole(value) }}>
                                <Option value="admin">Admin</Option>
                                <Option value="manager">Manager</Option>
                                <Option value="member">Member</Option>
                            </Select>
                            <Select label='Team' onChange={(value) => setSelectedTeam(value)}>
                                {team.map((team) => {
                                    return <Option key={team._id} value={team._id}>{team.name}</Option>
                                })}
                            </Select>
                            <Button type="submit" variant="gradient" onClick={handleOpen} fullWidth>
                                Add User
                            </Button>
                        </form>
                    </CardBody>

                </Card>
            </Dialog>
        </React.Fragment>
    );
}