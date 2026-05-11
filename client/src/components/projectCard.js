import { Button, Card, CardBody, CardFooter, Typography } from "@material-tailwind/react";
import { ArrowLongRightIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

const cardShell =
  "overflow-hidden rounded-[28px] border border-slate-300/80 bg-[#fbf7ef] shadow-[10px_10px_0_rgba(17,24,39,0.12)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[12px_12px_0_rgba(17,24,39,0.16)]";

function getStatusMeta(status) {
  if (status === "completed") return { label: "Completed", className: "ui-badge ui-badge--complete" };
  if (status === "in progress") return { label: "In Progress", className: "ui-badge ui-badge--progress" };
  return { label: "Late", className: "ui-badge ui-badge--late" };
}

function pickText(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    return String(value.name || value.title || value.email || "").trim();
  }
  return "";
}

export default function ProjectCard(props) {
  const statusMeta = getStatusMeta(props.status);
  const dueDate = props.due_date || props.dueDate;
  const customerLabel = pickText(props.customer?.name || props.customer_name || props.customer);
  const contactLabel = pickText(
    props.primary_contact_detail || props.contact?.name || props.contact_name || props.contact
  );

  return (
    <Card className={cardShell}>
      <CardBody className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-amber-100 text-slate-800 shadow-[4px_4px_0_rgba(17,24,39,0.08)]">
              <RocketLaunchIcon className="h-6 w-6" />
            </div>
            <div>
              <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
                Project note
              </Typography>
              <Typography variant="h5" color="blue-gray" className="mt-1">
                {props.title}
              </Typography>
            </div>
          </div>
          <span className={statusMeta.className}>{statusMeta.label}</span>
        </div>

        <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/70 p-4 text-sm leading-6 text-slate-700 shadow-[4px_4px_0_rgba(17,24,39,0.06)]">
          {props.description || "A project card with sketch-style treatment and clear hierarchy."}
        </div>
        {(customerLabel || contactLabel) && (
          <div className="flex flex-wrap gap-2">
            {customerLabel && <span className="ui-table-chip">Customer: {customerLabel}</span>}
            {contactLabel && <span className="ui-table-chip">Contact: {contactLabel}</span>}
          </div>
        )}
      </CardBody>
      <CardFooter className="flex items-center justify-between border-t border-dashed border-slate-300/80 bg-white/50 px-6 py-4">
        <Typography variant="small" className="font-medium text-slate-600">
          Due {dueDate ? new Date(dueDate).toLocaleDateString() : "TBD"}
        </Typography>
        <Link to={`/projects/${props.id}`}>
          <Button variant="text" className="ui-button ui-button--amber flex items-center gap-2 px-4 py-2 text-slate-800 shadow-none">
            View
            <ArrowLongRightIcon strokeWidth={2} className="h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
