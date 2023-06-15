import React, { useEffect, useState } from "react";
import { Alert, Button, Card, CardBody, CardHeader, Dialog, Input, Typography, } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import Select from "react-select";
import { UserGroupIcon } from "@heroicons/react/24/outline";

export default function AddTeam() {
    const [members, setMembers] = useState([]);
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [assignedTo, setAssignedTo] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [alert, setAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");

    const handleOpen = () => {
        setOpen((cur) => !cur);
        setAssignedTo([]);
    };
    const handleAlert = () => {
        setAlert((cur) => !cur);
    }
    useEffect(() => {
        axios.get(`http://localhost:1337/api/users`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
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

    useEffect(() => {
        if (alert) {
            setTimeout(() => {
                handleAlert();
            }, 3000);
        }
    }, [alert]);
    if (!members) {
        return <h1>Loading...</h1>
    }
    const handleSubmit = async e => {
        e.preventDefault();
        const cookies = cookie.parse(document.cookie);
        axios.post('http://localhost:1337/api/teams',
            {
                name,
                members: assignedTo
            }
            , { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {
                //render alert success
                setAlertMessage("Team added successfully!");
            }).catch(err => {
                setAlertMessage("Team not added!");

            });
            setAlert((cur) => !cur);

       
    }
    return (
        <React.Fragment>
            <Button className="flex items-center gap-3" color="light-blue" size="sm" onClick={handleOpen}>
                <UserGroupIcon strokeWidth={2} className="h-4 w-4" /> Add Team
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
                            Add Team
                        </Typography>
                    </CardHeader>
                    <CardBody className="">
                        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                            <Input required label="Name" size="lg" type="text"
                                onChange={(e) => setName(e.target.value)} />
                            <Select
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
                                Add Team
                            </Button>
                        </form>
                    </CardBody>
                </Card>
            </Dialog>
            <Alert className="fixed bottom-0 right-0" open={alert}   >
                <div className="flex items-center gap-2">
                    <Typography color="white">{alertMessage}</Typography>
                </div>
            </Alert>

        </React.Fragment>
    );
}