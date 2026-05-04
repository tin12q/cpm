import React, { useEffect, useMemo, useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { Alert, Button, Card, CardBody, CardHeader, Dialog, Typography } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import ReactSelect from "react-select";
import apiBase from "../helpers/apiBase";
import { getStageKey, normalizeStages } from "../helpers/stage";
import "../css/project.css";
import "../css/task.css";

const STATUS_OPTIONS = ["in progress", "completed", "late"];
const selectPortalStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

export default function EditTask({ id, idt, stages = [], onSuccess }) {
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("in progress");
  const [stage, setStage] = useState(normalizeStages(stages)[0]?.key || "backlog");
  const [availableStages, setAvailableStages] = useState(normalizeStages(stages));
  const [assignedTo, setAssignedTo] = useState([]);
  const [selectedOption, setSelectedOption] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const cookies = cookie.parse(document.cookie);
  const headers = useMemo(() => ({ Authorization: `Bearer ${cookies.token}` }), [cookies.token]);

  const handleOpen = () => setOpen((current) => !current);

  useEffect(() => {
    setAvailableStages(normalizeStages(stages));
  }, [stages]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    Promise.allSettled([
      axios.get(`${apiBase}/tasks/${idt}`, { headers }),
      id ? axios.get(`${apiBase}/teams/users/${id}`, { headers }) : Promise.resolve({ data: [] }),
    ]).then(async ([taskResult, membersResult]) => {
      if (cancelled) return;

      if (taskResult.status === "fulfilled") {
        const task = taskResult.value.data;
        const assigned = Array.isArray(task.assigned_to) ? task.assigned_to : [];
        setTitle(task.title || "");
        setDescription(task.description || "");
        setDueDate(task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "");
        setStatus(task.status || "in progress");
        setAssignedTo(assigned.map((member) => (typeof member === "object" ? member._id || member.toString() : member)));
        setSelectedOption(
          assigned.map((member) => ({
            value: typeof member === "object" ? member._id || member.toString() : member,
            label: typeof member === "object" ? member.name || member.email || member.toString() : member,
          }))
        );

        try {
          const projectRes = await axios.get(`${apiBase}/projects/${task.project}`, { headers });
          const nextStages = normalizeStages(projectRes.data?.stages);
          if (cancelled) return;
          setAvailableStages(nextStages);
          setStage(getStageKey(task.stage, nextStages));
        } catch (error) {
          const nextStages = normalizeStages(stages);
          if (cancelled) return;
          setAvailableStages(nextStages);
          setStage(getStageKey(task.stage, nextStages));
        }
      } else {
        setToastMessage(taskResult.reason?.response?.data?.error || taskResult.reason?.message || "Unable to load task");
        setToastOpen(true);
      }

      if (membersResult.status === "fulfilled") {
        setMembers(
          (membersResult.value.data || []).map((member) => ({
            value: member._id,
            label: member.name || member.email || member._id,
          }))
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [headers, id, idt, open, stages]);

  useEffect(() => {
    if (!toastOpen) return undefined;
    const timer = setTimeout(() => setToastOpen(false), 3000);
    return () => clearTimeout(timer);
  }, [toastOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await axios.put(
        `${apiBase}/tasks/${idt}`,
        {
          title,
          description,
          due_date: dueDate ? new Date(dueDate).getTime() : null,
          status,
          stage,
          assigned_to: assignedTo,
        },
        { headers }
      );
      setToastMessage("Task updated successfully");
      setToastOpen(true);
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      setToastMessage(error.response?.data?.error || error.message || "Error updating task");
      setToastOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button className="sketch-button flex items-center gap-3 px-4 py-2 text-sm font-semibold" variant="text" onClick={handleOpen}>
        <PencilSquareIcon strokeWidth={2} className="h-4 w-4" /> Edit Task
      </Button>
      <Dialog size="sm" open={open} handler={handleOpen} className="ui-modal ui-modal--no-overlay bg-transparent shadow-none">
        <Card className="mx-auto w-full max-w-[40rem] sketch-note">
          <CardHeader floated={false} shadow={false} className="m-0 rounded-t-[24px] border-b-2 border-dashed border-slate-300 bg-[#dbeafe] p-6">
            <Typography variant="h4" className="sketch-heading">
              Edit Task
            </Typography>
            <Typography className="sketch-subtitle mt-1 text-sm">
              Rework the task without breaking the assignment flow.
            </Typography>
          </CardHeader>
          <CardBody className="p-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="sketch-field">
                <span className="sketch-field__label">Title</span>
                <input className="sketch-input-plain" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>

              <label className="sketch-field">
                <span className="sketch-field__label">Description</span>
                <textarea className="sketch-textarea-plain" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} required />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sketch-field">
                  <span className="sketch-field__label">Due Date</span>
                  <input className="sketch-input-plain" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
                </label>
                <label className="sketch-field">
                  <span className="sketch-field__label">Status</span>
                  <select className="sketch-select-plain" value={status} onChange={(event) => setStatus(event.target.value)} required>
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sketch-field">
                  <span className="sketch-field__label">Stage</span>
                  <select className="sketch-select-plain" value={stage} onChange={(event) => setStage(event.target.value)} required>
                    {availableStages.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sketch-field">
                  <span className="sketch-field__label">Assign to members</span>
                  <ReactSelect
                    isMulti
                    classNamePrefix="sketch-select"
                    options={members}
                    onChange={(selected) => {
                      const safeSelected = selected || [];
                      setSelectedOption(safeSelected);
                      setAssignedTo(safeSelected.map((option) => option.value));
                    }}
                    value={selectedOption}
                    placeholder="Assign to members"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                    styles={selectPortalStyles}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="text" className="rounded-full px-5 py-2 font-semibold text-slate-600" onClick={handleOpen}>
                  Cancel
                </Button>
                <Button type="submit" className="sketch-button px-5 py-2 font-semibold shadow-none" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </Dialog>
      <Alert open={toastOpen} onClick={() => setToastOpen(false)} className="fixed right-4 top-20 z-50 w-[min(22rem,calc(100vw-2rem))] sketch-note border-slate-300 bg-[#dbeafe] text-slate-900">
        <Typography className="font-semibold text-slate-900">{toastMessage}</Typography>
      </Alert>
    </>
  );
}
