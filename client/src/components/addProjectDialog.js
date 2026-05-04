import React, { useEffect, useMemo, useState } from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import { Alert, Button, Dialog, Typography } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";
import "../css/project.css";

export default function AddProject() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [teams, setTeams] = useState([]);
  const [stageTemplates, setStageTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [primaryContact, setPrimaryContact] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const cookies = useMemo(() => cookie.parse(document.cookie), [open]);

  const handleOpen = () => setOpen((current) => !current);

  useEffect(() => {
    if (!open) return;

    Promise.allSettled([
      axios.get(`${apiBase}/teams`, {
        headers: { Authorization: `Bearer ${cookies.token}` },
      }),
      axios.get(`${apiBase}/stage-templates`, {
        headers: { Authorization: `Bearer ${cookies.token}` },
      }),
      axios.get(`${apiBase}/contacts?limit=0`, {
        headers: { Authorization: `Bearer ${cookies.token}` },
      }),
    ])
      .then(([teamResult, templateResult, contactResult]) => {
        if (teamResult.status === "fulfilled") {
          setTeams(teamResult.value.data || []);
        }
        if (templateResult.status === "fulfilled") {
          setStageTemplates(templateResult.value.data || []);
        }
        if (contactResult.status === "fulfilled") {
          setContacts(Array.isArray(contactResult.value.data?.items) ? contactResult.value.data.items : []);
        }
      })
      .catch(() => {
        setToastMessage("Unable to load form options");
        setToastOpen(true);
      });
  }, [cookies.token, open]);

  useEffect(() => {
    if (!toastOpen) return undefined;
    const timer = setTimeout(() => setToastOpen(false), 3000);
    return () => clearTimeout(timer);
  }, [toastOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await axios.post(
        `${apiBase}/projects`,
        {
          title,
          description,
          due_date: dueDate ? new Date(dueDate).getTime() : null,
          status: "in progress",
          team: selectedTeam || null,
          stageTemplateId: selectedTemplate || null,
          customer: customerName ? { name: customerName } : undefined,
          contactIds: selectedContacts,
          primaryContact: primaryContact || null,
        },
        { headers: { Authorization: `Bearer ${cookies.token}` } }
      );
      setToastMessage("Project added successfully");
      setToastOpen(true);
      setOpen(false);
      setTitle("");
      setDescription("");
      setDueDate("");
      setSelectedTeam("");
      setSelectedTemplate("");
      setCustomerName("");
      setSelectedContacts([]);
      setPrimaryContact("");
    } catch (error) {
      setToastMessage(error.response?.data?.error || "Error adding project");
      setToastOpen(true);
    }
  };

  return (
    <>
      <Button className="sketch-button flex items-center gap-3 px-4 py-2 text-sm font-semibold" variant="text" onClick={handleOpen}>
        <UserPlusIcon strokeWidth={2} className="h-4 w-4" /> Add Project
      </Button>
      <Dialog size="md" open={open} handler={handleOpen} className="ui-modal bg-transparent shadow-none">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
          <div className="ui-modal__card max-w-[44rem]">
            <div className="ui-modal__header bg-[linear-gradient(135deg,#fde68a_0%,#fff9e6_100%)]">
              <Typography variant="h4" className="sketch-heading">
                Add Project
              </Typography>
              <Typography className="sketch-subtitle mt-1 text-sm">
                Start with a clear title, team, stage template, and customer context.
              </Typography>
            </div>
            <div className="ui-modal__body">
              <form className="ui-modal__stack" onSubmit={handleSubmit}>
                <div className="ui-modal__field">
                  <span className="text-sm font-semibold text-slate-700">Title</span>
                  <input className="sketch-input-plain" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Project title" />
                </div>

                <div className="ui-modal__field">
                  <span className="text-sm font-semibold text-slate-700">Description</span>
                  <textarea
                    className="sketch-input-plain min-h-[110px] resize-none"
                    required
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Short project summary"
                  />
                </div>

                <div className="ui-modal__grid">
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Due Date</span>
                    <input className="sketch-input-plain" required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  </label>
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Team</span>
                    <select className="sketch-select-plain" required value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
                      <option value="">Choose team</option>
                      {teams.map((team) => (
                        <option key={team._id} value={team._id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="ui-modal__field">
                  <span className="text-sm font-semibold text-slate-700">Stage template</span>
                  <select className="sketch-select-plain" value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}>
                    <option value="">Use default stages</option>
                    {stageTemplates.map((template) => (
                      <option key={template._id} value={template._id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="ui-modal__grid">
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Customer</span>
                    <input className="sketch-input-plain" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" />
                  </label>
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Primary contact</span>
                    <select className="sketch-select-plain" value={primaryContact} onChange={(event) => setPrimaryContact(event.target.value)}>
                      <option value="">No primary contact</option>
                      {contacts.map((contact) => (
                        <option key={contact._id} value={contact._id}>
                          {contact.name} ({contact.type})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="ui-modal__field">
                  <span className="text-sm font-semibold text-slate-700">Related contacts</span>
                  <select
                    multiple
                    className="sketch-select-plain min-h-[120px]"
                    value={selectedContacts}
                    onChange={(event) => {
                      const next = Array.from(event.target.selectedOptions).map((option) => option.value);
                      setSelectedContacts(next);
                    }}
                  >
                    {contacts.map((contact) => (
                      <option key={contact._id} value={contact._id}>
                        {contact.name} · {contact.type}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedTemplate && (
                  <div className="ui-modal__note">
                    <Typography variant="small" className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Template preview
                    </Typography>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(stageTemplates.find((item) => item._id === selectedTemplate)?.stages || []).map((stage) => (
                        <span key={stage.key} className="ui-badge ui-badge--draft">
                          {stage.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="ui-modal__actions">
                  <Button type="button" variant="text" className="ui-button ui-button--ghost px-5 py-2 text-slate-800 shadow-none" onClick={handleOpen}>
                    Cancel
                  </Button>
                  <Button type="submit" className="ui-button ui-button--green px-5 py-2 font-semibold text-slate-800 shadow-none">
                    Add Project
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
      <Alert
        open={toastOpen}
        onClick={() => setToastOpen(false)}
        className="fixed right-4 top-20 z-50 w-[min(22rem,calc(100vw-2rem))] sketch-note border-slate-300 bg-[#fef9c3] text-slate-900"
      >
        <Typography className="font-semibold text-slate-900">{toastMessage}</Typography>
      </Alert>
    </>
  );
}
