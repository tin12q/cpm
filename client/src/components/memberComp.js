import { Button, Card, CardBody, CardFooter, CardHeader, Typography } from "@material-tailwind/react";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";
import "../css/mem.css";

const PAGE_SIZE = 5;
const shell =
  "overflow-hidden rounded-[28px] border border-slate-300/80 bg-[#faf6ec] shadow-[10px_10px_0_rgba(17,24,39,0.12)]";

function normalizeMembers(source) {
  const seen = new Set();

  return (Array.isArray(source) ? source : [])
    .map((member) => {
      if (!member) return null;
      if (typeof member === "object") {
        return {
          _id: member._id || member.id || member.email || member.name,
          name: member.name || member.email || "Unknown",
          email: member.email || "",
          role: member.role || "Member",
          skills: Array.isArray(member.skills) ? member.skills : [],
        };
      }

      return {
        _id: String(member),
        name: "Unknown",
        email: "",
        role: "Member",
        skills: [],
      };
    })
    .filter((member) => {
      const key = String(member?._id || member?.email || member?.name || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default function MemberComp({ id, members: providedMembers }) {
  const [members, setMembers] = useState([]);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const hasProvidedMembers = Array.isArray(providedMembers);

  useEffect(() => {
    if (!hasProvidedMembers) return;
    setMembers(normalizeMembers(providedMembers));
    setPage(1);
    setMessage("");
  }, [hasProvidedMembers, providedMembers]);

  useEffect(() => {
    if (hasProvidedMembers || !id) return;

    let cancelled = false;

    axios
      .get(`${apiBase}/teams/users/${id}?page=${page}`, {
        headers: {
          Authorization: `Bearer ${cookie.parse(document.cookie).token}`,
        },
      })
      .then((res) => {
        if (cancelled) return;
        setMembers(normalizeMembers(res.data || []));
        setMessage("");
      })
      .catch((error) => {
        if (cancelled) return;
        setMembers([]);
        setMessage(error.response?.data?.error || error.message || "Unable to load team members.");
      });

    return () => {
      cancelled = true;
    };
  }, [hasProvidedMembers, id, page]);

  const totalPages = useMemo(() => {
    if (!hasProvidedMembers) return Math.max(1, page);
    return Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  }, [hasProvidedMembers, members.length, page]);

  const visibleMembers = useMemo(() => {
    if (!hasProvidedMembers) return members;
    const start = (page - 1) * PAGE_SIZE;
    return members.slice(start, start + PAGE_SIZE);
  }, [hasProvidedMembers, members, page]);

  const handleNextPage = () => {
    setPage((current) => Math.min(current + 1, totalPages));
  };

  const handlePrevPage = () => {
    setPage((current) => (current > 1 ? current - 1 : 1));
  };

  return (
    <Card className={`${shell} member-panel`}>
      <CardHeader floated={false} shadow={false} className="rounded-none border-b border-dashed border-slate-300 bg-[linear-gradient(135deg,#f2e2be_0%,#fdfaf5_100%)] p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
              Team members
            </Typography>
            <Typography variant="h5" color="blue-gray" className="mt-2">
              People on this board
            </Typography>
          </div>
          <span className="member-pill">{members.length} total</span>
        </div>
      </CardHeader>
      <CardBody className="member-panel__body space-y-3 p-5">
        {visibleMembers.length === 0 ? (
          <div className="member-empty">
            <Typography color="gray">{message || "No members linked to this project yet."}</Typography>
          </div>
        ) : (
          visibleMembers.map(({ _id, name, email, role, skills }) => (
            <div key={_id} className="member-note member-note--lift member-note--compact p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Typography variant="h6" color="blue-gray" className="member-text-truncate">
                    {name}
                  </Typography>
                  <Typography color="gray" className="member-text-truncate text-sm">
                    {email || "No email"}
                  </Typography>
                </div>
                <span className="member-pill shrink-0">{role || "Member"}</span>
              </div>
              {Array.isArray(skills) && skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 overflow-hidden">
                  {skills.slice(0, 3).map((skill) => {
                    const label = typeof skill === "object" ? skill.name : skill;
                    return (
                      <span key={`${_id}-${label}`} className="sketch-chip max-w-full bg-white/90 text-xs">
                        {label}
                      </span>
                    );
                  })}
                  {skills.length > 3 && <span className="sketch-chip bg-white/90 text-xs">+{skills.length - 3} more</span>}
                </div>
              )}
            </div>
          ))
        )}
      </CardBody>
      <CardFooter className="member-panel__footer flex items-center justify-between gap-3 border-t border-dashed border-slate-300/80 bg-white/50 p-4">
        <Typography variant="small" color="blue-gray" className="min-w-0 font-normal">
          Page {page} / {totalPages}
        </Typography>
        <div className="flex shrink-0 gap-2">
          <Button variant="outlined" color="blue-gray" size="sm" onClick={handlePrevPage} disabled={page <= 1}>
            Previous
          </Button>
          <Button variant="outlined" color="blue-gray" size="sm" onClick={handleNextPage} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
