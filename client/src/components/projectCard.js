import {
    Card,
    CardBody,
    CardFooter,
    Typography,
    Button,
} from "@material-tailwind/react";
import { RocketLaunchIcon } from "@heroicons/react/24/solid";
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

export default function ProjectCard(props) {
    return (
        <Card className="mt-6 w-96">
            <CardBody>
                <RocketLaunchIcon className="text-blue-500 w-12 h-12 mb-4" />
                {/* row of 2 compone */}
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    {props.title}
                </Typography>
                <>
                    <Typography color="blue-gray" className="font-medium">
                        {new Date(props.due_date).toLocaleDateString()}
                    </Typography>
                    <Typography color="blue-gray" className="font-medium">
                        {() => {
                            switch (props.status) {
                                case "in progress":
                                    return "In Progress";
                                case "completed":
                                    return "Completed";
                            }
                        }}
                    </Typography>
                </>
                <Typography>
                    {props.description}
                </Typography>
            </CardBody>
            <CardFooter className="pt-0">
                    <Link to={`/projects/${props.id}`}>
                    <Button size="sm" variant="text" className="flex items-center gap-2">
                        View
                        <ArrowLongRightIcon strokeWidth={2} className="w-4 h-4" />
                    </Button>
                    </Link>
            </CardFooter>
        </Card>
    );
}