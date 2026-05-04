import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  Switch,
  Typography,
} from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";
import "../css/project.css";

export default function TaskDone({ id, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [isDone, setDone] = useState(false);
  const [title, setTitle] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const cookies = cookie.parse(document.cookie);
  const headers = useMemo(() => ({ Authorization: `Bearer ${cookies.token}` }), [cookies.token]);

  useEffect(() => {
    axios
      .get(`${apiBase}/tasks/${id}`, { headers })
      .then((res) => {
        setTitle(res.data.title || "Task");
      })
      .catch((error) => {
        setToastMessage(error.response?.data?.error || error.message || "Unable to load task");
        setToastOpen(true);
      });
  }, [headers, id]);

  useEffect(() => {
    if (!toastOpen) return undefined;
    const timer = setTimeout(() => setToastOpen(false), 2500);
    return () => clearTimeout(timer);
  }, [toastOpen]);

  const handleOpen = () => setOpen((current) => !current);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await axios.post(`${apiBase}/tasks/done/${id}`, { isDone }, { headers });
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      setToastMessage(error?.response?.data?.error || error.message || "Unable to complete task");
      setToastOpen(true);
    }
  };

  return (
    <>
      <Button className="sketch-button px-4 py-2 text-sm font-semibold" variant="text" onClick={handleOpen}>
        Complete?
      </Button>
      <Dialog size="sm" open={open} handler={handleOpen} className="ui-modal bg-transparent shadow-none">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
          <div className="ui-modal__card max-w-[28rem]">
            <div className="ui-modal__header bg-[linear-gradient(135deg,#fce7f3_0%,#fff8fb_100%)] text-center">
              <Typography variant="h4" className="sketch-heading">
                {title} completion
              </Typography>
              <Typography className="sketch-subtitle mt-1 text-sm">
                Mark the card done only when the work is actually finished.
              </Typography>
            </div>
            <div className="ui-modal__body">
              <form className="ui-modal__stack" onSubmit={handleSubmit}>
                <div className="ui-modal__note flex items-center justify-between gap-4">
                  <div>
                    <Typography variant="small" className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Done
                    </Typography>
                    <Typography className="text-sm text-slate-700">
                      Toggle to confirm completion.
                    </Typography>
                  </div>
                  <Switch color="blue" checked={isDone} onChange={() => setDone(!isDone)} />
                </div>
                <div className="ui-modal__actions">
                  <Button type="button" variant="text" className="ui-button ui-button--ghost px-5 py-2 text-slate-800 shadow-none" onClick={handleOpen}>
                    Cancel
                  </Button>
                  <Button type="submit" className="ui-button ui-button--green px-5 py-2 font-semibold text-slate-800 shadow-none">
                    Confirm
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
      {toastOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] sketch-note border-slate-300 bg-[#fce7f3] px-4 py-3 text-slate-900">
          <Typography className="font-semibold text-slate-900">{toastMessage}</Typography>
        </div>
      )}
    </>
  );
}
