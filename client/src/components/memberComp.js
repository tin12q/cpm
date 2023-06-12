import { Card, CardHeader, Typography } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import cookie from "cookie";
const TABLE_HEAD = ["Name", "Job"];

const TABLE_ROWS = [
    {
        name: "John Michael",
        job: "Manager",
        date: "23/04/18",
    },
    {
        name: "Alexa Liras",
        job: "Developer",
        date: "23/04/18",
    },
    {
        name: "Laurent Perrier",
        job: "Executive",
        date: "19/09/17",
    },
    {
        name: "Michael Levi",
        job: "Developer",
        date: "24/12/08",
    },
    {
        name: "Richard Gran",
        job: "Manager",
        date: "04/10/21",
    },
];

export default function MemberComp(props) {
    const [members, setMembers] = useState(null);
    const [team, setTeam] = useState(null);
    const id = props.id;
    useEffect(() => {
        axios.get(`http://localhost:1337/api/teams/${id}`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                console.log(res.data);
                setTeam(res.data);
            })
            .catch(err => console.log(err));
        //FIXME:
        team.members.forEach(member => {
            console.log(member);
            axios.get(`http://localhost:1337/api/users/${member}`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
                .then(res => {
                    console.log(res.data);
                    setMembers(res.data);
                })
                .catch(err => console.log(err));
        });

    }, []);
    if (!members || !team) {
        return <div>Loading...</div>
    }
    return (
        <Card className="overflow-scroll h-full w-full">
            <CardHeader floated={false} shadow={false} className="rounded-none">
                <div className="mb-8 flex items-center justify-between gap-8">
                    <div>
                        <Typography variant="h2" color="blue-gray">
                            Members
                        </Typography>

                    </div>

                </div>

            </CardHeader>
            <table className="w-full min-w-max table-auto text-left">
                <thead>
                    <tr>
                        {TABLE_HEAD.map((head) => (
                            <th key={head} className="border-b border-blue-gray-100 bg-blue-gray-50 p-4">
                                <Typography
                                    variant="small"
                                    color="blue-gray"
                                    className="font-normal leading-none opacity-70"
                                >
                                    {head}
                                </Typography>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {members.map(({ name, email }, index) => {
                        const isLast = index === members.length - 1;
                        const classes = isLast ? "p-4" : "p-4 border-b border-blue-gray-50";

                        return (
                            <tr key={name}>
                                <td className={classes}>
                                    <Typography variant="small" color="blue-gray" className="font-normal">
                                        {name}
                                    </Typography>
                                </td>
                                <td className={`${classes} bg-blue-gray-50/50`}>
                                    <Typography variant="small" color="blue-gray" className="font-normal">
                                        {email}
                                    </Typography>
                                </td>

                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </Card>
    );
}