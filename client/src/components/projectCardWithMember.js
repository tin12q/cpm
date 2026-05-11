import { Card, CardBody, CardFooter, CardHeader, Typography } from "@material-tailwind/react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";

const cardShell =
  "overflow-hidden rounded-[28px] border border-slate-300/80 bg-[#fcf8f0] shadow-[10px_10px_0_rgba(17,24,39,0.12)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[12px_12px_0_rgba(17,24,39,0.16)]";

function getStatusMeta(status) {
  if (status === "completed") return { label: "Completed", className: "ui-badge ui-badge--complete" };
  if (status === "in progress") return { label: "In Progress", className: "ui-badge ui-badge--progress" };
  return { label: "Late", className: "ui-badge ui-badge--late" };
}

function Meter({ label, value, trackClass, fillClass }) {
  return (
    <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/80 p-4 shadow-[4px_4px_0_rgba(17,24,39,0.06)]">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm text-slate-600">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className={`h-3 overflow-hidden rounded-full ${trackClass}`}>
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${Math.min(Math.max(Number(value) || 0, 0), 100)}%` }} />
      </div>
    </div>
  );
}

export default function PCWM({ title, dueDate, status, id, members }) {
  const cookies = cookie.parse(document.cookie);
  const [complete, setComplete] = useState(0);
  const [late, setLate] = useState(0);
  const statusMeta = getStatusMeta(status);

  useEffect(() => {
    axios
      .get(`${apiBase}/tasks/completed/${id}`, {
        headers: { Authorization: `Bearer ${cookies.token}` },
      })
      .then((res) => setComplete(Number(res.data.completed || 0)))
      .catch(() => setComplete(0));

    axios
      .get(`${apiBase}/tasks/lated/${id}`, {
        headers: { Authorization: `Bearer ${cookies.token}` },
      })
      .then((res) => setLate(Number(res.data.lated || 0)))
      .catch(() => setLate(0));
  }, [cookies.token, id]);

  const visibleMembers = useMemo(() => {
    if (Array.isArray(members)) return members.slice(0, 4);
    if (members) return [members];
    return [];
  }, [members]);

  return (
    <Link to={`/projects/${id}`} className="block h-full">
      <Card className={cardShell}>
        <CardHeader floated={false} shadow={false} color="transparent" className="m-0 rounded-none border-b border-dashed border-slate-300 bg-[linear-gradient(135deg,#f7eddc_0%,#fdfaf5_100%)] p-0">
          <div className="flex h-40 items-end justify-between gap-4 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_48%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(255,255,255,0.95))] p-6">
            <div>
              <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
                Project board
              </Typography>
              <Typography variant="h4" color="blue-gray" className="mt-2 line-clamp-2">
                {title}
              </Typography>
            </div>
            <span className={statusMeta.className}>{statusMeta.label}</span>
          </div>
        </CardHeader>
        <CardBody className="space-y-5 p-6">
          <Meter label="Completion" value={complete} trackClass="bg-amber-100" fillClass="bg-amber-400" />
          <Meter label="Late risk" value={late} trackClass="bg-rose-100" fillClass="bg-rose-400" />
          <div className="flex flex-wrap gap-2">
            {visibleMembers.length > 0 ? (
              visibleMembers.map((member, index) => (
                <span key={`${member}-${index}`} className="ui-table-chip">
                  {String(member)}
                </span>
              ))
            ) : (
              <span className="ui-table-chip">No member summary</span>
            )}
          </div>
        </CardBody>
        <CardFooter className="flex items-center justify-between border-t border-dashed border-slate-300/80 bg-white/50 px-6 py-4">
          <Typography className="font-medium text-slate-600">Due {new Date(dueDate).toLocaleDateString()}</Typography>
          <span className={statusMeta.className}>{statusMeta.label}</span>
        </CardFooter>
      </Card>
    </Link>
  );
}
