import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Typography,
} from "@material-tailwind/react";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import cookie from "cookie";
import AddTask from "./addTaskDialog";
import EditTask from "./editTask";
import TaskDone from "./taskDoneConfirm";
import apiBase from "../helpers/apiBase";
import "../css/project.css";
import "../css/task.css";
import { getStageName, normalizeStages } from "../helpers/stage";

const PAGE_SIZE = 8;

function getStatusTone(status) {
  if (status === "completed") return "sketch-status sketch-status--done";
  if (status === "late") return "sketch-status sketch-status--late";
  return "sketch-status sketch-status--progress";
}

export default function TaskComp({ id, projectId, tasks: providedTasks, onRefresh, stages = [] }) {
  const cookies = cookie.parse(document.cookie);
  const routeProjectId = useParams().id;
  const activeProjectId = projectId || routeProjectId;
  const [tasks, setTasks] = useState(null);
  const [userMap, setUserMap] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const headers = useMemo(() => ({ Authorization: `Bearer ${cookies.token}` }), [cookies.token]);
  const stageList = useMemo(() => normalizeStages(stages), [stages]);

  useEffect(() => {
    axios
      .get(`${apiBase}/users/getAll`, { headers })
      .then((res) => {
        setUserMap(
          (res.data || []).reduce((map, user) => {
            map[user._id] = user;
            return map;
          }, {})
        );
      })
      .catch((error) => {
        setMessage(error.response?.data?.error || error.message || "Unable to load users.");
      });
  }, [headers]);

  useEffect(() => {
    if (Array.isArray(providedTasks)) {
      setTasks(providedTasks);
      return;
    }

    axios
      .get(`${apiBase}/tasks/project/${activeProjectId}?limit=1000`, { headers })
      .then((res) => {
        setTasks(res.data || []);
      })
      .catch((error) => {
        setMessage(error.response?.data?.error || error.message || "Unable to load tasks.");
      });
  }, [activeProjectId, headers, providedTasks]);

  useEffect(() => {
    setPage(1);
  }, [search, tasks]);

  const filteredTasks = useMemo(() => {
    const source = Array.isArray(tasks) ? tasks : [];
    if (!search.trim()) return source;

    const term = search.toLowerCase();
    return source.filter((task) => {
      const assignedLabel = Array.isArray(task.assigned_to)
        ? task.assigned_to
            .map((member) => {
              const userId = typeof member === "object" ? member._id || String(member) : member;
              return userMap?.[userId]?.name || member?.name || String(member);
            })
            .join(" ")
        : "";

      return [task.title, task.description, task.status, task.stage, assignedLabel].join(" ").toLowerCase().includes(term);
    });
  }, [search, tasks, userMap]);

  const pagedTasks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTasks.slice(start, start + PAGE_SIZE);
  }, [filteredTasks, page]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));

  if (!tasks || !userMap) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading...</div>;
  }

  return (
    <Card className="sketch-panel overflow-hidden">
      <CardHeader floated={false} shadow={false} className="m-0 border-b-2 border-dashed border-slate-300 bg-[#fef9c3] p-5 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <Typography variant="h3" className="sketch-heading text-2xl sm:text-3xl">
              Task List
            </Typography>
            <Typography className="sketch-subtitle mt-1 text-sm sm:text-base">
              Track scope, status, and stage changes from one page.
            </Typography>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_auto_auto] sm:items-center">
            <Link to="/tasks" className="w-full sm:w-auto">
              <Button variant="outlined" color="blue-gray" size="md" className="sketch-button sketch-button--blue w-full sm:w-auto">
                View all
              </Button>
            </Link>
            <AddTask id={id} projectId={activeProjectId} stages={stageList} onSuccess={onRefresh} />
            <div className="w-full md:w-72">
              <Input label="Search" icon={<MagnifyingGlassIcon className="h-5 w-5" />} value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardBody className="overflow-x-auto px-0">
        <table className="mt-2 w-full min-w-[920px] table-auto text-left">
          <thead>
            <tr>
              {["Task", "Description", "Status", "Stage", "Due Date", "Assigned To", cookies.role !== "employee" && "Edit", "Done"]
                .filter(Boolean)
                .map((head) => (
                  <th key={head} className="border-y border-dashed border-slate-200 bg-white/80 p-4">
                    <Typography variant="small" className="font-semibold uppercase tracking-[0.15em] text-slate-500">
                      {head}
                    </Typography>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {pagedTasks.map(({ _id, title, due_date, description, status, stage, assigned_to }, index) => {
              const isLast = index === pagedTasks.length - 1;
              const classes = isLast ? "p-4 align-top" : "p-4 align-top border-b border-slate-100";

              return (
                <tr key={_id}>
                  <td className={classes}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border-2 border-dashed border-slate-300 bg-white/90 text-sm font-black text-slate-700 shadow-[4px_4px_0_rgba(31,41,55,0.08)]">
                        {title?.charAt(0) || "T"}
                      </div>
                      <div className="flex flex-col">
                        <Typography variant="small" color="blue-gray" className="font-semibold">
                          {title}
                        </Typography>
                        <Typography variant="small" color="blue-gray" className="font-normal opacity-70">
                          #{String(_id).slice(-6)}
                        </Typography>
                      </div>
                    </div>
                  </td>
                  <td className={classes}>
                    <Typography variant="small" color="blue-gray" className="font-normal text-slate-700">
                      {description ? description.slice(0, 80) : "No description"}
                    </Typography>
                  </td>
                  <td className={classes}>
                    <span className={getStatusTone(status)}>{status || "in progress"}</span>
                  </td>
                  <td className={classes}>
                    <span className="sketch-chip bg-white/90 text-xs">{getStageName(stage, stageList)}</span>
                  </td>
                  <td className={classes}>
                    <Typography variant="small" color="blue-gray" className="font-normal">
                      {due_date ? new Date(due_date).toLocaleDateString() : "No date"}
                    </Typography>
                  </td>
                  <td className={classes}>
                    <Typography variant="small" color="blue-gray" className="font-normal leading-6">
                      {assigned_to && assigned_to.length > 0 ? (
                        assigned_to.map((user, itemIndex) => {
                          const userId = typeof user === "object" ? user._id || user.toString() : user;
                          const userName = userMap[userId]?.name || user?.name || "Unknown";
                          return itemIndex === assigned_to.length - 1 ? userName : `${userName}, `;
                        })
                      ) : (
                        <span className="italic text-slate-400">Unassigned</span>
                      )}
                    </Typography>
                  </td>
                  <td className={classes}>
                    {cookies.role !== "employee" && <EditTask id={id} idt={_id} stages={stageList} onSuccess={onRefresh} />}
                  </td>
                  <td className={classes}>
                    {status === "in progress" && <TaskDone id={_id} onSuccess={onRefresh} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardBody>
      <CardFooter className="flex flex-col gap-4 border-t-2 border-dashed border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography variant="small" color="blue-gray" className="font-semibold">
            Page {page} / {totalPages}
          </Typography>
          {message && <Typography className="mt-1 text-xs text-rose-600">{message}</Typography>}
        </div>
        <div className="flex gap-2">
          <Button variant="outlined" color="blue-gray" size="sm" className="sketch-button sketch-button--blue" onClick={() => setPage((current) => (current > 1 ? current - 1 : 1))}>
            Previous
          </Button>
          <Button variant="outlined" color="blue-gray" size="sm" className="sketch-button sketch-button--blue" onClick={() => setPage((current) => (current < totalPages ? current + 1 : current))}>
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
