import { Card, CardHeader, Typography } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import axios from "axios";
import cookie from "cookie";
const TABLE_HEAD = ["Name", "Job"];

export default function MemberComp(props) {
    const [members, setMembers] = useState([]);
    const id = props.id;
    useEffect(() => {
        axios.get(`/api/teams/users/${id}`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                setMembers(res.data);
            })
            .catch(err => { console.log(err); });

    }, []);
    if (!members) return (<div></div>);
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
                    {members.map(({ _id, name, email }, index) => {
                        const isLast = index === members.length - 1;
                        const classes = isLast ? "p-4" : "p-4 border-b border-blue-gray-50";
                        return (
                            <tr key={_id}>
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