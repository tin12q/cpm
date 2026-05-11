import React, { useEffect, useMemo, useState } from "react";
import { Scheduler } from "@aldabil/react-scheduler";
import axios from "axios";
import cookie from "cookie";
import { Card, CardBody, CardHeader, Typography } from "@material-tailwind/react";
import apiBase from "../helpers/apiBase";

function getEventColor(status) {
  if (status === "completed") return "#9ad29d";
  if (status === "in progress") return "#9bc2ff";
  return "#f6b0c0";
}

function eventBucket(events) {
  const now = new Date();
  const todayKey = now.toDateString();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  return {
    total: events.length,
    today: events.filter((event) => new Date(event.start).toDateString() === todayKey).length,
    week: events.filter((event) => new Date(event.start) >= now && new Date(event.start) <= weekEnd).length,
    completed: events.filter((event) => event.rawStatus === "completed").length,
  };
}

function normalizeDueDateToLocalDay(value) {
  const source = new Date(value);
  if (Number.isNaN(source.getTime())) return null;

  // due_date is stored as a date-only timestamp in many flows; use UTC date parts
  // then pin event to local daytime so it never drifts to adjacent day by timezone.
  const start = new Date(
    source.getUTCFullYear(),
    source.getUTCMonth(),
    source.getUTCDate(),
    9,
    0,
    0,
    0
  );
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return { start, end };
}

export default function CalendarPage() {
  const [events, setEvents] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    axios
      .get(`${apiBase}/tasks/user`, {
        headers: {
          Authorization: `Bearer ${cookie.parse(document.cookie).token}`,
        },
      })
      .then((res) => {
        setEvents(
          (res.data || [])
            .map((event) => {
              const normalized = event?.due_date ? normalizeDueDateToLocalDay(event.due_date) : null;
              if (!normalized) return null;
              return {
                event_id: event._id,
                title: event.title,
                subtitle: event.stage || "Backlog",
                start: normalized.start,
                end: normalized.end,
                editable: false,
                color: getEventColor(event.status),
                deletable: false,
                rawStatus: event.status,
              };
            })
            .filter(Boolean)
        );
      })
      .catch(() => {
        setEvents([]);
      });
  }, []);

  const stats = useMemo(() => eventBucket(events || []), [events]);

  if (!events) {
    return <div className="mt-24 px-6 text-slate-600">Loading calendar...</div>;
  }

  return (
    <div className="mt-20 min-h-screen px-4 pb-10 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <Card className="overview-shell">
          <CardHeader floated={false} shadow={false} className="overview-header rounded-none">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-2">
                <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
                  Timeline sketch
                </Typography>
                <Typography variant="h2" color="blue-gray" className="sketch-heading">
                  Calendar
                </Typography>
                <Typography color="gray" className="text-base leading-7">
                  Scheduler controls, month chrome, and editor surfaces now sit inside the same paper system as the rest of the app instead of feeling like an imported widget.
                </Typography>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="ui-badge ui-badge--draft">Monthly view</span>
                <span className="ui-badge ui-badge--progress">Planner</span>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4 p-4 sm:p-6 lg:p-7">
            <div className="overview-grid overview-grid--stats">
              <div className="ui-stat-card sketch-sticky-amber">
                <div className="ui-stat-card__eyebrow">Visible events</div>
                <div className="ui-stat-card__value">{stats.total}</div>
                <div className="ui-stat-card__meta">Items on the board</div>
              </div>
              <div className="ui-stat-card sketch-sticky-blue">
                <div className="ui-stat-card__eyebrow">Due today</div>
                <div className="ui-stat-card__value">{stats.today}</div>
                <div className="ui-stat-card__meta">Immediate focus</div>
              </div>
              <div className="ui-stat-card sketch-sticky-green">
                <div className="ui-stat-card__eyebrow">This week</div>
                <div className="ui-stat-card__value">{stats.week}</div>
                <div className="ui-stat-card__meta">Upcoming deadlines</div>
              </div>
              <div className="ui-stat-card sketch-sticky-pink">
                <div className="ui-stat-card__eyebrow">Completed</div>
                <div className="ui-stat-card__value">{stats.completed}</div>
                <div className="ui-stat-card__meta">Cards already closed</div>
              </div>
            </div>
            <div className="scheduler-shell p-3 sm:p-4 lg:p-5">
              <Scheduler
                view="month"
                selectedDate={selectedDate}
                onSelectedDateChange={setSelectedDate}
                week={{ weekStartOn: 6, step: 60, weekDays: [0, 1, 2, 3, 4, 5, 6] }}
                events={events}
                month={{ weekStartOn: 6 }}
                hourFormat="24"
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
