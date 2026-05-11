import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Typography } from "@material-tailwind/react";
import "../css/project.css";
import { getStageKey, normalizeStages } from "../helpers/stage";

function getStatusTone(status) {
  if (status === "completed") return "sketch-status sketch-status--done";
  if (status === "late") return "sketch-status sketch-status--late";
  return "sketch-status sketch-status--progress";
}

function formatDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString();
}

function getAssigneeLabel(task) {
  if (!Array.isArray(task.assigned_to) || task.assigned_to.length === 0) {
    return "Unassigned";
  }

  return task.assigned_to
    .map((member) => {
      if (typeof member === "object") return member.name || member.email || "Unknown";
      return String(member);
    })
    .join(", ");
}

export default function KanbanBoard({ tasks = [], stages = [], onStageChange, pendingTaskId = null }) {
  const normalizedStages = normalizeStages(stages);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dropStageKey, setDropStageKey] = useState(null);

  const groupedTasks = useMemo(() => {
    const groups = normalizedStages.reduce((acc, stage) => {
      acc[stage.key] = [];
      return acc;
    }, {});

    tasks.forEach((task) => {
      const stageKey = getStageKey(task.stage, normalizedStages);
      if (!groups[stageKey]) groups[stageKey] = [];
      groups[stageKey].push(task);
    });

    return groups;
  }, [normalizedStages, tasks]);

  const taskMap = useMemo(
    () =>
      tasks.reduce((map, task) => {
        map[String(task._id)] = task;
        return map;
      }, {}),
    [tasks]
  );

  const handleDrop = (stageKey) => (event) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    const task = taskMap[taskId];
    setDropStageKey(null);
    setDraggingTaskId(null);

    if (!task || pendingTaskId === taskId) return;
    const currentStage = getStageKey(task.stage, normalizedStages);
    if (currentStage === stageKey) return;
    if (onStageChange) onStageChange(task, stageKey);
  };

  return (
    <div className="kanban-shell sketch-scroll overflow-x-auto pb-2">
      <div className="kanban-grid min-w-[1120px] gap-4 xl:min-w-0">
        {normalizedStages.map((stage) => {
          const stageTasks = groupedTasks[stage.key] || [];
          const isActiveDropZone = dropStageKey === stage.key;

          return (
            <section
              key={stage.key}
              className={`kanban-column sketch-panel-soft p-4 ${isActiveDropZone ? "kanban-column--active" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (pendingTaskId) return;
                setDropStageKey(stage.key);
              }}
              onDragLeave={() => {
                if (dropStageKey === stage.key) setDropStageKey(null);
              }}
              onDrop={handleDrop(stage.key)}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <Typography variant="h6" className="sketch-heading text-xl">
                    {stage.name}
                  </Typography>
                  <Typography className="sketch-subtitle text-sm">
                    {stageTasks.length} task{stageTasks.length === 1 ? "" : "s"}
                  </Typography>
                </div>
                <span className="sketch-chip bg-white/80 text-xs">{stageTasks.length}</span>
              </div>

              <div className="mb-3 rounded-[18px] border-2 border-dashed border-slate-200 bg-white/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Drag cards here to move stage
              </div>

              <div className="space-y-3">
                {stageTasks.length === 0 && (
                  <div className="kanban-empty rounded-[18px] border-2 border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center">
                    <Typography className="text-sm font-medium text-slate-500">No tasks in this stage.</Typography>
                  </div>
                )}

                {stageTasks.map((task) => {
                  const isDragging = draggingTaskId === String(task._id);
                  const isPending = pendingTaskId === task._id;

                  return (
                    <article
                      key={task._id}
                      draggable={!isPending && Boolean(onStageChange)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(task._id));
                        setDraggingTaskId(String(task._id));
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDropStageKey(null);
                      }}
                      className={`kanban-card sketch-note p-4 ${isDragging ? "kanban-card--dragging" : ""} ${isPending ? "kanban-card--pending" : ""}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Typography className="truncate text-base font-extrabold text-slate-900">
                            {task.title}
                          </Typography>
                          <Typography className="mt-1 text-sm text-slate-600">
                            {task.description ? task.description.slice(0, 88) : "No description yet."}
                          </Typography>
                        </div>
                        <span className={getStatusTone(task.status)}>{task.status || "in progress"}</span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <div>
                          <strong className="text-slate-800">Due:</strong> {formatDate(task.due_date)}
                        </div>
                        <div>
                          <strong className="text-slate-800">Owner:</strong> {getAssigneeLabel(task)}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="sketch-chip bg-white/90 text-xs">
                          {isPending ? "Saving..." : "Drag to move"}
                        </span>
                        <Link to={`/tasks/${task._id}`}>
                          <Button variant="text" className="sketch-button px-4 py-2 text-xs font-semibold">
                            Open
                          </Button>
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
