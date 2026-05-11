import {
  Card,
  CardBody,
  CardHeader,
  Typography,
  Button,
  Input,
  Textarea,
} from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiBase from "../helpers/apiBase";
import Select from "react-select";
import "../css/project.css";
import "../css/mem.css";

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cookies = cookie.parse(document.cookie);
  const [user, setUser] = useState(null);
  const [skills, setSkills] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [role, setRole] = useState("");
  const [skillForm, setSkillForm] = useState({
    name: "",
    description: "",
    editingId: null,
  });
  const headers = { Authorization: `Bearer ${cookies.token}` };

  const loadUser = async () => {
    const res = await axios.get(`${apiBase}/users/${id}`, { headers });
    setUser(res.data);
    setRole(res.data.role || "");
  };

  const loadSkills = async () => {
    const res = await axios.get(`${apiBase}/users/${id}/skills`, { headers });
    setSkills(res.data || []);
  };

  const loadCatalog = async () => {
    const res = await axios.get(`${apiBase}/skills?limit=0`, { headers });
    setCatalog(res.data || []);
  };

  useEffect(() => {
    loadUser();
    loadSkills();
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSaveRole = async () => {
    if (!user) return;
    await axios.put(
      `${apiBase}/users/${id}`,
      {
        name: user.name,
        dob: user.dob,
        email: user.email,
        role,
        skills,
      },
      { headers }
    );
    await loadUser();
  };

  const handleSkillSubmit = async (e) => {
    e.preventDefault();
    if (!skillForm.name.trim()) return;
    if (skillForm.editingId) {
      await axios.put(
        `${apiBase}/users/${id}/skills/${skillForm.editingId}`,
        {
          name: skillForm.name,
          description: skillForm.description,
        },
        { headers }
      );
    } else {
      await axios.post(
        `${apiBase}/users/${id}/skills`,
        {
          name: skillForm.name,
          description: skillForm.description,
        },
        { headers }
      );
    }
    setSkillForm({ name: "", description: "", editingId: null });
    await loadSkills();
  };

  const handleCatalogSelect = (selected) => {
    if (!selected) {
      setSkillForm({ name: "", description: "", editingId: null });
      return;
    }
    setSkillForm({
      name: selected.label,
      description: selected.description || "",
      editingId: null,
    });
  };

  const handleSkillEdit = (skill) => {
    setSkillForm({
      name: skill.name,
      description: skill.description,
      editingId: skill._id,
    });
  };

  const handleSkillDelete = async (skillId) => {
    await axios.delete(`${apiBase}/users/${id}/skills/${skillId}`, { headers });
    if (skillForm.editingId === skillId) {
      setSkillForm({ name: "", description: "", editingId: null });
    }
    await loadSkills();
  };

  if (!user) return null;

  return (
    <div className="sketch-page">
      <div className="sketch-shell grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="sketch-panel sketch-panel-hover overflow-hidden">
          <CardHeader shadow={false} floated={false} className="m-0 border-b-2 border-dashed border-slate-300 bg-[#fef9c3] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Typography variant="h4" className="sketch-heading text-2xl">
                  {user.name}
                </Typography>
                <Typography color="gray" className="text-sm">
                  {user.email}
                </Typography>
              </div>
              <Button className="sketch-button px-4 py-2 text-sm font-semibold shadow-none" onClick={() => navigate(-1)}>
                Back
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sketch-note sketch-sticky-blue p-4">
                <Typography variant="small" className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Role
                </Typography>
                <select
                  className="mt-3 w-full rounded-[18px] border-2 border-dashed border-slate-300 bg-white/90 p-3 text-sm shadow-[6px_6px_0_rgba(31,41,55,0.08)] outline-none"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="sketch-note sketch-sticky-amber p-4">
                <Typography variant="small" className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Date of Birth
                </Typography>
                <Input
                  className="mt-3"
                  type="date"
                  value={user.dob ? new Date(user.dob).toISOString().split("T")[0] : ""}
                  readOnly
                />
              </div>
            </div>
            <Button className="sketch-button px-5 py-2 font-semibold shadow-none" onClick={handleSaveRole}>
              Save Role
            </Button>
          </CardBody>
        </Card>

        <Card className="sketch-panel sketch-panel-hover overflow-hidden">
          <CardHeader shadow={false} floated={false} className="m-0 border-b-2 border-dashed border-slate-300 bg-[#dbeafe] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Typography variant="h4" className="sketch-heading text-2xl">
                  Skills
                </Typography>
                <Typography className="sketch-subtitle text-sm">
                  Add, edit, and curate the user skill set.
                </Typography>
              </div>
              {skillForm.editingId && (
                <Button variant="text" className="rounded-full px-4 py-2 font-semibold text-slate-600" onClick={() => setSkillForm({ name: "", description: "", editingId: null })}>
                  Cancel edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-5 p-6">
            <form className="space-y-4" onSubmit={handleSkillSubmit}>
              <div className="space-y-2">
                <Typography variant="small" className="font-semibold text-slate-700">
                  Pick from catalog
                </Typography>
                <Select
                  classNamePrefix="sketch-select"
                  options={catalog.map((s) => ({
                    value: s._id,
                    label: s.name,
                    description: s.description,
                  }))}
                  placeholder="Choose a skill"
                  onChange={handleCatalogSelect}
                  isClearable
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input required label="Skill" value={skillForm.name} onChange={(e) => setSkillForm((prev) => ({ ...prev, name: e.target.value }))} />
                <Textarea label="Description" value={skillForm.description} onChange={(e) => setSkillForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" className="sketch-button px-5 py-2 font-semibold shadow-none">
                  {skillForm.editingId ? "Update Skill" : "Add Skill"}
                </Button>
              </div>
            </form>
            <div className="grid gap-3">
              {skills.length === 0 && <Typography color="gray">No skills yet.</Typography>}
              {skills.map((skill) => (
                <div key={skill._id || skill.name} className="member-note p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Typography variant="h6" className="sketch-heading">
                        {skill.name}
                      </Typography>
                      <Typography color="gray" className="text-sm">
                        {skill.description || "No description"}
                      </Typography>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="text" className="rounded-full px-4 py-2 font-semibold text-blue-600" onClick={() => handleSkillEdit(skill)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="text" className="rounded-full px-4 py-2 font-semibold text-red-600" onClick={() => handleSkillDelete(skill._id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
