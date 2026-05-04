import React, { useEffect, useState } from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import { Alert, Button, Dialog, Input, Option, Select, Typography } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";
import "../css/project.css";

export default function AddUser() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [role, setRole] = useState("");
  const [team, setTeam] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleOpen = () => setOpen((cur) => !cur);

  useEffect(() => {
    axios
      .get(`${apiBase}/teams/`, {
        headers: {
          Authorization: `Bearer ${cookie.parse(document.cookie).token}`,
        },
      })
      .then((res) => setTeam(res.data || []))
      .catch((err) => {
        setToastMessage(err.message || "Unable to load teams");
        setToastOpen(true);
      });
  }, []);

  useEffect(() => {
    if (!toastOpen) return undefined;
    const timer = setTimeout(() => setToastOpen(false), 3000);
    return () => clearTimeout(timer);
  }, [toastOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cookies = cookie.parse(document.cookie);

    try {
      await axios.post(
        `${apiBase}/users`,
        {
          name,
          dob: dob ? new Date(dob).getTime() : null,
          role,
          email,
          username,
          password,
          team: selectedTeam,
        },
        {
          headers: {
            Authorization: `Bearer ${cookies.token}`,
          },
        }
      );
      setToastMessage("User added successfully");
      setToastOpen(true);
      setOpen(false);
      setUsername("");
      setPassword("");
      setName("");
      setEmail("");
      setDob("");
      setRole("");
      setSelectedTeam("");
    } catch (err) {
      setToastMessage(err.message || "User could not be added");
      setToastOpen(true);
    }
  };

  return (
    <>
      <Button className="sketch-button flex items-center gap-3 px-4 py-2 text-sm font-semibold" variant="text" onClick={handleOpen}>
        <UserPlusIcon strokeWidth={2} className="h-4 w-4" /> Add User
      </Button>
      <Dialog size="md" open={open} handler={handleOpen} className="ui-modal bg-transparent shadow-none">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
          <div className="ui-modal__card max-w-[42rem]">
            <div className="ui-modal__header bg-[linear-gradient(135deg,#d8f6ea_0%,#f6fffb_100%)]">
              <Typography variant="h4" className="sketch-heading">
                Add User
              </Typography>
              <Typography className="sketch-subtitle mt-1 text-sm">
                Build the profile carefully so access, team, and role stay aligned.
              </Typography>
            </div>
            <div className="ui-modal__body">
              <form className="ui-modal__stack" onSubmit={handleSubmit}>
                <div className="ui-modal__grid">
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">Username</Typography>
                    <Input className="sketch-input" required label="Username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">Password</Typography>
                    <Input className="sketch-input" required label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                </div>
                <div className="ui-modal__grid">
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">Name</Typography>
                    <Input className="sketch-input" required label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">Email</Typography>
                    <Input className="sketch-input" required label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="ui-modal__grid">
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">Date of Birth</Typography>
                    <Input className="sketch-input" required label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>
                  <div className="ui-modal__field">
                    <Typography variant="small" className="font-semibold text-slate-700">Role</Typography>
                    <Select label="Role" value={role} onChange={(value) => setRole(value)}>
                      <Option value="admin">Admin</Option>
                      <Option value="manager">Manager</Option>
                      <Option value="employee">Member</Option>
                    </Select>
                  </div>
                </div>
                <div className="ui-modal__field">
                  <Typography variant="small" className="font-semibold text-slate-700">Team</Typography>
                  <Select label="Team" value={selectedTeam} onChange={(value) => setSelectedTeam(value)}>
                    {team.map((item) => (
                      <Option key={item._id} value={item._id}>{item.name}</Option>
                    ))}
                  </Select>
                </div>
                <div className="ui-modal__actions">
                  <Button type="button" variant="text" className="ui-button ui-button--ghost px-5 py-2 text-slate-800 shadow-none" onClick={handleOpen}>Cancel</Button>
                  <Button type="submit" className="ui-button ui-button--green px-5 py-2 font-semibold text-slate-800 shadow-none">Add User</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
      <Alert
        open={toastOpen}
        onClick={() => setToastOpen(false)}
        className="fixed right-4 top-20 z-50 w-[min(22rem,calc(100vw-2rem))] sketch-note border-slate-300 bg-[#d1fae5] text-slate-900"
      >
        <Typography className="font-semibold text-slate-900">{toastMessage}</Typography>
      </Alert>
    </>
  );
}
