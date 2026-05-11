import { Button, Card, CardBody, CardFooter, CardHeader, Dialog, Input, Textarea, Typography } from "@material-tailwind/react";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export default function SkillsPage() {
  const cookies = cookie.parse(document.cookie);
  const [skills, setSkills] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", description: "", editingId: null });
  const [dialogOpen, setDialogOpen] = useState(false);
  const token = cookies.token;
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const toggleDialog = () => setDialogOpen((prev) => !prev);

  const loadSkills = useCallback(async () => {
    const res = await axios.get(`${apiBase}/skills?limit=0`, {
      headers,
    });
    setSkills(res.data || []);
  }, [headers]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const filteredSkills = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return skills;
    return skills.filter((skill) => {
      const haystack = `${skill.name || ""} ${skill.description || ""}`;
      return normalizeText(haystack).includes(term);
    });
  }, [search, skills]);

  const stats = useMemo(() => {
    const total = skills.length;
    const withDescriptions = skills.filter((skill) => skill.description && skill.description.trim()).length;
    const withoutDescriptions = total - withDescriptions;
    const searchResult = filteredSkills.length;
    return { total, withDescriptions, withoutDescriptions, searchResult };
  }, [filteredSkills.length, skills]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (form.editingId) {
      await axios.put(`${apiBase}/skills/${form.editingId}`, { name: form.name, description: form.description }, { headers });
    } else {
      await axios.post(`${apiBase}/skills`, { name: form.name, description: form.description }, { headers });
    }
    setForm({ name: "", description: "", editingId: null });
    setDialogOpen(false);
    await loadSkills();
  };

  return (
    <div className="mt-20 min-h-screen px-4 pb-10 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <Card className="overview-shell">
          <CardHeader floated={false} shadow={false} className="overview-header rounded-none">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-2">
                <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
                  Skill studio
                </Typography>
                <Typography variant="h2" color="blue-gray" className="sketch-heading">
                  Skill Catalog
                </Typography>
                <Typography color="gray" className="text-base leading-7">
                  A real CRUD workspace: searchable list, visible descriptions, and a cleaner modal that reads like a catalog editor instead of an empty shell.
                </Typography>
              </div>
              <Button
                variant="text"
                className="ui-button ui-button--amber px-5 py-2 text-slate-800 shadow-none"
                onClick={() => {
                  setForm({ name: "", description: "", editingId: null });
                  setDialogOpen(true);
                }}
              >
                Add Skill
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-5 p-4 sm:p-6 lg:p-7">
            <div className="overview-grid overview-grid--stats">
              <div className="ui-stat-card sketch-sticky-amber">
                <div className="ui-stat-card__eyebrow">Total skills</div>
                <div className="ui-stat-card__value">{stats.total}</div>
                <div className="ui-stat-card__meta">Catalog entries loaded</div>
              </div>
              <div className="ui-stat-card sketch-sticky-green">
                <div className="ui-stat-card__eyebrow">Documented</div>
                <div className="ui-stat-card__value">{stats.withDescriptions}</div>
                <div className="ui-stat-card__meta">Entries with descriptions</div>
              </div>
              <div className="ui-stat-card sketch-sticky-pink">
                <div className="ui-stat-card__eyebrow">Undocumented</div>
                <div className="ui-stat-card__value">{stats.withoutDescriptions}</div>
                <div className="ui-stat-card__meta">Need more detail</div>
              </div>
              <div className="ui-stat-card sketch-sticky-blue">
                <div className="ui-stat-card__eyebrow">Search result</div>
                <div className="ui-stat-card__value">{stats.searchResult}</div>
                <div className="ui-stat-card__meta">Current filter match</div>
              </div>
            </div>

            <div className="overview-stack overview-stack--two">
              <div className="overview-section p-5">
                <Typography variant="small" className="tracking-[0.18em] uppercase text-slate-500">
                  Catalog guide
                </Typography>
                <Typography variant="h5" className="mt-2 text-slate-800">
                  Keep names reusable
                </Typography>
                <Typography className="mt-3 text-sm leading-7 text-slate-600">
                  A good skill name is short and reusable across users, tasks, and planning views. Use the description for scope, not for extra labels or noise.
                </Typography>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="ui-badge ui-badge--progress">Searchable</span>
                  <span className="ui-badge ui-badge--draft">Readable</span>
                  <span className="ui-badge ui-badge--complete">Reusable</span>
                </div>
              </div>

              <div className="overview-section p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <Typography variant="small" className="tracking-[0.18em] uppercase text-slate-500">
                      Search
                    </Typography>
                    <Typography variant="h6" className="mt-2 text-slate-800">
                      Filter by name or description
                    </Typography>
                  </div>
                  <div className="w-full max-w-md">
                    <Input label="Search skills" value={search} onChange={(event) => setSearch(event.target.value)} className="sketch-input" />
                  </div>
                </div>
              </div>
            </div>

            <div className="overview-section overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[minmax(180px,0.55fr)_minmax(0,1.2fr)_120px_180px] gap-4 border-b border-dashed border-slate-300/80 bg-[rgba(255,255,255,0.55)] px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span>Skill</span>
                    <span>Description</span>
                    <span>Status</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="divide-y divide-dashed divide-slate-300/75">
                    {filteredSkills.length === 0 ? (
                      <div className="px-5 py-10 text-center text-slate-600">No skills match the current filter.</div>
                    ) : (
                      filteredSkills.map((skill) => (
                        <div key={skill._id} className="grid grid-cols-[minmax(180px,0.55fr)_minmax(0,1.2fr)_120px_180px] items-start gap-4 px-5 py-4">
                          <div className="min-w-0">
                            <Typography variant="h6" className="truncate text-slate-800">
                              {skill.name}
                            </Typography>
                            <Typography className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                              {(skill.name || "").length} chars
                            </Typography>
                          </div>
                          <Typography className="text-sm leading-7 text-slate-600">
                            {skill.description || "No description yet."}
                          </Typography>
                          <div>
                            <span className={skill.description ? "ui-badge ui-badge--complete" : "ui-badge ui-badge--draft"}>
                              {skill.description ? "Ready" : "Draft"}
                            </span>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="text"
                              className="ui-button ui-button--blue px-4 py-2 text-slate-800 shadow-none"
                              onClick={() => {
                                setForm({ name: skill.name, description: skill.description, editingId: skill._id });
                                setDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="text"
                              className="ui-button ui-button--rose px-4 py-2 text-slate-800 shadow-none"
                              onClick={() => axios.delete(`${apiBase}/skills/${skill._id}`, { headers }).then(() => loadSkills())}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
          <CardFooter className="border-t border-dashed border-slate-300/80 bg-white/50 p-4">
            <Typography variant="small" color="blue-gray" className="font-normal">
              Showing {filteredSkills.length} of {skills.length} skills
            </Typography>
          </CardFooter>
        </Card>

        <Dialog open={dialogOpen} handler={toggleDialog} size="sm" className="ui-modal bg-transparent shadow-none">
          <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
            <div className="ui-modal__card">
              <div className="ui-modal__header bg-[linear-gradient(135deg,#f2e2be_0%,#fcf9f3_100%)]">
                <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
                  Skill entry
                </Typography>
                <Typography variant="h5" color="blue-gray" className="mt-2">
                  {form.editingId ? "Update Skill" : "Add Skill"}
                </Typography>
              </div>
              <div className="ui-modal__body">
                <form className="ui-modal__stack" onSubmit={handleSubmit}>
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">
                      Name
                    </Typography>
                    <Input className="sketch-input" required label="Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </div>
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">
                      Description
                    </Typography>
                    <Textarea className="sketch-input" label="Description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
                  </div>
                  <div className="ui-modal__actions">
                    <Button
                      type="button"
                      variant="text"
                      className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none"
                      onClick={() => {
                        setDialogOpen(false);
                        setForm({ name: "", description: "", editingId: null });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="text" className="ui-button ui-button--green px-4 py-2 text-slate-800 shadow-none">
                      {form.editingId ? "Update" : "Add"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
}
