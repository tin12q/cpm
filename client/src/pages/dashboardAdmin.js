import React, { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import "chart.js/auto";
import axios from "axios";
import cookie from "cookie";
import { Card, CardBody, CardHeader, Typography } from "@material-tailwind/react";
import { useNavigate } from "react-router-dom";
import apiBase from "../helpers/apiBase";

const teamPalette = {
  completed: "rgba(251, 191, 36, 0.5)",
  progress: "rgba(59, 130, 246, 0.45)",
  late: "rgba(248, 113, 113, 0.45)",
};

const toneMap = {
  completed: "ui-badge ui-badge--complete",
  "in progress": "ui-badge ui-badge--progress",
  late: "ui-badge ui-badge--late",
};

function toDateLabel(value) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString();
}

function sentenceCase(value) {
  return String(value || "backlog")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [teamRows, setTeamRows] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = {
      Authorization: `Bearer ${cookie.parse(document.cookie).token}`,
    };

    Promise.all([
      axios.get(`${apiBase}/tasks/team`, { headers }),
      axios.get(`${apiBase}/tasks/dashboard/overview`, { headers }),
    ])
      .then(([teamRes, overviewRes]) => {
        setTeamRows(teamRes.data || []);
        setOverview(overviewRes.data || null);
      })
      .catch(() => {
        navigate("/projects");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  const teamChart = useMemo(
    () => ({
      labels: teamRows.map((item) => item.team),
      datasets: [
        {
          label: "Completed",
          data: teamRows.map((item) => item.completed),
          backgroundColor: teamPalette.completed,
          borderColor: "rgba(251, 191, 36, 1)",
          borderWidth: 1,
        },
        {
          label: "In progress",
          data: teamRows.map((item) => item.in_progress),
          backgroundColor: teamPalette.progress,
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
        },
        {
          label: "Late",
          data: teamRows.map((item) => item.late),
          backgroundColor: teamPalette.late,
          borderColor: "rgba(248, 113, 113, 1)",
          borderWidth: 1,
        },
      ],
    }),
    [teamRows]
  );

  const dashboard = useMemo(() => {
    const summary = overview?.summary || {};
    const stageEntries = (overview?.stage_counts || [])
      .map((item) => ({
        key: item.key,
        label: sentenceCase(item.name || item.key),
        value: Number(item.count || 0),
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const overdueTasks = overview?.overdue?.items || [];
    const cards = [
      { label: "Completed", value: summary.status_counts?.completed || 0, meta: "Closed work across visible projects", tone: "sketch-sticky-green" },
      { label: "In progress", value: summary.status_counts?.in_progress || 0, meta: "Current active workload", tone: "sketch-sticky-blue" },
      { label: "Late", value: summary.status_counts?.late || 0, meta: overdueTasks.length ? `${overdueTasks.length} urgent tasks surfaced below` : "No late work visible", tone: "sketch-sticky-pink" },
      { label: "Projects", value: summary.active_projects || 0, meta: "Active boards currently tracked", tone: "sketch-sticky-amber" },
      { label: "Teams", value: teamRows.length, meta: "Represented in delivery lanes", tone: "sketch-sticky-blue" },
      { label: "Total tasks", value: summary.total_tasks || 0, meta: "Summed from dashboard overview", tone: "sketch-sticky-amber" },
    ];

    return {
      summary,
      cards,
      stageEntries,
      overdueTasks,
    };
  }, [overview, teamRows.length]);

  const stageChart = useMemo(
    () => ({
      labels: dashboard?.stageEntries.map((item) => item.label) || [],
      datasets: [
        {
          data: dashboard?.stageEntries.map((item) => item.value) || [],
          backgroundColor: ["#f5d56b", "#bddbff", "#f5b7c5", "#bde7bf", "#d9c9ff", "#f7c8a8"],
          borderColor: "rgba(255,255,255,0.92)",
          borderWidth: 2,
        },
      ],
    }),
    [dashboard]
  );

  if (loading || !overview) {
    return <div className="mt-24 px-6 text-slate-600">Loading dashboard...</div>;
  }

  return (
    <div className="mt-20 min-h-screen px-4 pb-10 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <Card className="overview-shell">
          <CardHeader floated={false} shadow={false} className="overview-header rounded-none">
            <div className="space-y-4">
              <div className="max-w-3xl space-y-2">
                <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
                  Team snapshot
                </Typography>
                <Typography variant="h2" color="blue-gray" className="sketch-heading">
                  Dashboard
                </Typography>
                <Typography color="gray" className="text-base leading-7">
                  One long vertical scan: summary first, team distribution next, then stage pressure and deadline recovery blocks underneath.
                </Typography>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="ui-badge ui-badge--draft">Vertical read</span>
                <span className="ui-badge ui-badge--progress">Stage aware</span>
                <span className="ui-badge ui-badge--complete">Deadline watch</span>
              </div>
            </div>
          </CardHeader>
          <CardBody className="overview-flow p-4 sm:p-6 lg:p-7">
            <section className="overview-grid overview-grid--stats">
              {dashboard.cards.map((item) => (
                <div key={item.label} className={`ui-stat-card ${item.tone}`}>
                  <div className="ui-stat-card__eyebrow">{item.label}</div>
                  <div className="ui-stat-card__value">{item.value}</div>
                  <div className="ui-stat-card__meta">{item.meta}</div>
                </div>
              ))}
            </section>

            <section className="overview-section p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Typography variant="small" className="tracking-[0.18em] uppercase text-slate-500">
                    Delivery lanes
                  </Typography>
                  <Typography variant="h5" color="blue-gray" className="mt-2">
                    Tasks by team
                  </Typography>
                </div>
                <Typography variant="small" className="text-slate-500">
                  Stacked workload with completed, active, and late slices
                </Typography>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[780px]">
                  <Bar
                    data={teamChart}
                    options={{
                      scales: { x: { stacked: true }, y: { stacked: true } },
                      plugins: { legend: { display: true, position: "bottom" } },
                      responsive: true,
                      maintainAspectRatio: false,
                      layout: { padding: 12 },
                      barThickness: 24,
                    }}
                    height={360}
                  />
                </div>
              </div>
            </section>

            <section className="overview-stack overview-stack--three">
              <div className="overview-section p-5">
                <Typography variant="small" className="tracking-[0.18em] uppercase text-slate-500">
                  Stage distribution
                </Typography>
                <div className="mt-4 h-[260px]">
                  <Doughnut
                    data={stageChart}
                    options={{
                      plugins: { legend: { position: "bottom" } },
                      maintainAspectRatio: false,
                      cutout: "58%",
                    }}
                  />
                </div>
              </div>

              <div className="overview-section overview-section--center p-5">
                <div className="flex items-center justify-between gap-3">
                  <Typography variant="small" className="tracking-[0.18em] uppercase text-slate-500">
                    Stage pressure
                  </Typography>
                  <span className="ui-badge ui-badge--progress">{dashboard.stageEntries.length} lanes</span>
                </div>
                <div className="mt-4 space-y-3">
                  {dashboard.stageEntries.length === 0 ? (
                    <Typography className="text-sm text-slate-600">No stage data available.</Typography>
                  ) : (
                    dashboard.stageEntries.slice(0, 5).map((entry) => {
                      const width = dashboard.summary.total_tasks
                        ? Math.max((entry.value / dashboard.summary.total_tasks) * 100, 8)
                        : 8;
                      return (
                        <div key={entry.key} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                            <span>{entry.label}</span>
                            <span>{entry.value}</span>
                          </div>
                          <div className="h-3 rounded-full border border-dashed border-slate-300 bg-white/70 p-[2px]">
                            <div className="h-full rounded-full bg-[linear-gradient(90deg,#fde68a,#bddbff)]" style={{ width: `${Math.min(width, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="overview-section p-5">
                <div className="flex items-center justify-between gap-3">
                  <Typography variant="small" className="tracking-[0.18em] uppercase text-slate-500">
                    Overdue list
                  </Typography>
                  <span className="ui-badge ui-badge--late">{dashboard.summary.overdue_tasks || 0} total</span>
                </div>
                <div className="mt-4 space-y-3">
                  {dashboard.overdueTasks.length === 0 ? (
                    <Typography className="text-sm text-slate-600">No overdue tasks in this slice.</Typography>
                  ) : (
                    dashboard.overdueTasks.map((task) => (
                      <div key={task._id} className="ui-modal__note">
                        <div className="flex items-center justify-between gap-3">
                          <Typography variant="h6" className="text-base text-slate-800">
                            {task.title}
                          </Typography>
                          <span className={toneMap[task.status] || "ui-badge ui-badge--draft"}>{task.status || "draft"}</span>
                        </div>
                        <Typography className="text-sm text-slate-600">
                          {task.project?.title || "No project"} · due {toDateLabel(task.due_date)}
                        </Typography>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="overview-stack overview-stack--two">
              <div className="overview-section p-5">
                <Typography variant="small" className="tracking-[0.18em] uppercase text-slate-500">
                  Current read
                </Typography>
                <Typography variant="h6" className="mt-2 text-slate-800">
                  What to scan first
                </Typography>
                <Typography className="mt-2 text-sm leading-7 text-slate-600">
                  Start from overdue work, then compare team load, then look for stage buildup. This keeps the dashboard in a top-to-bottom planning rhythm instead of a scattered wall of equal widgets.
                </Typography>
              </div>
              <div className="overview-section p-5">
                <Typography variant="small" className="tracking-[0.18em] uppercase text-slate-500">
                  Fast facts
                </Typography>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="ui-modal__note">
                    <Typography className="text-xs uppercase tracking-[0.18em] text-slate-500">Due today</Typography>
                    <Typography variant="h5" className="mt-2 text-slate-800">
                      {dashboard.summary.due_today || 0}
                    </Typography>
                  </div>
                  <div className="ui-modal__note">
                    <Typography className="text-xs uppercase tracking-[0.18em] text-slate-500">This week</Typography>
                    <Typography variant="h5" className="mt-2 text-slate-800">
                      {dashboard.summary.due_this_week || 0}
                    </Typography>
                  </div>
                </div>
              </div>
            </section>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
