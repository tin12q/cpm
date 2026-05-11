import React, { useEffect, useState } from "react";
import { Alert, Button, Dialog, Input, Typography } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import Select from "react-select";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import apiBase from "../helpers/apiBase";
import "../css/project.css";

const selectPortalStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

export default function AddTeam() {
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [assignedTo, setAssignedTo] = useState([]);
  const [selectedOption, setSelectedOption] = useState([]);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleOpen = () => setOpen((cur) => !cur);

  useEffect(() => {
    axios
      .get(`${apiBase}/users`, {
        headers: {
          Authorization: `Bearer ${cookie.parse(document.cookie).token}`,
        },
      })
      .then((res) => {
        setMembers(
          (res.data || []).map((member) => ({
            value: member._id,
            label: member.name,
          }))
        );
      })
      .catch((err) => {
        setToastMessage(err.message || "Unable to load members");
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
        `${apiBase}/teams`,
        {
          name,
          members: assignedTo,
        },
        { headers: { Authorization: `Bearer ${cookies.token}` } }
      );
      setToastMessage("Team added successfully");
      setToastOpen(true);
      setOpen(false);
      setName("");
      setAssignedTo([]);
      setSelectedOption([]);
    } catch (err) {
      setToastMessage("Team not added");
      setToastOpen(true);
    }
  };

  return (
    <>
      <Button className="sketch-button flex items-center gap-3 px-4 py-2 text-sm font-semibold" variant="text" onClick={handleOpen}>
        <UserGroupIcon strokeWidth={2} className="h-4 w-4" /> Add Team
      </Button>
      <Dialog size="md" open={open} handler={handleOpen} className="ui-modal ui-modal--no-overlay bg-transparent shadow-none">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
          <div className="ui-modal__card max-w-[40rem]">
            <div className="ui-modal__header bg-[linear-gradient(135deg,#fce7f3_0%,#fff8fb_100%)]">
              <Typography variant="h4" className="sketch-heading">Add Team</Typography>
              <Typography className="sketch-subtitle mt-1 text-sm">Name the team, then assign members who will actually work together.</Typography>
            </div>
            <div className="ui-modal__body">
              <form className="ui-modal__stack" onSubmit={handleSubmit}>
                <div className="ui-modal__field">
                  <Typography variant="small" className="font-semibold text-slate-700">Name</Typography>
                  <Input className="sketch-input" required label="Name" size="lg" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="ui-modal__field">
                  <Typography variant="small" className="font-semibold text-slate-700">Members</Typography>
                  <Select
                    isMulti
                    classNamePrefix="sketch-select"
                    options={members}
                    onChange={(selected) => {
                      const safeSelected = selected || [];
                      setSelectedOption(safeSelected);
                      setAssignedTo(safeSelected.map((option) => option.value));
                    }}
                    value={selectedOption}
                    placeholder="Assign members"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                    styles={selectPortalStyles}
                  />
                </div>
                <div className="ui-modal__actions">
                  <Button type="button" variant="text" className="ui-button ui-button--ghost px-5 py-2 text-slate-800 shadow-none" onClick={handleOpen}>Cancel</Button>
                  <Button type="submit" className="ui-button ui-button--green px-5 py-2 font-semibold text-slate-800 shadow-none">Add Team</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
      <Alert
        open={toastOpen}
        onClick={() => setToastOpen(false)}
        className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] sketch-note border-slate-300 bg-[#fce7f3] text-slate-900"
      >
        <Typography className="font-semibold text-slate-900">{toastMessage}</Typography>
      </Alert>
    </>
  );
}
