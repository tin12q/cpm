import { useMemo, useState } from "react";
import { Typography } from "@material-tailwind/react";
import "../css/project.css";

const HEADER_HEIGHT = 78;
const SIDE_WIDTH = 300;
const ROW_PADDING_TOP = 14;
const ROW_PADDING_BOTTOM = 12;
const MIN_ROW_HEIGHT = 78;
const BAR_HEIGHT = 18;
const BAR_GAP = 9;

function startOfDay(value) {
  const date = new Date(value || Date.now());
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayDiff(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / (24 * 60 * 60 * 1000));
}

function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getTaskDuration(task) {
  if (task.difficulty >= 4) return 8;
  if (task.difficulty === 3) return 6;
  if (task.difficulty === 2) return 4;
  return 2;
}

function getStatusColor(status) {
  if (status === "completed") return "#16a34a";
  if (status === "late") return "#f43f5e";
  return "#3b82f6";
}

function getDayWidth(totalDays) {
  if (totalDays <= 16) return 84;
  if (totalDays <= 28) return 72;
  if (totalDays <= 45) return 62;
  return 54;
}

function normalizeMember(member) {
  if (!member) return null;
  if (typeof member === "object") {
    return {
      id: String(member._id || member.id || member.email || member.name || Math.random()),
      name: member.name || member.email || "Unknown",
      email: member.email || "",
    };
  }
  return {
    id: String(member),
    name: String(member),
    email: "",
  };
}

function buildMemberRows(members, tasks) {
  const memberMap = new Map();

  (Array.isArray(members) ? members : [])
    .map(normalizeMember)
    .filter(Boolean)
    .forEach((member) => {
      if (!memberMap.has(member.id)) {
        memberMap.set(member.id, { ...member, tasks: [] });
      }
    });

  const unassignedTasks = [];

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    if (!Array.isArray(task.assigned_to) || task.assigned_to.length === 0) {
      unassignedTasks.push(task);
      return;
    }

    task.assigned_to.forEach((assignee) => {
      const member = normalizeMember(assignee);
      if (!member) return;
      if (!memberMap.has(member.id)) {
        memberMap.set(member.id, { ...member, tasks: [] });
      }
      memberMap.get(member.id).tasks.push(task);
    });
  });

  const rows = Array.from(memberMap.values()).sort((left, right) => left.name.localeCompare(right.name));
  rows.push({
    id: "unassigned",
    name: "Unassigned",
    email: "",
    tasks: unassignedTasks,
  });

  return rows;
}

export default function GanttChart({ tasks = [], projectDueDate, members = [] }) {
  const [hoveredTask, setHoveredTask] = useState(null);

  const rows = useMemo(() => buildMemberRows(members, tasks), [members, tasks]);

  const timeline = useMemo(() => {
    const dueDates = tasks.map((task) => task.due_date).filter(Boolean);
    const baseStart = dueDates.length > 0 ? Math.min(...dueDates) : Date.now();
    const baseEnd = Math.max(projectDueDate || Date.now(), ...dueDates, Date.now());
    const startDate = startOfDay(addDays(baseStart, -6));
    const endDate = startOfDay(addDays(baseEnd, 6));
    const totalDays = Math.max(14, dayDiff(startDate, endDate) + 1);
    const dayWidth = getDayWidth(totalDays);
    const headers = [];

    for (let index = 0; index < totalDays; index += 1) {
      const date = addDays(startDate, index);
      headers.push({
        index,
        date,
        isWeekend: [0, 6].includes(date.getDay()),
        isToday: isSameDay(date, new Date()),
        showMonth: index === 0 || date.getDate() === 1,
      });
    }

    return {
      startDate,
      headers,
      dayWidth,
      width: totalDays * dayWidth,
    };
  }, [projectDueDate, tasks]);

  const layout = useMemo(() => {
    let offsetY = HEADER_HEIGHT;

    const laidOutRows = rows.map((row) => {
      const laneEnds = [];

      const rowTasks = row.tasks
        .map((task) => {
          const dueDate = startOfDay(task.due_date || Date.now());
          const duration = getTaskDuration(task);
          const startDate = addDays(dueDate, -duration + 1);
          return { ...task, dueDate, startDate, duration };
        })
        .sort((left, right) => left.startDate - right.startDate || left.dueDate - right.dueDate);

      const bars = rowTasks.map((task) => {
        let laneIndex = laneEnds.findIndex((laneEnd) => task.startDate > laneEnd);
        if (laneIndex === -1) laneIndex = laneEnds.length;
        laneEnds[laneIndex] = task.dueDate;

        const x = Math.max(0, dayDiff(timeline.startDate, task.startDate)) * timeline.dayWidth + 6;
        const width = Math.max(timeline.dayWidth - 12, task.duration * timeline.dayWidth - 12);

        return {
          ...task,
          laneIndex,
          x,
          width,
        };
      });

      const laneCount = Math.max(1, laneEnds.length);
      const rowHeight = Math.max(MIN_ROW_HEIGHT, ROW_PADDING_TOP + ROW_PADDING_BOTTOM + laneCount * BAR_HEIGHT + (laneCount - 1) * BAR_GAP);
      const result = {
        ...row,
        laneCount,
        rowHeight,
        y: offsetY,
        bars,
      };
      offsetY += rowHeight;
      return result;
    });

    return {
      rows: laidOutRows,
      height: offsetY,
    };
  }, [rows, timeline.dayWidth, timeline.startDate]);

  if (rows.length === 0) {
    return <div className="p-8 text-center text-slate-500">No project members available for the Gantt chart.</div>;
  }

  return (
    <div className="gantt-shell sketch-scroll overflow-x-auto">
      <div className="flex min-w-max">
        <div className="gantt-side border-r-2 border-dashed border-slate-300 bg-[#fffaf0]" style={{ minWidth: SIDE_WIDTH, maxWidth: SIDE_WIDTH }}>
          <div className="flex items-center border-b-2 border-dashed border-slate-300 px-5 font-semibold text-slate-700" style={{ height: HEADER_HEIGHT }}>
            Team lane
          </div>
          {layout.rows.map((row) => (
            <div key={row.id} className="border-b border-dashed border-slate-200 px-5 py-3" style={{ height: row.rowHeight }}>
              <Typography className="truncate text-sm font-semibold text-slate-900">{row.name}</Typography>
              <Typography className="mt-1 text-xs text-slate-500">
                {row.bars.length > 0
                  ? `${row.bars.length} task${row.bars.length === 1 ? "" : "s"} across ${row.laneCount} lane${row.laneCount === 1 ? "" : "s"}`
                  : "No scheduled tasks yet"}
              </Typography>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <svg width={timeline.width} height={layout.height} className="block bg-white/72">
            {timeline.headers.map((header) => (
              <g key={header.index}>
                <rect
                  x={header.index * timeline.dayWidth}
                  y={0}
                  width={timeline.dayWidth}
                  height={HEADER_HEIGHT}
                  fill={header.isToday ? "#dbeafe" : header.isWeekend ? "#fff7ed" : "#fffdf8"}
                  stroke="#e2e8f0"
                />
                <text x={header.index * timeline.dayWidth + timeline.dayWidth / 2} y={22} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">
                  {header.showMonth ? header.date.toLocaleDateString("en-US", { month: "short" }) : ""}
                </text>
                <text x={header.index * timeline.dayWidth + timeline.dayWidth / 2} y={46} textAnchor="middle" className="fill-slate-900 text-[15px] font-semibold">
                  {header.date.getDate()}
                </text>
                <text x={header.index * timeline.dayWidth + timeline.dayWidth / 2} y={64} textAnchor="middle" className="fill-slate-400 text-[10px] uppercase">
                  {header.date.toLocaleDateString("en-US", { weekday: "short" })}
                </text>
              </g>
            ))}

            {layout.rows.map((row, index) => (
              <rect
                key={`row-${row.id}`}
                x={0}
                y={row.y}
                width={timeline.width}
                height={row.rowHeight}
                fill={index % 2 === 0 ? "#ffffff" : "#fcfcfd"}
                stroke="#eef2f7"
              />
            ))}

            {timeline.headers.map((header) => (
              <line
                key={`grid-${header.index}`}
                x1={header.index * timeline.dayWidth}
                y1={HEADER_HEIGHT}
                x2={header.index * timeline.dayWidth}
                y2={layout.height}
                stroke={header.isWeekend ? "#e8eef6" : "#f3f6fb"}
                strokeWidth={1}
              />
            ))}

            {layout.rows.flatMap((row) =>
              row.bars.map((task) => {
                const y = row.y + ROW_PADDING_TOP + task.laneIndex * (BAR_HEIGHT + BAR_GAP);
                return (
                  <g key={`${row.id}-${task._id}-${task.laneIndex}`}>
                    <rect
                      x={task.x}
                      y={y}
                      width={task.width}
                      height={BAR_HEIGHT}
                      rx={9}
                      fill={getStatusColor(task.status)}
                      opacity={hoveredTask?._id === task._id ? 1 : 0.92}
                      onMouseEnter={() => setHoveredTask(task)}
                      onMouseLeave={() => setHoveredTask(null)}
                    />
                    {task.width > 96 && (
                      <text x={task.x + 8} y={y + 12} className="fill-white text-[10px] font-semibold pointer-events-none">
                        {String(task.title).slice(0, Math.max(10, Math.floor(task.width / 8)))}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>
      </div>

      {hoveredTask && (
        <div className="mt-4 max-w-md rounded-[20px] border-2 border-dashed border-slate-300 bg-[#fffaf0] p-4 shadow-[8px_8px_0_rgba(31,41,55,0.12)]">
          <Typography variant="h6" color="blue-gray">
            {hoveredTask.title}
          </Typography>
          <Typography variant="small" color="gray" className="mt-1">
            {hoveredTask.description || "No description"}
          </Typography>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={
                hoveredTask.status === "completed"
                  ? "sketch-status sketch-status--done"
                  : hoveredTask.status === "late"
                  ? "sketch-status sketch-status--late"
                  : "sketch-status sketch-status--progress"
              }
            >
              {hoveredTask.status || "in progress"}
            </span>
            <span className="sketch-chip bg-white/85 text-xs">{hoveredTask.stage || "Backlog"}</span>
            <Typography variant="small" color="gray">
              Due {hoveredTask.due_date ? new Date(hoveredTask.due_date).toLocaleDateString() : "No date"}
            </Typography>
          </div>
        </div>
      )}
    </div>
  );
}
