import { Card, CardHeader, Typography, CardFooter, Button } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import axios from "axios";
import cookie from "cookie";

const TABLE_HEAD = ["Name", "Job"];

export default function MemberComp(props) {
    const id = props.id;
    const [members, setMembers] = useState([]);
    const [page, setPage] = useState(1);
    function handleNextPage() {
        setPage(page + 1);
    }
    function handlePrevPage() {
        if (page > 1) setPage(page - 1);
    }

    useEffect(() => {
        axios.get((process.env.REACT_APP_API_URL ?? `http://localhost:1337/`) + `api/teams/users/${id}?page=${page}`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                setMembers(res.data);
            })
            .catch(err => {
                alert(err);
            });

    }, [page]);
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
            <CardFooter className="flex items-center justify-between border-t border-blue-gray-50 p-4">
                <Typography variant="small" color="blue-gray" className="font-normal">
                    Page {page}
                </Typography>
                <div className="flex gap-2">
                    <Button variant="outlined" color="blue-gray" size="sm" onClick={handlePrevPage}>
                        Previous
                    </Button>
                    <Button variant="outlined" color="blue-gray" size="sm" onClick={handleNextPage}>
                        Next
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}