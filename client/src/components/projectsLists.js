import axios from "axios";
import cookie from "cookie";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Typography } from "@material-tailwind/react";
import ProjectCard from "../components/projectCard";
import apiBase from "../helpers/apiBase";

const shell =
	"rounded-[28px] border border-slate-300/80 bg-[#faf6ec] shadow-[10px_10px_0_rgba(17,24,39,0.12)]";

const ProjectList = () => {
	const cookies = cookie.parse(document.cookie);
	const [projects, setProjects] = useState([]);

	useEffect(() => {
		axios
			.get(`${apiBase}/projects`, {
				headers: { Authorization: `Bearer ${cookies.token}` },
			})
			.then((res) => {
				setProjects(res.data || []);
			})
			.catch((err) => {
				alert(err);
			});
	}, [cookies.token]);

	return (
		<Card className={shell}>
			<CardHeader floated={false} shadow={false} className="rounded-none border-b border-dashed border-slate-300 bg-[linear-gradient(135deg,#f3e6cd_0%,#fbf8f2_100%)] p-6">
				<Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
					Project overview
				</Typography>
				<Typography variant="h4" color="blue-gray" className="mt-2">
					Notebook-style project cards
				</Typography>
			</CardHeader>
			<CardBody className="p-6">
				{projects.length === 0 ? (
					<Typography color="gray">No projects yet.</Typography>
				) : (
					<div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
						{projects.map((project) => (
							<ProjectCard
								key={project._id}
								id={project._id}
								title={project.title}
								due_date={project.due_date}
								status={project.status}
								description={project.description}
								customer={project.customer}
								contact={project.contact}
							/>
						))}
					</div>
				)}
			</CardBody>
		</Card>
	);
};

export default ProjectList;
