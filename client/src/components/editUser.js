import React, { useEffect, useMemo, useState } from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import { Alert, Button, Card, CardBody, CardHeader, Dialog, Typography } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import Select from "react-select";
import apiBase from "../helpers/apiBase";
import "../css/project.css";
import "../css/mem.css";

const selectPortalStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

function normalizeSkill(skill) {
  if (!skill) return null;
  if (typeof skill === "string") {
    return { name: skill.trim(), description: "" };
  }
  return {
    _id: skill._id,
    name: String(skill.name || "").trim(),
    description: String(skill.description || "").trim(),
  };
}

function toSkillOption(skill) {
  const normalized = normalizeSkill(skill);
  if (!normalized?.name) return null;

  return {
    value: normalized._id || normalized.name,
    label: normalized.name,
    description: normalized.description,
  };
}

export default function EditUser({ id }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [role, setRole] = useState("");
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [skillCatalog, setSkillCatalog] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const cookies = cookie.parse(document.cookie);
  const headers = useMemo(() => ({ Authorization: `Bearer ${cookies.token}` }), [cookies.token]);

  const handleOpen = () => setOpen((current) => !current);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      axios.get(`${apiBase}/users/${id}`, { headers }),
      axios.get(`${apiBase}/teams/`, { headers }),
      axios.get(`${apiBase}/skills?limit=0`, { headers }),
    ])
      .then(([userResult, teamResult, catalogResult]) => {
        if (cancelled) return;

        const nextTeams = teamResult.status === "fulfilled" ? teamResult.value.data || [] : [];
        setTeams(nextTeams);

        if (userResult.status === "fulfilled") {
          const user = userResult.value.data || {};
          const inferredTeam =
            user.team ||
            nextTeams.find((team) => Array.isArray(team.members) && team.members.some((member) => String(member?._id || member) === String(id)))?._id ||
            "";
          setUsername(user.username || user.email || user.name || "");
          setName(user.name || "");
          setEmail(user.email || "");
          setRole(user.role || "employee");
          setSelectedTeam(inferredTeam);
          setDob(user.dob ? new Date(user.dob).toISOString().split("T")[0] : "");
          setSelectedSkills((user.skills || []).map(toSkillOption).filter(Boolean));
        } else {
          setToastMessage(userResult.reason?.response?.data?.error || userResult.reason?.message || "Unable to load user.");
          setToastOpen(true);
        }

        if (catalogResult.status === "fulfilled") {
          setSkillCatalog((catalogResult.value.data || []).map(toSkillOption).filter(Boolean));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [headers, id, open]);

  useEffect(() => {
    if (!toastOpen) return undefined;
    const timer = setTimeout(() => setToastOpen(false), 3000);
    return () => clearTimeout(timer);
  }, [toastOpen]);

  const skillOptions = useMemo(() => {
    const seen = new Set();
    return [...skillCatalog, ...selectedSkills].filter((skill) => {
      const key = String(skill?.label || skill?.value || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selectedSkills, skillCatalog]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await axios.put(
        `${apiBase}/users/${id}`,
        {
          name,
          dob: dob ? new Date(dob).getTime() : null,
          role,
          email,
          username,
          password,
          team: selectedTeam || null,
          skills: selectedSkills.map((skill) => ({
            name: skill.label,
            description: skill.description || "",
          })),
        },
        { headers }
      );
      setToastMessage("User updated successfully");
      setToastOpen(true);
      setOpen(false);
      setPassword("");
    } catch (error) {
      setToastMessage(error.response?.data?.error || error.message || "User update failed");
      setToastOpen(true);
    }
  };

  return (
    <>
      <Button className="sketch-button flex items-center gap-3 px-4 py-2 text-sm font-semibold" variant="text" onClick={handleOpen}>
        <UserPlusIcon strokeWidth={2} className="h-4 w-4" /> Update User
      </Button>
      <Dialog size="sm" open={open} handler={handleOpen} className="ui-modal ui-modal--no-overlay bg-transparent shadow-none">
        <Card className="mx-auto w-full max-w-[42rem] sketch-note">
          <CardHeader floated={false} shadow={false} className="m-0 rounded-t-[24px] border-b-2 border-dashed border-slate-300 bg-[#fef9c3] p-6">
            <Typography variant="h4" className="sketch-heading">
              Update User
            </Typography>
            <Typography className="sketch-subtitle mt-1 text-sm">
              Keep identity stable while updating role, team, access profile, and core skills.
            </Typography>
          </CardHeader>
          <CardBody className="p-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="sketch-field">
                  <span className="sketch-field__label">Username</span>
                  <input className="sketch-input-plain" type="text" value={username} disabled readOnly />
                </label>
                <label className="sketch-field">
                  <span className="sketch-field__label">Password</span>
                  <input
                    className="sketch-input-plain"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Leave blank to keep current password"
                  />
                  <span className="sketch-helper">Optional. Empty keeps the existing password.</span>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="sketch-field">
                  <span className="sketch-field__label">Name</span>
                  <input className="sketch-input-plain" type="text" value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label className="sketch-field">
                  <span className="sketch-field__label">Email</span>
                  <input className="sketch-input-plain" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="sketch-field">
                  <span className="sketch-field__label">Date of Birth</span>
                  <input className="sketch-input-plain" type="date" value={dob} onChange={(event) => setDob(event.target.value)} required />
                </label>
                <label className="sketch-field">
                  <span className="sketch-field__label">Role</span>
                  <select className="sketch-select-plain" value={role} onChange={(event) => setRole(event.target.value)} required>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <label className="sketch-field">
                  <span className="sketch-field__label">Team</span>
                  <select className="sketch-select-plain" value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
                    <option value="">No team</option>
                    {teams.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sketch-field">
                  <span className="sketch-field__label">Skills</span>
                  <Select
                    isMulti
                    classNamePrefix="sketch-select"
                    options={skillOptions}
                    value={selectedSkills}
                    isLoading={loading}
                    onChange={(value) => setSelectedSkills(value || [])}
                    placeholder="Select skills for this user"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                    styles={selectPortalStyles}
                  />
                </div>
              </div>

              {selectedSkills.length > 0 && (
                <div className="rounded-[22px] border-2 border-dashed border-slate-300 bg-white/75 p-4">
                  <Typography variant="small" className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Current skill pack
                  </Typography>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSkills.map((skill) => (
                      <span key={skill.value} className="sketch-chip bg-white/90 text-xs">
                        {skill.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="text" className="rounded-full px-5 py-2 font-semibold text-slate-600" onClick={handleOpen}>
                  Cancel
                </Button>
                <Button type="submit" className="sketch-button px-5 py-2 font-semibold shadow-none" disabled={loading}>
                  {loading ? "Loading..." : "Update User"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
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
