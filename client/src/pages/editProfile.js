import { useEffect, useState } from 'react';
import axios from 'axios';
import cookie from 'cookie';
import { Card, CardBody, CardHeader, Typography, Alert, Button, Input } from '@material-tailwind/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import '../css/navbar.css';
import { useNavigate } from 'react-router-dom';

const EditProfile = () => {
    const navigate = useNavigate();
    const cookies = cookie.parse(document.cookie);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [dob, setDob] = useState(null);
    const [password, setPassword] = useState("");
    const [alert, setAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    useEffect(() => {
        axios.get(`/api/users/me`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {
                setName(res.data.name);
                setEmail(res.data.email);
                setDob(new Date(res.data.dob).toISOString());
                console.log(dob);
            })
            .catch(err => {
                setAlertMessage("User Updation Failed");
                handleAlert();
            });
    }, []);
    useEffect(() => {
        if (alert) {
            setTimeout(() => {
                handleAlert();

            }, 3000);
        }
    }, [alert]);
    const handleAlert = () => {
        setAlert((cur) => !cur);
    }
    const handleSubmit = async e => {
        e.preventDefault();
        axios.put('/api/users', {
            name,
            dob: dob,
            email,
            password,
        }, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {
                setAlertMessage("User Updated Successfully");
            })
            .catch(err => {
                setAlertMessage("User Updation Failed");
            });
        handleAlert();
    }

    return (
        <div className="mt-20 ml-auto mr-auto flex flex-col w-1/2 justify-center">
            <Card >
                <CardHeader floated={false} shadow={false} className="rounded-none">
                    <div className="mb-8 flex items-center justify-between gap-8">
                        <div>
                            <Typography variant="h2" color="blue-gray">
                                Edit Profile
                            </Typography>
                            <Typography color="gray" className="mt-1 font-normal">
                                Edit your profile
                            </Typography>
                        </div>
                    </div>
                </CardHeader>
                <CardBody >
                    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                        <div className="flex items-center gap-4">
                            <Input required label='Name' type="text" color="lightBlue" value={name}
                                onChange={(e) => setName(e.target.value)} />
                            <Input required label='Email' type="email" color="lightBlue" value={email}
                                onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <Input required label='Date of Birth' type="date" color="lightBlue"
                            onChange={(e) => setDob(new Date(e.target.value).getTime())} />
                        <Input required label='Password' type="password" color="lightBlue" value={password}
                            onChange={(e) => setPassword(e.target.value)} />
                        <Button color="lightBlue" type="submit" ripple="light">
                            Update Profile
                        </Button>
                    </form>
                </CardBody>

            </Card>
            <Alert className="fixed top-20 right-4" open={alert} onClick={handleAlert}>
                <div className="flex items-center gap-2">
                    <Typography color="white">{alertMessage}</Typography>
                </div>
            </Alert>
        </div>


    );
};

export default EditProfile;