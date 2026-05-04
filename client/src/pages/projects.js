import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import cookie from "cookie";
import { Card, CardBody, CardHeader, Typography, CardFooter, Button, Input } from "@material-tailwind/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { Link, useNavigate } from "react-router-dom";
import ProjectCard from "../components/projectCard";
import AddProject from "../components/addProjectDialog";
import apiBase from "../helpers/apiBase";

const Projects = () => {
  const navigate = useNavigate();
  const cookies = cookie.parse(document.cookie);
  const [projects, setProjects] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!cookies.token) {
      navigate("/signin");
    }
  }, [cookies.token, navigate]);

  useEffect(() => {
    const request = search
      ? axios.get(`${apiBase}/projects/search?search=${search}`, {
          headers: { Authorization: `Bearer ${cookies.token}` },
        })
      : axios.get(`${apiBase}/projects?page=${page}`, {
          headers: { Authorization: `Bearer ${cookies.token}` },
        });

    request
      .then((res) => setProjects(res.data || []))
      .catch(() => setProjects([]));
  }, [page, search, cookies.token]);

  const stats = useMemo(() => {
    const summary = { total: projects.length, completed: 0, progress: 0, late: 0 };
    projects.forEach((project) => {
      if (project.status === "completed") summary.completed += 1;
      else if (project.status === "in progress") summary.progress += 1;
      else summary.late += 1;
    });
    return summary;
  }, [projects]);

  return (
    <div className="mt-20 min-h-screen px-4 pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Card className="overview-shell">
          <CardHeader floated={false} shadow={false} className="overview-header rounded-none">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
                  Project atlas
                </Typography>
                <Typography variant="h2" color="blue-gray" className="sketch-heading">
                  Projects List
                </Typography>
                <Typography color="gray" className="text-base leading-7">
                  Cards, badges, and controls now follow the same dashboard vocabulary instead of mixing page-local treatments.
                </Typography>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="w-full sm:w-80">
                  <Input className="sketch-input" label="Search projects" icon={<MagnifyingGlassIcon className="h-5 w-5" />} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Link to="/stage-templates">
                  <Button variant="text" className="ui-button ui-button--blue px-4 py-2 text-slate-800 shadow-none">
                    Stage templates
                  </Button>
                </Link>
                <Link to="/contacts">
                  <Button variant="text" className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none">
                    Contacts
                  </Button>
                </Link>
                {cookies.role === "admin" && <AddProject />}
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4 p-4 sm:p-6">
            <div className="overview-grid overview-grid--stats">
              <div className="ui-stat-card sketch-sticky-amber">
                <div className="ui-stat-card__eyebrow">Visible projects</div>
                <div className="ui-stat-card__value">{stats.total}</div>
                <div className="ui-stat-card__meta">Current search result</div>
              </div>
              <div className="ui-stat-card sketch-sticky-green">
                <div className="ui-stat-card__eyebrow">Completed</div>
                <div className="ui-stat-card__value">{stats.completed}</div>
                <div className="ui-stat-card__meta">Delivered boards</div>
              </div>
              <div className="ui-stat-card sketch-sticky-blue">
                <div className="ui-stat-card__eyebrow">In progress</div>
                <div className="ui-stat-card__value">{stats.progress}</div>
                <div className="ui-stat-card__meta">Active project work</div>
              </div>
              <div className="ui-stat-card sketch-sticky-pink">
                <div className="ui-stat-card__eyebrow">Late</div>
                <div className="ui-stat-card__value">{stats.late}</div>
                <div className="ui-stat-card__meta">Needs recovery</div>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="overview-section p-8 text-center">
                <Typography variant="h5" color="blue-gray">
                  No projects found
                </Typography>
                <Typography color="gray" className="mt-2">
                  Try a different search term or create a new project note.
                </Typography>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project._id}
                    id={project._id}
                    title={project.title}
                    dueDate={project.due_date}
                    status={project.status}
                    description={project.description}
                    customer={project.customer}
                    contact={project.contact}
                  />
                ))}
              </div>
            )}
          </CardBody>
          <CardFooter className="flex items-center justify-between border-t border-dashed border-slate-300/80 bg-white/50 px-4 py-4 sm:px-6">
            <Typography variant="small" color="blue-gray" className="font-normal">
              Page {page}
            </Typography>
            <div className="flex gap-2">
              <Button variant="text" className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none" size="sm" onClick={() => setPage((current) => (current > 1 ? current - 1 : 1))}>
                Previous
              </Button>
              <Button variant="text" className="ui-button ui-button--blue px-4 py-2 text-slate-800 shadow-none" size="sm" onClick={() => setPage((current) => current + 1)}>
                Next
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Projects;
