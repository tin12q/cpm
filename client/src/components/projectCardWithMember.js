import { Card, CardBody, CardFooter, CardHeader, Chip, Progress, Typography } from "@material-tailwind/react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import cookie from "cookie";

export default function PCWM({ title, dueDate, status, id }) {
    const cookies = cookie.parse(document.cookie);
    const [complete, setComplete] = useState(0);
    const [late, setLate] = useState(0);
    useEffect(() => {
        axios.get(`/api/tasks/completed/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {
                setComplete(res.data.completed);
            })
            .catch(err => {
                alert(err);
            });
        axios.get(`/api/tasks/lated/${id}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then(res => {

                setLate(res.data.lated);
            })
            .catch(err => {
                alert(err);
            });
    }, []);
    return (
        <Link to={`/projects/${id}`}>
            <Card className="max-w-[24rem] overflow-hidden">
                <CardHeader
                    floated={false}
                    shadow={false}
                    color="transparent"
                    className="m-0 rounded-none"
                >
                    <img
                        src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1471&q=80"
                        alt="ui/ux review check"
                    />
                </CardHeader>
                <CardBody>
                    <Typography variant="h4" color="blue-gray">
                        {title}
                    </Typography>



                    {/* <Typography variant="lead" color="gray" className="mt-3 font-normal">
                        Members: {members.join(", ")}
                    </Typography> */}
                    <div className="w-full mt-4 mb-4">
                        <div className="flex items-center justify-between gap-4 mb-2">
                            <Typography color="blue" variant="h6">Completed</Typography>
                            <Typography color="blue" variant="h6">{complete + '%'}</Typography>
                        </div>
                        <Progress value={complete} />
                    </div>
                    <div className="w-full">
                        <div className="flex items-center justify-between gap-4 mb-2">
                            <Typography color="red" variant="h6">Late</Typography>
                            <Typography color="red" variant="h6">{late + '%'}</Typography>
                        </div>
                        <Progress color='red' value={late} />
                    </div>
                </CardBody>
                <CardFooter className="flex items-center justify-between">
                    {/* <div className="flex items-center -space-x-3">
                        {members.map((member, index) => (
                            <Tooltip key={index} content={member}>
                                <Avatar
                                    size="sm"
                                    variant="circular"
                                    alt={member}
                                    src={`https://i.pravatar.cc/150?u=${member}`}
                                    className="border-2 border-white hover:z-10"
                                />
                            </Tooltip>
                        ))}
                    </div> */}
                    <Typography className="font-normal">{new Date(dueDate).toLocaleDateString()}</Typography>
                    <Chip
                        className="w-max mt-2"
                        variant="ghost"
                        size="sm"
                        value={(status === 'in progress') ? "In progress" : (status === "completed") ? "Completed" : "Late"}
                        color={(status === 'in progress') ? "blue-gray" : (status === "completed") ? "green" : "red"}
                    />
                </CardFooter>
            </Card>
        </Link>
    );
}