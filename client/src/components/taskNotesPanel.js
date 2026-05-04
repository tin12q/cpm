import { useEffect, useMemo, useState } from "react";
import cookie from "cookie";
import axios from "axios";
import { Button, Textarea, Typography } from "@material-tailwind/react";
import apiBase from "../helpers/apiBase";
import "../css/project.css";
import "../css/task.css";

function formatDateTime(value) {
  if (!value) return "Just now";
  return new Date(value).toLocaleString();
}

function extractMentions(text) {
  return Array.from(new Set((text.match(/@([a-zA-Z0-9._-]+)/g) || []).map((item) => item.slice(1))));
}

export default function TaskNotesPanel({ taskId }) {
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [message, setMessage] = useState("");
  const cookies = cookie.parse(document.cookie);
  const headers = useMemo(() => ({ Authorization: `Bearer ${cookies.token}` }), [cookies.token]);

  const mentionSuggestions = useMemo(() => {
    const names = extractMentions(draft);
    if (names.length === 0) return [];

    return users
      .filter((user) => names.some((name) => user.name?.toLowerCase().includes(name.toLowerCase()) || user.email?.toLowerCase().includes(name.toLowerCase())))
      .slice(0, 5);
  }, [draft, users]);

  useEffect(() => {
    let cancelled = false;

    const loadNotes = async () => {
      setLoading(true);
      setMessage("");

      try {
        const [noteRes, userRes] = await Promise.allSettled([
          axios.get(`${apiBase}/tasks/${taskId}/notes`, { headers }),
          axios.get(`${apiBase}/users/getAll`, { headers }),
        ]);

        if (cancelled) return;

        if (noteRes.status === "fulfilled") {
          setNotes(noteRes.value.data || []);
          setUnsupported(false);
        } else {
          const status = noteRes.reason?.response?.status;
          setNotes([]);
          setUnsupported(status === 404 || status === 405 || status === 500);
          if (status && status !== 404 && status !== 405 && status !== 500) {
            setMessage(noteRes.reason?.response?.data?.error || "Unable to load notes.");
          }
        }

        if (userRes.status === "fulfilled") {
          setUsers(userRes.value.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error.response?.data?.error || error.message || "Unable to load notes.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadNotes();

    return () => {
      cancelled = true;
    };
  }, [headers, taskId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!draft.trim() || unsupported) return;

    setSaving(true);
    setMessage("");

    try {
      const mentions = extractMentions(draft);
      const response = await axios.post(
        `${apiBase}/tasks/${taskId}/notes`,
        { content: draft.trim(), mentions },
        { headers }
      );
      const created = response.data;
      setNotes((current) => [created, ...current]);
      setDraft("");
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 405 || status === 500) {
        setUnsupported(true);
      }
      setMessage(error.response?.data?.error || error.message || "Unable to save note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="task-notes-panel sketch-panel-soft p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Typography variant="h5" className="sketch-heading">
            Task notes
          </Typography>
          <Typography className="sketch-subtitle mt-1 text-sm">
            Keep delivery context, decisions, and mentions attached to the task.
          </Typography>
        </div>
        {unsupported && <span className="sketch-status sketch-status--late">API unavailable</span>}
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="ui-modal__field">
          <span className="text-sm font-semibold text-slate-700">Add note</span>
          <Textarea
            placeholder="Write a note. Mention teammates with @name"
            className="sketch-input min-h-[120px]"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={unsupported}
          />
        </div>
        {mentionSuggestions.length > 0 && (
          <div className="rounded-[18px] border-2 border-dashed border-slate-200 bg-white/75 px-4 py-3">
            <Typography className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Mention matches
            </Typography>
            <div className="mt-2 flex flex-wrap gap-2">
              {mentionSuggestions.map((user) => (
                <span key={user._id} className="sketch-chip bg-white/90 text-xs">
                  @{user.name || user.email}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Typography className="text-xs text-slate-500">Use `@name` to tag collaborators for later notification wiring.</Typography>
          <Button type="submit" className="sketch-button px-4 py-2 text-sm font-semibold" disabled={saving || unsupported || !draft.trim()}>
            {saving ? "Saving..." : "Add note"}
          </Button>
        </div>
      </form>

      {message && (
        <div className="mt-4 rounded-[18px] border-2 border-dashed border-rose-200 bg-rose-50/85 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading && <Typography className="text-sm text-slate-500">Loading notes...</Typography>}
        {!loading && notes.length === 0 && (
          <div className="rounded-[18px] border-2 border-dashed border-slate-200 bg-white/75 px-4 py-5 text-center text-sm text-slate-500">
            {unsupported ? "Notes will appear here after the backend endpoints are available." : "No notes yet. Add the first delivery note."}
          </div>
        )}
        {notes.map((note, index) => {
          const authorName = note.author?.name || note.authorName || note.author?.email || "Unknown author";
          const mentions = Array.isArray(note.mentions) ? note.mentions : [];

          return (
            <article key={note._id || `${authorName}-${index}`} className="task-note-item sketch-note p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography className="font-bold text-slate-900">{authorName}</Typography>
                <Typography className="text-xs uppercase tracking-[0.15em] text-slate-500">{formatDateTime(note.createdAt || note.updatedAt)}</Typography>
              </div>
              <Typography className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {note.content || note.message || "No content"}
              </Typography>
              {mentions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {mentions.map((mention) => {
                    const label = typeof mention === "object" ? mention.name || mention.email || mention._id : mention;
                    return (
                      <span key={String(label)} className="sketch-chip bg-white/90 text-xs">
                        @{label}
                      </span>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
