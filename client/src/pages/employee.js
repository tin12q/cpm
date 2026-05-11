import { Card, CardBody, CardHeader, Typography, CardFooter, Button, Input } from "@material-tailwind/react";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import cookie from "cookie";
import AddUser from "../components/addUserDialog";
import EditUser from "../components/editUser";
import AddTeam from "../components/addTeamDialog";
import apiBase from "../helpers/apiBase";
import { Link } from "react-router-dom";

export default function EmployeeTable() {
  const [employees, setEmployees] = useState([]);
  const cookies = cookie.parse(document.cookie);
  const tableHead = ["Name", "Job", "Date Of Birth", cookies.role === "admin" && ""].filter(Boolean);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const request = search
      ? axios.get(`${apiBase}/users/search?search=${search}`, {
          headers: { Authorization: `Bearer ${cookies.token}` },
        })
      : axios.get(`${apiBase}/users?page=${page}`, {
          headers: { Authorization: `Bearer ${cookies.token}` },
        });

    request
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]));
  }, [page, search, cookies.token]);

  const stats = useMemo(() => {
    const total = employees.length;
    const managers = employees.filter((employee) => employee.role === "manager").length;
    const admins = employees.filter((employee) => employee.role === "admin").length;
    const contributors = Math.max(total - admins - managers, 0);
    return { total, managers, admins, contributors };
  }, [employees]);

  return (
    <div className="mt-20 min-h-screen px-4 pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Card className="overview-shell">
          <CardHeader floated={false} shadow={false} className="overview-header rounded-none">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
                  Team roster
                </Typography>
                <Typography variant="h2" color="blue-gray" className="sketch-heading">
                  Members
                </Typography>
                <Typography color="gray" className="text-base leading-7">
                  Search, admin actions, and profile links now sit inside the same card system used across the other overview pages.
                </Typography>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {cookies.role === "admin" && <AddTeam />}
                {cookies.role === "admin" && <AddUser />}
                <div className="w-full sm:w-72">
                  <Input className="sketch-input" label="Search members" icon={<MagnifyingGlassIcon className="h-5 w-5" />} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4 p-4 sm:p-6">
            <div className="overview-grid overview-grid--stats">
              <div className="ui-stat-card sketch-sticky-amber">
                <div className="ui-stat-card__eyebrow">Visible members</div>
                <div className="ui-stat-card__value">{stats.total}</div>
                <div className="ui-stat-card__meta">Current roster view</div>
              </div>
              <div className="ui-stat-card sketch-sticky-blue">
                <div className="ui-stat-card__eyebrow">Managers</div>
                <div className="ui-stat-card__value">{stats.managers}</div>
                <div className="ui-stat-card__meta">Leadership roles</div>
              </div>
              <div className="ui-stat-card sketch-sticky-green">
                <div className="ui-stat-card__eyebrow">Admins</div>
                <div className="ui-stat-card__value">{stats.admins}</div>
                <div className="ui-stat-card__meta">Workspace owners</div>
              </div>
              <div className="ui-stat-card sketch-sticky-pink">
                <div className="ui-stat-card__eyebrow">Contributors</div>
                <div className="ui-stat-card__value">{stats.contributors}</div>
                <div className="ui-stat-card__meta">Execution bandwidth</div>
              </div>
            </div>

            <div className="overview-section overflow-x-auto">
              <table className="min-w-[760px] w-full table-auto text-left">
                <thead>
                  <tr>
                    {tableHead.map((head) => (
                      <th key={head} className="border-b border-slate-200 bg-amber-50/70 p-4">
                        <Typography variant="small" color="blue-gray" className="font-semibold leading-none uppercase tracking-[0.18em] text-slate-600">
                          {head}
                        </Typography>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(({ name, email, dob, _id, role }, index) => {
                    const isLast = index === employees.length - 1;
                    const classes = isLast ? "p-4" : "p-4 border-b border-slate-100";
                    const roleClass = role === "admin" ? "ui-badge ui-badge--complete" : role === "manager" ? "ui-badge ui-badge--progress" : "ui-badge ui-badge--draft";

                    return (
                      <tr key={_id} className="transition-colors hover:bg-amber-50/40">
                        <td className={classes}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-amber-100 text-slate-700 shadow-[3px_3px_0_rgba(17,24,39,0.06)]">
                              <span className="text-xs font-semibold">{name?.charAt(0) || "U"}</span>
                            </div>
                            <div>
                              <Typography variant="small" color="blue-gray" className="font-medium">
                                <Link to={`/employees/${_id}`} className="text-slate-800 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-slate-950">
                                  {name}
                                </Link>
                              </Typography>
                              <Typography variant="small" color="blue-gray" className="font-normal opacity-60">
                                {email}
                              </Typography>
                            </div>
                          </div>
                        </td>
                        <td className={`${classes} bg-white/70`}>
                          <span className={roleClass}>{role || "Employee"}</span>
                        </td>
                        <td className={classes}>
                          <Typography variant="small" color="blue-gray" className="font-normal text-slate-600">
                            {new Date(dob).toLocaleDateString()}
                          </Typography>
                        </td>
                        {cookies.role === "admin" && (
                          <td className={`${classes} bg-white/70`}>
                            <div className="flex justify-center">
                              <EditUser id={_id} />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
          <CardFooter className="flex items-center justify-between border-t border-dashed border-slate-300/80 bg-white/50 px-4 py-4 sm:px-6">
            <Typography variant="small" color="blue-gray" className="font-normal">
              Page {page}
            </Typography>
            <div className="flex gap-2">
              <Button variant="text" className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none" size="sm" onClick={() => setPage((current) => (current > 1 ? current - 1 : 1))}>
                Previous
              </Button>
              <Button variant="text" className="ui-button ui-button--blue px-4 py-2 text-slate-800 shadow-none" size="sm" onClick={() => setPage((current) => current + 1)}>
                Next
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
