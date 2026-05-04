"use client";
import React from "react";
import { Card, Typography } from "@material-tailwind/react";
import {
  Cog6ToothIcon,
  InboxIcon,
  PowerIcon,
  PresentationChartBarIcon,
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/solid";
import { Link, useLocation, useNavigate } from "react-router-dom";
import withAuth from "../helpers/withAuth";

const navItems = [
  { label: "Dashboard", icon: PresentationChartBarIcon, path: "/" },
  { label: "Projects", icon: ShoppingBagIcon, path: "/projects" },
  { label: "Tasks", icon: InboxIcon, path: "/tasks" },
  { label: "Employees", icon: UserCircleIcon, path: "/employees" },
  { label: "Skills", icon: Cog6ToothIcon, path: "/skills" },
];

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });
    navigate("/signin");
  };

  return (
    <Card className="fixed left-4 top-4 hidden h-[calc(100vh-2rem)] w-full max-w-[18rem] rounded-[28px] border border-slate-300/80 bg-[#fbf7ef] p-4 shadow-[12px_12px_0_rgba(17,24,39,0.12)] lg:flex lg:flex-col">
      <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/75 p-4 shadow-[4px_4px_0_rgba(17,24,39,0.06)]">
        <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
          Workspace
        </Typography>
        <Typography variant="h5" color="blue-gray" className="mt-2 sketch-heading">
          Team navigation
        </Typography>
        <Typography className="mt-2 text-sm leading-6 text-slate-600">
          One visual language for overview, planning, and admin flows.
        </Typography>
      </div>
      <nav className="mt-4 space-y-2">
        {navItems.map(({ label, icon: Icon, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 transition-transform duration-200 hover:-translate-y-0.5 ${
                active
                  ? "border-[var(--status-progress-border)] bg-[var(--status-progress-bg)] shadow-[4px_4px_0_rgba(17,24,39,0.08)]"
                  : "border-slate-300 bg-white/75 shadow-[3px_3px_0_rgba(17,24,39,0.05)]"
              }`}
            >
              <Icon className="h-5 w-5 text-slate-700" />
              <Typography variant="small" className="font-medium text-slate-800">
                {label}
              </Typography>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-[20px] border border-dashed border-slate-300 bg-white/75 p-4 shadow-[4px_4px_0_rgba(17,24,39,0.06)]">
        <div className="mb-3 flex items-center justify-between">
          <Typography variant="small" className="tracking-[0.16em] uppercase text-slate-500">
            Session
          </Typography>
          <span className="ui-badge ui-badge--draft">Active</span>
        </div>
        <button onClick={handleLogout} className="ui-button ui-button--rose flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left text-slate-800">
          <PowerIcon className="h-5 w-5 text-rose-600" />
          <span className="font-medium">Log Out</span>
        </button>
      </div>
    </Card>
  );
}

export default withAuth(Sidebar);
