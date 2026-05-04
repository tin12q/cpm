import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, Dialog, Typography } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";

const EMPTY_STAGE = { key: "", name: "", color: "amber" };
const COLORS = ["amber", "blue", "violet", "green", "rose", "teal", "slate"];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function StageTemplatesPage() {
  const token = cookie.parse(document.cookie).token;
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [templates, setTemplates] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState([{ ...EMPTY_STAGE }]);
  const [draggingIndex, setDraggingIndex] = useState(null);

  const loadTemplates = useCallback(async () => {
    const res = await axios.get(`${apiBase}/stage-templates`, { headers });
    setTemplates(Array.isArray(res.data) ? res.data : []);
  }, [headers]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setIsDefault(false);
    setStages([{ ...EMPTY_STAGE }]);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (template) => {
    setEditingId(template._id);
    setName(template.name || "");
    setDescription(template.description || "");
    setIsDefault(Boolean(template.is_default));
    setStages(
      Array.isArray(template.stages) && template.stages.length
        ? template.stages.map((stage) => ({
            key: stage.key || "",
            name: stage.name || "",
            color: stage.color || "amber",
          }))
        : [{ ...EMPTY_STAGE }]
    );
    setDialogOpen(true);
  };

  const upsertStage = (index, patch) => {
    setStages((current) => current.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)));
  };

  const addStage = () => setStages((current) => [...current, { ...EMPTY_STAGE }]);
  const removeStage = (index) => setStages((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  const moveStage = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setStages((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const normalizedStages = stages
      .map((stage) => {
        const stageName = String(stage.name || "").trim();
        const key = slugify(stage.key || stageName);
        return { key, name: stageName, color: stage.color || "amber" };
      })
      .filter((stage) => stage.key && stage.name);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      is_default: isDefault,
      stages: normalizedStages,
    };

    if (editingId) {
      await axios.put(`${apiBase}/stage-templates/${editingId}`, payload, { headers });
    } else {
      await axios.post(`${apiBase}/stage-templates`, payload, { headers });
    }
    setDialogOpen(false);
    resetForm();
    await loadTemplates();
  };

  const removeTemplate = async (id) => {
    await axios.delete(`${apiBase}/stage-templates/${id}`, { headers });
    await loadTemplates();
  };

  return (
    <div className="mt-20 min-h-screen px-4 pb-10 sm:px-6 lg:px-8">
      <Card className="overview-shell">
        <CardHeader floated={false} shadow={false} className="overview-header rounded-none">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Typography variant="small" className="tracking-[0.2em] uppercase text-slate-500">
                Workflow setup
              </Typography>
              <Typography variant="h3" className="sketch-heading mt-2">
                Stage Templates
              </Typography>
            </div>
            <Button variant="text" className="ui-button ui-button--amber px-5 py-2 text-slate-800 shadow-none" onClick={openCreate}>
              Add Template
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4 p-4 sm:p-6">
          {templates.length === 0 ? (
            <div className="overview-section p-8 text-center text-slate-600">No stage templates yet.</div>
          ) : (
            templates.map((template) => (
              <div key={template._id} className="overview-section p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Typography variant="h5" className="text-slate-800">
                      {template.name}
                    </Typography>
                    <Typography className="text-sm text-slate-600">{template.description || "No description"}</Typography>
                  </div>
                  <div className="flex items-center gap-2">
                    {template.is_default && <span className="ui-badge ui-badge--complete">Default</span>}
                    <Button variant="text" className="ui-button ui-button--blue px-4 py-2 text-slate-800 shadow-none" onClick={() => openEdit(template)}>
                      Edit
                    </Button>
                    <Button variant="text" className="ui-button ui-button--rose px-4 py-2 text-slate-800 shadow-none" onClick={() => removeTemplate(template._id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(template.stages || []).map((stage) => (
                    <span key={`${template._id}-${stage.key}`} className="ui-table-chip">
                      {stage.name}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Dialog open={dialogOpen} handler={() => setDialogOpen(false)} size="md" className="ui-modal ui-modal--no-overlay bg-transparent shadow-none">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
          <div className="ui-modal__card stage-template-modal max-w-[64rem]">
            <div className="ui-modal__header bg-[linear-gradient(135deg,#fef08a_0%,#fff9e6_100%)]">
              <Typography variant="h5" className="text-slate-800">
                {editingId ? "Update stage template" : "Create stage template"}
              </Typography>
            </div>
            <div className="ui-modal__body">
              <form className="ui-modal__stack" onSubmit={submit}>
                <div className="ui-modal__grid">
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Name</span>
                    <input className="sketch-input-plain" value={name} onChange={(event) => setName(event.target.value)} required placeholder="Template name" />
                  </label>
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Default</span>
                    <div className="rounded-[16px] border border-dashed border-slate-300 bg-white/70 px-4 py-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isDefault}
                          onChange={(event) => setIsDefault(event.target.checked)}
                          className="h-5 w-5 rounded border-2 border-slate-400 accent-blue-500"
                        />
                        <span className="text-lg text-slate-700">Set as default template</span>
                      </label>
                    </div>
                  </label>
                </div>
                <label className="ui-modal__field">
                  <span className="text-sm font-semibold text-slate-700">Description</span>
                  <textarea className="sketch-textarea-plain min-h-[120px]" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
                </label>

                <div className="ui-modal__note">
                  <div className="flex items-center justify-between">
                    <Typography variant="small" className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Stages
                    </Typography>
                    <Button type="button" variant="text" className="ui-button ui-button--blue px-4 py-1.5 text-slate-800 shadow-none" onClick={addStage}>
                      Add stage
                    </Button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {stages.map((stage, index) => (
                      <div
                        key={`stage-${index}`}
                        className="grid items-center gap-2 lg:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_180px_auto]"
                        draggable
                        onDragStart={() => setDraggingIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggingIndex === null) return;
                          moveStage(draggingIndex, index);
                          setDraggingIndex(null);
                        }}
                        onDragEnd={() => setDraggingIndex(null)}
                      >
                        <button
                          type="button"
                          className="ui-button ui-button--ghost px-2 py-2 text-slate-700 shadow-none"
                          title="Drag to reorder"
                        >
                          ⋮⋮
                        </button>
                        <input
                          className="sketch-input-plain"
                          placeholder="Name"
                          value={stage.name}
                          onChange={(event) => upsertStage(index, { name: event.target.value, key: slugify(event.target.value) })}
                          required
                        />
                        <input
                          className="sketch-input-plain"
                          placeholder="Key"
                          value={stage.key}
                          onChange={(event) => upsertStage(index, { key: slugify(event.target.value) })}
                          required
                        />
                        <select className="sketch-select-plain" value={stage.color} onChange={(event) => upsertStage(index, { color: event.target.value })}>
                          {COLORS.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                        <Button type="button" variant="text" className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none lg:w-auto" onClick={() => removeStage(index)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ui-modal__actions">
                  <Button type="button" variant="text" className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="text" className="ui-button ui-button--green px-4 py-2 text-slate-800 shadow-none">
                    {editingId ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
