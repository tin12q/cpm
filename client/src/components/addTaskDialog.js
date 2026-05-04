import React, { useEffect, useMemo, useState } from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import {
  Alert,
  Button,
  Dialog,
  Typography,
} from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import { useParams } from "react-router-dom";
import ReactSelect from "react-select";
import apiBase from "../helpers/apiBase";
import { getStageKey, normalizeStages } from "../helpers/stage";
import "../css/project.css";

const selectPortalStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

export default function AddTask({ id, projectId, stages = [], onSuccess }) {
  const routeProjectId = useParams().id;
  const activeProjectId = projectId || routeProjectId;
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [stage, setStage] = useState(normalizeStages(stages)[0]?.key || "backlog");
  const [availableStages, setAvailableStages] = useState(normalizeStages(stages));
  const [assignedTo, setAssignedTo] = useState([]);
  const [selectedOption, setSelectedOption] = useState([]);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const cookies = cookie.parse(document.cookie);
  const headers = useMemo(() => ({ Authorization: `Bearer ${cookies.token}` }), [cookies.token]);

  const handleOpen = () => setOpen((current) => !current);

  useEffect(() => {
    setAvailableStages(normalizeStages(stages));
    setStage(normalizeStages(stages)[0]?.key || "backlog");
  }, [stages]);

  useEffect(() => {
    const requests = [];

    if (id) {
      requests.push(
        axios
          .get(`${apiBase}/teams/users/${id}`, { headers })
          .then((res) => {
            setMembers(
              (res.data || []).map((member) => ({
                value: member._id,
                label: member.name,
              }))
            );
          })
      );
    }

    if (activeProjectId) {
      requests.push(
        axios
          .get(`${apiBase}/projects/${activeProjectId}`, { headers })
          .then((res) => {
            const nextStages = normalizeStages(res.data?.stages);
            setAvailableStages(nextStages);
            setStage((current) => getStageKey(current, nextStages));
          })
          .catch(() => {
            const nextStages = normalizeStages(stages);
            setAvailableStages(nextStages);
            setStage((current) => getStageKey(current, nextStages));
          })
      );
    }

    Promise.allSettled(requests).then((results) => {
      const rejected = results.find((result) => result.status === "rejected");
      if (rejected) {
        setToastMessage(rejected.reason?.response?.data?.error || rejected.reason?.message || "Unable to load task form data.");
        setToastOpen(true);
      }
    });
  }, [activeProjectId, headers, id, stages]);

  useEffect(() => {
    if (!toastOpen) return undefined;
    const timer = setTimeout(() => setToastOpen(false), 3000);
    return () => clearTimeout(timer);
  }, [toastOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await axios.post(
        `${apiBase}/tasks`,
        {
          title,
          description,
          due_date: new Date(dueDate).getTime(),
          status: "in progress",
          stage,
          project: activeProjectId,
          assigned_to: assignedTo,
        },
        { headers }
      );
      setToastMessage("Task added successfully");
      setToastOpen(true);
      setOpen(false);
      setTitle("");
      setDescription("");
      setDueDate("");
      setAssignedTo([]);
      setSelectedOption([]);
      setStage(availableStages[0]?.key || "backlog");
      if (onSuccess) onSuccess();
    } catch (error) {
      setToastMessage(error.response?.data?.error || error.message || "Something went wrong");
      setToastOpen(true);
    }
  };

  return (
    <>
      <Button className="sketch-button flex items-center gap-3 px-4 py-2 text-sm font-semibold" variant="text" onClick={handleOpen}>
        <UserPlusIcon strokeWidth={2} className="h-4 w-4" /> Add Task
      </Button>
      <Dialog size="md" open={open} handler={handleOpen} className="ui-modal ui-modal--no-overlay bg-transparent shadow-none">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
          <div className="ui-modal__card max-w-[42rem]">
            <div className="ui-modal__header bg-[linear-gradient(135deg,#dbeafe_0%,#f6fbff_100%)]">
              <Typography variant="h4" className="sketch-heading">
                Add Task
              </Typography>
              <Typography className="sketch-subtitle mt-1 text-sm">
                Keep the task small enough to move, assign, and finish.
              </Typography>
            </div>
            <div className="ui-modal__body">
              <form className="ui-modal__stack" onSubmit={handleSubmit}>
                <div className="ui-modal__field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Title
                  </Typography>
                  <input className="sketch-input-plain" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" />
                </div>
                <div className="ui-modal__field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Description
                  </Typography>
                  <textarea className="sketch-textarea-plain min-h-[120px]" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Task description" />
                </div>
                <div className="ui-modal__grid">
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">
                      Due Date
                    </Typography>
                    <input className="sketch-input-plain" required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  </div>
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">
                      Stage
                    </Typography>
                    <select className="sketch-select-plain" value={stage} onChange={(event) => setStage(event.target.value)}>
                      {availableStages.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="ui-modal__field">
                  <Typography variant="small" className="font-semibold text-slate-700">
                    Assign to members
                  </Typography>
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
                    placeholder="Assign to members (optional)"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                    styles={selectPortalStyles}
                  />
                </div>
                <div className="ui-modal__actions">
                  <Button type="button" variant="text" className="ui-button ui-button--ghost px-5 py-2 text-slate-800 shadow-none" onClick={handleOpen}>
                    Cancel
                  </Button>
                  <Button type="submit" className="ui-button ui-button--green px-5 py-2 font-semibold text-slate-800 shadow-none">
                    Add Task
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
      <Alert open={toastOpen} onClick={() => setToastOpen(false)} className="fixed right-4 top-20 z-50 w-[min(22rem,calc(100vw-2rem))] sketch-note border-slate-300 bg-[#dbeafe] text-slate-900">
        <Typography className="font-semibold text-slate-900">{toastMessage}</Typography>
      </Alert>
    </>
  );
}
