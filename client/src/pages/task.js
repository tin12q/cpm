import { useEffect, useMemo, useState } from "react";
import cookie from "cookie";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Option,
  Select,
  Textarea,
  Typography,
} from "@material-tailwind/react";
import "../css/project.css";
import "../css/task.css";
import apiBase from "../helpers/apiBase";
import TaskNotesPanel from "../components/taskNotesPanel";
import { getStageKey, getStageName, normalizeStages } from "../helpers/stage";
const STATUS_OPTIONS = ["in progress", "completed", "late"];

function buildTaskError(error) {
  const status = error?.response?.status;
  if (status === 404) {
    return {
      title: "Task not found",
      description: "This task may have been removed or is no longer linked to a project you can access.",
    };
  }
  if (status === 403) {
    return {
      title: "Task unavailable",
      description: "Your current account can sign in, but it does not have access to this task.",
    };
  }
  return {
    title: "Task unavailable",
    description: error?.response?.data?.error || error?.message || "The task details could not be loaded.",
  };
}

const Task = () => {
  const [task, setTask] = useState(null);
  const [project, setProject] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("in progress");
  const [stage, setStage] = useState("backlog");
  const [assignedTo, setAssignedTo] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [priority, setPriority] = useState(3);
  const [canParallelize, setCanParallelize] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const [message, setMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [assignmentPreview, setAssignmentPreview] = useState(null);
  const [previewStamp, setPreviewStamp] = useState(null);

  const navigate = useNavigate();
  const { id } = useParams();
  const cookies = cookie.parse(document.cookie);
  const headers = useMemo(() => ({ Authorization: `Bearer ${cookies.token}` }), [cookies.token]);

  useEffect(() => {
    const loadTask = async () => {
      setLoading(true);
      setErrorState(null);
      setMessage("");

      try {
        const taskRes = await axios.get(`${apiBase}/tasks/${id}`, { headers });
        const taskData = taskRes.data;
        setTask(taskData);
        setTitle(taskData.title || "");
        setDescription(taskData.description || "");
        setDueDate(taskData.due_date ? new Date(taskData.due_date).toISOString().split("T")[0] : "");
        setStatus(taskData.status || "in progress");
        setAssignedTo(
          Array.isArray(taskData.assigned_to)
            ? taskData.assigned_to
                .map((item) => (typeof item === "object" ? item._id || item.name || item.email : item))
                .join(", ")
            : taskData.assigned_to || ""
        );
        setDifficulty(taskData.difficulty || 2);
        setPriority(taskData.priority || 3);
        setCanParallelize(taskData.can_parallelize !== false);

        if (taskData.project) {
          try {
            const projectRes = await axios.get(`${apiBase}/projects/${taskData.project}`, { headers });
            setProject(projectRes.data);
            setStage(getStageKey(taskData.stage, projectRes.data?.stages));
          } catch (projectError) {
            setProject(null);
            setStage(getStageKey(taskData.stage));
          }
        } else {
          setProject(null);
          setStage(getStageKey(taskData.stage));
        }
      } catch (error) {
        setErrorState(buildTaskError(error));
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [headers, id]);

  useEffect(() => {
    if (!task?._id) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError("");

      try {
        const response = await axios.post(
          `${apiBase}/assignments/preview`,
          {
            task_ids: [task._id],
            task: {
              id: task._id,
              title,
              description,
              due_date: dueDate ? new Date(dueDate).getTime() : null,
              status,
              stage,
              difficulty,
              priority,
              can_parallelize: canParallelize,
            },
            draft_task: {
              id: task._id,
              title,
              description,
              due_date: dueDate ? new Date(dueDate).getTime() : null,
              status,
              stage,
              difficulty,
              priority,
              can_parallelize: canParallelize,
            },
          },
          { headers }
        );

        if (cancelled) return;

        const assignments = Array.isArray(response.data?.assignments) ? response.data.assignments : [];
        const nextPreview = assignments.find((item) => String(item?.task?.id) === String(task._id)) || assignments[0] || null;
        setAssignmentPreview(nextPreview);
        setPreviewStamp(new Date());
      } catch (error) {
        if (cancelled) return;
        setAssignmentPreview(null);
        setPreviewError(error.response?.data?.error || error.message || "Unable to preview assignment.");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 550);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [headers, task, title, description, dueDate, status, stage, difficulty, priority, canParallelize]);

  const projectStages = useMemo(() => normalizeStages(project?.stages), [project]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await axios.put(
        `${apiBase}/tasks/${id}`,
        {
          title,
          description,
          due_date: dueDate ? new Date(dueDate).getTime() : null,
          status,
          stage,
          assigned_to: assignedTo,
          difficulty,
          priority,
          can_parallelize: canParallelize,
        },
        { headers }
      );
      navigate("/tasks");
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || "Unable to save the task.");
    } finally {
      setSaving(false);
    }
  };

  const overview = useMemo(
    () => [
      { label: "Stage", value: getStageName(stage, projectStages) },
      { label: "Difficulty", value: difficulty === 1 ? "Basic" : difficulty === 2 ? "Easy" : difficulty === 3 ? "Medium" : "Hard" },
      { label: "Priority", value: priority === 1 ? "Very Low" : priority === 2 ? "Low" : priority === 3 ? "Medium" : priority === 4 ? "High" : "Critical" },
      { label: "Parallel", value: canParallelize ? "Yes" : "No" },
    ],
    [canParallelize, difficulty, priority, projectStages, stage]
  );

  if (loading) {
    return (
      <div className="sketch-page">
        <div className="sketch-shell">
          <div className="sketch-panel p-8 text-center text-slate-600">Loading task...</div>
        </div>
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="sketch-page">
        <div className="sketch-shell">
          <Card className="sketch-panel overflow-hidden">
            <CardBody className="project-empty-state flex flex-col items-center gap-4 p-8 text-center sm:p-12">
              <div className="project-empty-doodle">!</div>
              <Typography variant="h2" className="sketch-heading text-3xl sm:text-4xl">
                {errorState.title}
              </Typography>
              <Typography className="sketch-subtitle max-w-2xl text-base sm:text-lg">
                {errorState.description}
              </Typography>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button className="sketch-button px-5 py-3 text-sm font-semibold" onClick={() => window.location.reload()}>
                  Retry
                </Button>
                <Button className="sketch-button sketch-button--blue px-5 py-3 text-sm font-semibold" onClick={() => navigate("/tasks")}>
                  Back to tasks
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="sketch-page">
      <div className="sketch-shell grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="sketch-panel sketch-panel-hover overflow-hidden">
          <CardHeader floated={false} shadow={false} className="m-0 border-b-2 border-dashed border-slate-300 bg-[#dbeafe] p-6">
            <Typography variant="h3" className="sketch-heading text-3xl">
              Edit Task
            </Typography>
            <Typography className="sketch-subtitle mt-1 text-sm">
              Update status and stage independently, then keep the working context in notes.
            </Typography>
          </CardHeader>
          <CardBody className="p-6">
            <form onSubmit={handleSubmit} className="task-grid">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="task-field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Title
                  </Typography>
                  <Input type="text" value={title} label="Title" onChange={(event) => setTitle(event.target.value)} size="lg" />
                </div>
                <div className="task-field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Due Date
                  </Typography>
                  <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} size="lg" />
                </div>
              </div>

              <div className="task-field">
                <Typography variant="small" className="font-semibold text-slate-700">
                  Description
                </Typography>
                <Textarea value={description} label="Description" onChange={(event) => setDescription(event.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="task-field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Status
                  </Typography>
                  <Select label="Status" value={status} onChange={(value) => setStatus(value)}>
                    {STATUS_OPTIONS.map((option) => (
                      <Option key={option} value={option}>
                        {option}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div className="task-field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Stage
                  </Typography>
                  <Select label="Stage" value={stage} onChange={(value) => setStage(value)}>
                    {projectStages.map((option) => (
                      <Option key={option.key} value={option.key}>
                        {option.name}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div className="task-field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Assigned To
                  </Typography>
                  <Input type="text" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Comma-separated assignee ids" size="lg" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="task-field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Difficulty
                  </Typography>
                  <Select label="Difficulty" value={String(difficulty)} onChange={(value) => setDifficulty(parseInt(value, 10))}>
                    <Option value="1">Basic</Option>
                    <Option value="2">Easy</Option>
                    <Option value="3">Medium</Option>
                    <Option value="4">Hard</Option>
                  </Select>
                </div>
                <div className="task-field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Priority
                  </Typography>
                  <Select label="Priority" value={String(priority)} onChange={(value) => setPriority(parseInt(value, 10))}>
                    <Option value="1">Very Low</Option>
                    <Option value="2">Low</Option>
                    <Option value="3">Medium</Option>
                    <Option value="4">High</Option>
                    <Option value="5">Critical</Option>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-[20px] border-2 border-dashed border-slate-300 bg-white/85 p-4 shadow-[6px_6px_0_rgba(31,41,55,0.08)]">
                <div>
                  <Typography variant="small" className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Parallel execution
                  </Typography>
                  <Typography className="text-sm text-slate-700">
                    Keep this on when the task can be split safely.
                  </Typography>
                </div>
                <input type="checkbox" checked={canParallelize} onChange={(event) => setCanParallelize(event.target.checked)} className="h-5 w-5 rounded border-2 border-slate-400" />
              </div>

              {message && (
                <div className="rounded-[18px] border-2 border-dashed border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                  {message}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="text" className="rounded-full px-5 py-2 font-semibold text-slate-600" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" color="blue" size="lg" className="sketch-button px-5 py-2 font-semibold shadow-none" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card className="sketch-panel sketch-panel-hover overflow-hidden">
            <CardHeader floated={false} shadow={false} className="m-0 border-b-2 border-dashed border-slate-300 bg-[#fef9c3] p-6">
              <Typography variant="h4" className="sketch-heading">
                Task snapshot
              </Typography>
              <Typography className="sketch-subtitle mt-1 text-sm">
                Keep the key values visible while editing.
              </Typography>
            </CardHeader>
            <CardBody className="space-y-4 p-6">
              <div className="sketch-note sketch-sticky-blue p-4">
                <Typography variant="small" className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Current title
                </Typography>
                <Typography variant="h5" className="mt-2 sketch-heading">
                  {title || task?.title}
                </Typography>
                <Typography className="sketch-subtitle mt-2 text-sm">
                  {description || task?.description || "No description"}
                </Typography>
              </div>
              <div className="grid gap-3">
                {overview.map((item) => (
                  <div key={item.label} className="sketch-note sketch-sticky-amber p-4">
                    <Typography variant="small" className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {item.label}
                    </Typography>
                    <Typography className="mt-2 text-xl font-black text-slate-900">{item.value}</Typography>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="sketch-panel sketch-panel-hover overflow-hidden">
            <CardHeader floated={false} shadow={false} className="m-0 border-b-2 border-dashed border-slate-300 bg-[#d1fae5] p-6">
              <Typography variant="h4" className="sketch-heading">
                MCMF suggestion
              </Typography>
              <Typography className="sketch-subtitle mt-1 text-sm">
                Recommendation refreshes automatically after you stop editing. Saving is not required.
              </Typography>
            </CardHeader>
            <CardBody className="space-y-4 p-6">
              <div className="rounded-[18px] border-2 border-dashed border-slate-200 bg-white/75 px-4 py-3">
                <Typography variant="small" className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Preview status
                </Typography>
                <Typography className="mt-2 text-sm text-slate-700">
                  {previewLoading ? "Refreshing recommendation..." : previewStamp ? `Updated ${previewStamp.toLocaleTimeString()}` : "Waiting for the first preview run."}
                </Typography>
              </div>

              {previewError && (
                <div className="rounded-[18px] border-2 border-dashed border-rose-200 bg-rose-50/85 px-4 py-3 text-sm text-rose-700">
                  {previewError}
                </div>
              )}

              {!previewError && !assignmentPreview && !previewLoading && (
                <div className="rounded-[18px] border-2 border-dashed border-slate-200 bg-white/75 px-4 py-5 text-sm text-slate-500">
                  No recommendation returned yet for this task.
                </div>
              )}

              {assignmentPreview && (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="sketch-note sketch-sticky-blue p-4">
                      <Typography variant="small" className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Suggested people
                      </Typography>
                      <Typography className="mt-2 text-2xl font-black text-slate-900">
                        {assignmentPreview.number_of_people || assignmentPreview.assigned_users?.length || 0}
                      </Typography>
                    </div>
                    <div className="sketch-note sketch-sticky-amber p-4">
                      <Typography variant="small" className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Priority
                      </Typography>
                      <Typography className="mt-2 text-2xl font-black text-slate-900">
                        {assignmentPreview.task?.priority || priority}
                      </Typography>
                    </div>
                    <div className="sketch-note sketch-sticky-pink p-4">
                      <Typography variant="small" className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Difficulty
                      </Typography>
                      <Typography className="mt-2 text-2xl font-black text-slate-900">
                        {assignmentPreview.task?.difficulty || difficulty}
                      </Typography>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(assignmentPreview.assigned_users || []).map((user) => (
                      <div key={user.id} className="sketch-note p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <Typography className="text-base font-black text-slate-900">{user.name || user.email || "Unknown"}</Typography>
                            <Typography className="text-sm text-slate-500">{user.email || "No email available"}</Typography>
                          </div>
                          <span className="sketch-chip bg-white/90 text-xs">
                            Score {Math.round(Number(user.combined_score || user.mcmf_score || 0) * 100)}%
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Number.isFinite(user.skill_score) && <span className="sketch-chip bg-white/90 text-xs">Skill {Math.round(user.skill_score * 100)}%</span>}
                          {Number.isFinite(user.mcmf_score) && <span className="sketch-chip bg-white/90 text-xs">MCMF {Math.round(user.mcmf_score * 100)}%</span>}
                          {Number.isFinite(user.productivity_score) && <span className="sketch-chip bg-white/90 text-xs">Productivity {Math.round(user.productivity_score * 100)}%</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <TaskNotesPanel taskId={id} />
        </div>
      </div>
    </div>
  );
};

export default Task;
