import { useCallback, useEffect, useMemo, useState } from "react";
import cookie from "cookie";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Dialog,
  Tabs,
  Tab,
  TabPanel,
  TabsBody,
  TabsHeader,
  Typography,
} from "@material-tailwind/react";
import "../css/project.css";
import TaskComp from "../components/taskComp";
import MemberComp from "../components/memberComp";
import PieChart from "../components/PieChart";
import GanttChart from "../components/GanttChart";
import KanbanBoard from "../components/kanbanBoard";
import apiBase from "../helpers/apiBase";
import { getStageName, normalizeStages } from "../helpers/stage";

const STAGE_COLORS = ["amber", "blue", "violet", "green", "rose", "teal", "slate"];

function getTeamEntries(project) {
  if (Array.isArray(project?.teams)) return project.teams;
  if (project?.team) return [project.team];
  return [];
}

function getTeamIds(project) {
  return getTeamEntries(project)
    .map((team) => (typeof team === "object" ? team?._id || team?.id : team))
    .filter(Boolean);
}

function buildUserMap(users = []) {
  return users.reduce((map, user) => {
    if (user?._id) map[String(user._id)] = user;
    return map;
  }, {});
}

function normalizeMemberRecord(member, userMap = {}) {
  if (!member) return null;

  if (typeof member === "object") {
    const id = member._id || member.id;
    if (id && userMap[String(id)]) return userMap[String(id)];
    return {
      _id: id || member.email || member.name,
      name: member.name || member.email || "Unknown",
      email: member.email || "",
      role: member.role,
      skills: member.skills || [],
    };
  }

  const resolved = userMap[String(member)];
  if (resolved) return resolved;

  return {
    _id: String(member),
    name: "Unknown",
    email: "",
  };
}

function collectEmbeddedMembers(project, userMap = {}) {
  const embedded = [];

  if (Array.isArray(project?.members)) {
    embedded.push(...project.members);
  }

  getTeamEntries(project).forEach((team) => {
    if (team && typeof team === "object" && Array.isArray(team.members)) {
      embedded.push(...team.members);
    }
  });

  const seen = new Set();
  return embedded
    .map((member) => normalizeMemberRecord(member, userMap))
    .filter((member) => {
      const key = String(member?._id || member?.email || member?.name || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function resolveProjectMembers(project, userCatalog, headers) {
  const userMap = buildUserMap(userCatalog);
  const embeddedMembers = collectEmbeddedMembers(project, userMap);
  const teamIds = getTeamIds(project);

  if (teamIds.length === 0) {
    return embeddedMembers;
  }

  const teamResults = await Promise.allSettled(teamIds.map((teamId) => axios.get(`${apiBase}/teams/${teamId}`, { headers })));
  const teamMembers = teamResults.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    return Array.isArray(result.value.data?.members) ? result.value.data.members : [];
  });

  const seen = new Set();
  return [...embeddedMembers, ...teamMembers]
    .map((member) => normalizeMemberRecord(member, userMap))
    .filter((member) => {
      const key = String(member?._id || member?.email || member?.name || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildProjectError(error) {
  const status = error?.response?.status;
  if (status === 404) {
    return {
      title: "Project not found",
      description: "The project may have been removed, renamed, or is outside your current access scope.",
    };
  }
  if (status === 403) {
    return {
      title: "Project unavailable",
      description: "Your role can sign in, but this project is not available to your current account.",
    };
  }
  return {
    title: "Project unavailable",
    description: error?.response?.data?.error || error?.message || "The project details could not be loaded right now.",
  };
}

function formatDueDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toISOString().split("T")[0];
}

function slugifyStageKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Project() {
  const [projectData, setProjectData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [completedTasks, setCompletedTasks] = useState(null);
  const [late, setLate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [inlineMessage, setInlineMessage] = useState("");
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [draftStages, setDraftStages] = useState([]);
  const [draggingStageIndex, setDraggingStageIndex] = useState(null);
  const [stageSaving, setStageSaving] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const cookies = cookie.parse(document.cookie);
  const headers = useMemo(() => ({ Authorization: `Bearer ${cookies.token}` }), [cookies.token]);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setErrorState(null);

    const [usersRes, projectRes, tasksRes, completedRes, lateRes] = await Promise.allSettled([
      axios.get(`${apiBase}/users/getAll`, { headers }),
      axios.get(`${apiBase}/projects/${id}`, { headers }),
      axios.get(`${apiBase}/tasks/project/${id}?limit=1000`, { headers }),
      axios.get(`${apiBase}/tasks/completed/${id}`, { headers }),
      axios.get(`${apiBase}/tasks/lated/${id}`, { headers }),
    ]);

    const userCatalog = usersRes.status === "fulfilled" ? usersRes.value.data || [] : [];
    if (projectRes.status !== "fulfilled") {
      setProjectData(null);
      setTasks([]);
      setMembers([]);
      setCompletedTasks({ completed: 0 });
      setLate({ lated: 0 });
      setErrorState(buildProjectError(projectRes.reason));
      setLoading(false);
      return;
    }

    const project = projectRes.value.data;
    if (!project || typeof project !== "object") {
      setProjectData(null);
      setTasks([]);
      setMembers([]);
      setCompletedTasks({ completed: 0 });
      setLate({ lated: 0 });
      setErrorState({
        title: "Project not found",
        description: "This project no longer exists or cannot be loaded with the current response payload.",
      });
      setLoading(false);
      return;
    }
    setProjectData(project);
    setTasks(tasksRes.status === "fulfilled" ? tasksRes.value.data || [] : []);
    setCompletedTasks(completedRes.status === "fulfilled" ? completedRes.value.data : { completed: 0 });
    setLate(lateRes.status === "fulfilled" ? lateRes.value.data : { lated: 0 });

    try {
      const nextMembers = await resolveProjectMembers(project, userCatalog, headers);
      setMembers(nextMembers);
    } catch (error) {
      setMembers([]);
    }

    setLoading(false);
  }, [headers, id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleTaskStageChange = async (task, nextStage) => {
    if (!task?._id || task.stage === nextStage) return;

    const previousTasks = tasks;
    setPendingTaskId(task._id);
    setInlineMessage("");
    setTasks((current) => current.map((item) => (item._id === task._id ? { ...item, stage: nextStage } : item)));

    try {
      await axios.put(`${apiBase}/tasks/${task._id}`, { stage: nextStage }, { headers });
      setInlineMessage(`Moved "${task.title}" to ${getStageName(nextStage, projectStages)}.`);
    } catch (error) {
      setTasks(previousTasks);
      setInlineMessage(error.response?.data?.error || "Stage update is not available on the current backend yet.");
    } finally {
      setPendingTaskId(null);
    }
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = Number(completedTasks?.completed || 0);
    const lateCount = Number(late?.lated || 0);
    return {
      total,
      completed,
      lateCount,
      active: Math.max(total - completed - lateCount, 0),
    };
  }, [tasks, completedTasks, late]);

  const projectStages = useMemo(() => normalizeStages(projectData?.stages), [projectData]);
  const primaryTeamId = useMemo(() => getTeamIds(projectData)[0] || "", [projectData]);
  const statusLabel =
    projectData?.status === "in progress"
      ? "In progress"
      : projectData?.status === "completed"
      ? "Completed"
      : "Late";
  const statusTone =
    projectData?.status === "in progress"
      ? "bg-[#dbeafe] text-slate-900"
      : projectData?.status === "completed"
      ? "bg-[#d1fae5] text-slate-900"
      : "bg-[#fce7f3] text-slate-900";

  const openStageEditor = () => {
    setDraftStages(
      normalizeStages(projectData?.stages).map((stage) => ({
        key: stage.key,
        name: stage.name,
        color: stage.color || "slate",
      }))
    );
    setStageEditorOpen(true);
  };

  const closeStageEditor = () => {
    setStageEditorOpen(false);
    setDraftStages([]);
    setDraggingStageIndex(null);
  };

  const upsertDraftStage = (index, patch) => {
    setDraftStages((current) => current.map((stage, stageIndex) => (stageIndex === index ? { ...stage, ...patch } : stage)));
  };

  const addDraftStage = () => {
    setDraftStages((current) => [...current, { key: "", name: "", color: "amber" }]);
  };

  const removeDraftStage = (index) => {
    setDraftStages((current) => (current.length <= 1 ? current : current.filter((_, stageIndex) => stageIndex !== index)));
  };

  const moveDraftStage = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setDraftStages((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const saveProjectStages = async (event) => {
    event.preventDefault();
    setStageSaving(true);
    setInlineMessage("");

    const normalized = draftStages
      .map((stage, index) => {
        const name = String(stage.name || "").trim();
        const key = slugifyStageKey(stage.key || name || `stage-${index + 1}`);
        if (!name || !key) return null;
        return { key, name, color: stage.color || "slate", order: index };
      })
      .filter(Boolean);

    try {
      const response = await axios.put(
        `${apiBase}/projects/${id}`,
        { stages: normalized, stageTemplateId: null },
        { headers }
      );
      setProjectData(response.data || projectData);
      setInlineMessage("Project stages updated.");
      closeStageEditor();
    } catch (error) {
      setInlineMessage(error.response?.data?.error || "Unable to update project stages.");
    } finally {
      setStageSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="sketch-page">
        <div className="sketch-shell">
          <div className="sketch-panel p-8 text-center text-slate-600">Loading project details...</div>
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
              <div className="project-empty-doodle">?</div>
              <Typography variant="h2" className="sketch-heading text-3xl sm:text-4xl">
                {errorState.title}
              </Typography>
              <Typography className="sketch-subtitle max-w-2xl text-base sm:text-lg">
                {errorState.description}
              </Typography>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button className="sketch-button px-5 py-3 text-sm font-semibold" onClick={loadProject}>
                  Retry
                </Button>
                <Button className="sketch-button sketch-button--blue px-5 py-3 text-sm font-semibold" onClick={() => navigate("/projects")}>
                  Back to projects
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
      <div className="sketch-shell space-y-6">
        <Card className="sketch-panel sketch-panel-hover overflow-hidden">
          <CardBody className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr] lg:p-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Chip className={`sketch-chip border-none px-4 py-2 ${statusTone}`} value={statusLabel} />
                <span className="sketch-chip bg-white/80 px-4 py-2 text-sm">
                  {getTeamIds(projectData).length > 0 ? `${getTeamIds(projectData).length} team${getTeamIds(projectData).length > 1 ? "s" : ""}` : "Unassigned team"}
                </span>
                <span className="sketch-chip bg-white/80 px-4 py-2 text-sm">{projectStages.length} stages</span>
                <Button variant="text" className="ui-button ui-button--blue px-4 py-2 text-slate-800 shadow-none" onClick={openStageEditor}>
                  Edit stages
                </Button>
              </div>
              <Typography variant="h2" className="sketch-heading text-3xl sm:text-4xl lg:text-5xl">
                {projectData.title}
              </Typography>
              <Typography className="sketch-subtitle max-w-3xl text-base sm:text-lg">
                {projectData.description || "No project description yet."}
              </Typography>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Tasks", value: stats.total, tone: "sketch-sticky-amber" },
                  { label: "Completed", value: stats.completed, tone: "sketch-sticky-green" },
                  { label: "Late", value: stats.lateCount, tone: "sketch-sticky-pink" },
                  { label: "Members", value: members.length, tone: "sketch-sticky-blue" },
                ].map((item) => (
                  <div key={item.label} className={`sketch-note ${item.tone} p-4`}>
                    <Typography variant="small" className="font-semibold uppercase tracking-[0.2em] text-slate-600">
                      {item.label}
                    </Typography>
                    <Typography className="mt-2 text-3xl font-black text-slate-900">{item.value}</Typography>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              <div className="sketch-note sketch-sticky-blue p-4 sm:p-5">
                <Typography variant="small" className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Due date
                </Typography>
                <Typography variant="h4" className="mt-2 sketch-heading">
                    {formatDueDate(projectData.due_date)}
                </Typography>
                <Typography className="sketch-subtitle mt-2 text-sm">
                  Clear deadline, visible progress, and a stage map that keeps the team coordinated.
                </Typography>
              </div>
              <div className="sketch-note sketch-sticky-amber p-4 sm:p-5">
                <div className="h-72 w-full">
                  <PieChart completed={completedTasks?.completed} late={late?.lated} />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {inlineMessage && (
          <div className="rounded-[20px] border-2 border-dashed border-slate-300 bg-white/80 px-5 py-3 text-sm font-medium text-slate-700 shadow-[6px_6px_0_rgba(31,41,55,0.08)]">
            {inlineMessage}
          </div>
        )}

        <Card className="sketch-panel sketch-panel-hover overflow-hidden">
          <CardBody className="p-4 sm:p-6">
            <Tabs value={activeTab}>
              <TabsHeader className="mb-6 rounded-[20px] border-2 border-dashed border-slate-300 bg-white/80 p-1">
                <Tab value="tasks" onClick={() => setActiveTab("tasks")} className="rounded-[16px] text-sm font-semibold data-[selected=true]:bg-[#fde68a] data-[selected=true]:text-slate-900">
                  Tasks & Members
                </Tab>
                <Tab value="gantt" onClick={() => setActiveTab("gantt")} className="rounded-[16px] text-sm font-semibold data-[selected=true]:bg-[#dbeafe] data-[selected=true]:text-slate-900">
                  Gantt Chart
                </Tab>
                <Tab value="kanban" onClick={() => setActiveTab("kanban")} className="rounded-[16px] text-sm font-semibold data-[selected=true]:bg-[#d1fae5] data-[selected=true]:text-slate-900">
                  Kanban
                </Tab>
              </TabsHeader>
              <TabsBody>
                <TabPanel value="tasks" className="p-0">
                  <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
                    <div className="min-w-0 sketch-note sketch-sticky-amber p-3 sm:p-4">
                      <TaskComp
                        id={primaryTeamId}
                        projectId={id}
                        tasks={tasks}
                        onRefresh={loadProject}
                        stages={projectStages}
                      />
                    </div>
                    <div className="min-w-0 sketch-note sketch-sticky-blue p-3 sm:p-4">
                      <MemberComp id={primaryTeamId} members={members} />
                    </div>
                  </div>
                </TabPanel>
                <TabPanel value="gantt" className="p-0">
                  <div className="sketch-note sketch-sticky-green p-3 sm:p-4">
                    <GanttChart tasks={tasks} projectDueDate={projectData.due_date} members={members} />
                  </div>
                </TabPanel>
                <TabPanel value="kanban" className="p-0">
                  <div className="sketch-note sketch-sticky-blue p-3 sm:p-4">
                    <KanbanBoard
                      tasks={tasks}
                      stages={projectStages}
                      onStageChange={handleTaskStageChange}
                      pendingTaskId={pendingTaskId}
                    />
                  </div>
                </TabPanel>
              </TabsBody>
            </Tabs>
          </CardBody>
        </Card>
      </div>

      <Dialog open={stageEditorOpen} handler={closeStageEditor} size="md" className="ui-modal ui-modal--no-overlay bg-transparent shadow-none">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
          <div className="ui-modal__card stage-template-modal max-w-[64rem]">
            <div className="ui-modal__header bg-[linear-gradient(135deg,#dbeafe_0%,#f8fbff_100%)]">
              <Typography variant="h5" className="text-slate-800">
                Edit Project Stages
              </Typography>
            </div>
            <div className="ui-modal__body">
              <form className="ui-modal__stack" onSubmit={saveProjectStages}>
                <div className="ui-modal__note">
                  <div className="flex items-center justify-between">
                    <Typography variant="small" className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Project stages
                    </Typography>
                    <Button type="button" variant="text" className="ui-button ui-button--blue px-4 py-1.5 text-slate-800 shadow-none" onClick={addDraftStage}>
                      Add stage
                    </Button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {draftStages.map((stage, index) => (
                      <div
                        key={`project-stage-${index}`}
                        className="grid items-center gap-2 lg:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_180px_auto]"
                        draggable
                        onDragStart={() => setDraggingStageIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggingStageIndex === null) return;
                          moveDraftStage(draggingStageIndex, index);
                          setDraggingStageIndex(null);
                        }}
                        onDragEnd={() => setDraggingStageIndex(null)}
                      >
                        <button type="button" className="ui-button ui-button--ghost px-2 py-2 text-slate-700 shadow-none" title="Drag to reorder">
                          ⋮⋮
                        </button>
                        <input
                          className="sketch-input-plain"
                          placeholder="Name"
                          value={stage.name}
                          onChange={(event) => upsertDraftStage(index, { name: event.target.value, key: slugifyStageKey(event.target.value) })}
                          required
                        />
                        <input
                          className="sketch-input-plain"
                          placeholder="Key"
                          value={stage.key}
                          onChange={(event) => upsertDraftStage(index, { key: slugifyStageKey(event.target.value) })}
                          required
                        />
                        <select className="sketch-select-plain" value={stage.color} onChange={(event) => upsertDraftStage(index, { color: event.target.value })}>
                          {STAGE_COLORS.map((color) => (
                            <option key={`project-color-${color}`} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                        <Button type="button" variant="text" className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none lg:w-auto" onClick={() => removeDraftStage(index)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ui-modal__actions">
                  <Button type="button" variant="text" className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none" onClick={closeStageEditor}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="text" className="ui-button ui-button--green px-4 py-2 text-slate-800 shadow-none" disabled={stageSaving}>
                    {stageSaving ? "Saving..." : "Save stages"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default Project;
