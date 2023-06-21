import { Card, CardBody, CardHeader, Typography, CardFooter, Button, Input } from "@material-tailwind/react";
import axios from "axios";
import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import cookie from "cookie";
import AddUser from "../components/addUserDialog";
import EditUser from "../components/editUser";
import AddTeam from "../components/addTeamDialog";

export default function EmployeeTable() {
    const [employees, setEmployees] = useState([]);
    const cookies = cookie.parse(document.cookie);
    const TABLE_HEAD = ["Name", "Email", "Date Of Birth", ((cookies.role === 'admin') && "")];
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    function handleSearch(e) {
        setSearch(e.target.value);
    }
    function handleNextPage() {
        setPage(page + 1);
    }
    function handlePrevPage() {
        if (page > 1) setPage(page - 1);
    }
    useEffect(() => {
        axios.get(`/api/users?page=${page}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then((res) => {
                setEmployees(res.data);
            })
            .catch((err) => {
                alert(err);
            });
    }, [page]);
    useEffect(() => {
        axios.get(`/api/users/search?search=${search}`, { headers: { Authorization: `Bearer ${cookies.token}` } })
            .then((res) => {
                setEmployees(res.data);
            })
            .catch((err) => {
                alert(err);
            });
    }, [search]);
    return (
        <div className="justify-items-center overflow-auto mt-20 ml-20 mr-20">
            <Card className="overflow-scroll h-full w-full">
                <CardHeader floated={false} shadow={false} className="rounded-none">
                    <div className="mb-8 flex items-center justify-between gap-8">
                        <div>
                            <Typography variant="h2" color="blue-gray">
                                Members
                            </Typography>
                            <Typography variant="body1" color="blue-gray" className="leading-normal">
                                Here you can manage your members.
                            </Typography>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                            {(cookies.role === 'admin') && <AddTeam />}
                            {(cookies.role === 'admin') && <AddUser />}
                            <div className="w-full md:w-72 ">
                                <Input label="Search" icon={<MagnifyingGlassIcon className="h-5 w-5" />} onChange={handleSearch} />
                            </div>
                        </div>
                    </div>

                </CardHeader>
                <CardBody>
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
                            {employees.map(({ name, email, dob, _id }, index) => {
                                const isLast = index === employees.length - 1;
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
                                        <td className={classes}>
                                            <Typography variant="small" color="blue-gray" className="font-normal">
                                                {new Date(dob).toLocaleDateString()}
                                            </Typography>
                                        </td>
                                        {(cookies.role === 'admin') && (
                                            <td className={`${classes} bg-blue-gray-50/50 flex justify-center`}>
                                                <EditUser id={_id} />
                                            </td>)}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </CardBody>
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
        </div>

    );
}