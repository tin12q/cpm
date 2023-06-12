import {
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    Typography,
    Chip,
    Avatar,
    Tooltip,
} from "@material-tailwind/react";
import { Link } from "react-router-dom";

export default function PCWM({ title, dueDate, status, members, id }) {
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
                    <Typography variant="lead" color="gray" className="mt-3 font-normal">
                        Due Date: {new Date(dueDate).toLocaleDateString()}
                    </Typography>

                    <Chip
                        className="w-max mt-2"
                        variant="ghost"
                        size="sm"
                        value={(status === 'in progress') ? "In progress" : (status === "completed") ? "Completed" : "Late"}
                        color={(status === 'in progress') ? "blue-gray" : (status === "completed") ? "green" : "red"}
                    />
                    {/* <Typography variant="lead" color="gray" className="mt-3 font-normal">
                        Members: {members.join(", ")}
                    </Typography> */}
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
                </CardFooter>
            </Card>
        </Link>
    );
}