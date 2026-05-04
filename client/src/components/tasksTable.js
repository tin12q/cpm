import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Typography,
  Input,
} from "@material-tailwind/react";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";

const shell = "overview-shell";

function getStatusMeta(status) {
  if (status === "completed") return { label: "Completed", className: "ui-badge ui-badge--complete" };
  if (status === "in progress") return { label: "In Progress", className: "ui-badge ui-badge--progress" };
  return { label: "Late", className: "ui-badge ui-badge--late" };
}

function formatDescription(description, org) {
  const text = description || "";
  return {
    main: text.length > 56 ? `${text.slice(0, 56)}...` : text || "No description yet.",
    sub: org || "No source tag",
  };
}

export default function TaskTable() {
  const cookies = cookie.parse(document.cookie);
  const [tasks, setTasks] = useState(null);
  const [userMap, setUserMap] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const tableHead = ["Task", "Description", "Status", "Due Date", "Assigned To"];

  useEffect(() => {
    axios
      .get(`${apiBase}/users/getAll`, {
        headers: { Authorization: `Bearer ${cookies.token}` },
      })
      .then((res) => {
        setUserMap(
          (res.data || []).reduce((map, user) => {
            map[user._id] = user;
            return map;
          }, {})
        );
      })
      .catch(() => setUserMap({}));
  }, [cookies.token]);

  useEffect(() => {
    const request = search
      ? axios.get(`${apiBase}/tasks/name?name=${search}&limit=10`, {
          headers: { Authorization: `Bearer ${cookies.token}` },
        })
      : axios.get(`${apiBase}/tasks?page=${page}&limit=10`, {
          headers: { Authorization: `Bearer ${cookies.token}` },
        });

    request
      .then((res) => setTasks(res.data || []))
      .catch(() => setTasks([]));
  }, [page, search, cookies.token]);

  const stats = useMemo(() => {
    const rows = tasks || [];
    const summary = { total: rows.length, completed: 0, progress: 0, late: 0 };
    rows.forEach((task) => {
      if (task.status === "completed") summary.completed += 1;
      else if (task.status === "in progress") summary.progress += 1;
      else summary.late += 1;
    });
    return summary;
  }, [tasks]);

  if (!tasks || !userMap) {
    return <div className="px-6 py-10 text-slate-600">Loading task ledger...</div>;
  }

  return (
    <Card className={shell}>
      <CardHeader floated={false} shadow={false} className="overview-header rounded-none">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
              Task ledger
            </Typography>
            <Typography variant="h2" color="blue-gray" className="sketch-heading">
              Task List
            </Typography>
            <Typography color="gray" className="text-base leading-7">
              A cleaner task board with stable badges, clearer row rhythm, and less visual drift between pages.
            </Typography>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-80">
              <Input className="sketch-input" label="Search tasks" icon={<MagnifyingGlassIcon className="h-5 w-5" />} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4 p-4 sm:p-6">
        <div className="overview-grid overview-grid--stats">
          <div className="ui-stat-card sketch-sticky-amber">
            <div className="ui-stat-card__eyebrow">Visible tasks</div>
            <div className="ui-stat-card__value">{stats.total}</div>
            <div className="ui-stat-card__meta">Current table rows</div>
          </div>
          <div className="ui-stat-card sketch-sticky-green">
            <div className="ui-stat-card__eyebrow">Completed</div>
            <div className="ui-stat-card__value">{stats.completed}</div>
            <div className="ui-stat-card__meta">Closed and delivered</div>
          </div>
          <div className="ui-stat-card sketch-sticky-blue">
            <div className="ui-stat-card__eyebrow">In progress</div>
            <div className="ui-stat-card__value">{stats.progress}</div>
            <div className="ui-stat-card__meta">Active work items</div>
          </div>
          <div className="ui-stat-card sketch-sticky-pink">
            <div className="ui-stat-card__eyebrow">Late</div>
            <div className="ui-stat-card__value">{stats.late}</div>
            <div className="ui-stat-card__meta">Needs attention</div>
          </div>
        </div>

        <div className="overview-section overflow-x-auto">
          <table className="min-w-[980px] w-full table-auto text-left">
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
              {tasks.map(({ _id, title, email, due_date, description, org, status, assigned_to }, index) => {
                const isLast = index === tasks.length - 1;
                const classes = isLast ? "p-4" : "p-4 border-b border-slate-100";
                const detail = formatDescription(description, org);
                const statusMeta = getStatusMeta(status);

                return (
                  <tr key={_id} className="transition-colors hover:bg-amber-50/40">
                    <td className={classes}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-amber-100 text-slate-700 shadow-[3px_3px_0_rgba(17,24,39,0.06)]">
                          <span className="text-xs font-semibold">T</span>
                        </div>
                        <div className="flex flex-col">
                          <Typography variant="medium" color="blue-gray" className="font-medium">
                            {title}
                          </Typography>
                          <Typography variant="small" color="blue-gray" className="font-normal opacity-70">
                            {email || "Task entry"}
                          </Typography>
                        </div>
                      </div>
                    </td>
                    <td className={classes}>
                      <div className="flex flex-col gap-1">
                        <Typography variant="small" color="blue-gray" className="font-normal text-slate-700">
                          {detail.main}
                        </Typography>
                        <Typography variant="small" color="blue-gray" className="font-normal opacity-60">
                          {detail.sub}
                        </Typography>
                      </div>
                    </td>
                    <td className={classes}>
                      <span className={statusMeta.className}>{statusMeta.label}</span>
                    </td>
                    <td className={classes}>
                      <Typography variant="small" color="blue-gray" className="font-normal text-slate-700">
                        {new Date(due_date).toLocaleDateString()}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <div className="flex flex-wrap gap-2">
                        {(assigned_to || []).map((user) => {
                          const userId = typeof user === "object" ? user._id || user.id || user.email : user;
                          const label = typeof user === "object" ? user.name || user.email || "Unknown" : userMap[userId]?.name || "Unknown";
                          return (
                            <span key={String(userId)} className="ui-table-chip">
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
      <CardFooter className="flex items-center justify-between border-t border-dashed border-slate-300/80 bg-white/50 p-4">
        <Typography variant="small" color="blue-gray" className="font-normal">
          Page {page} · {stats.total} rows
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
  );
}
