import { useEffect, useState } from "react";
import axios from "axios";
import "../css/project.css";

function CardTest(props) {
  return (
    <div className="sketch-note sketch-panel-hover p-5">
      <h5 className="mb-3 text-2xl font-bold text-slate-900">{props.title}</h5>
      <p className="m-0 max-w-[30ch] text-sm text-slate-600">{props.text}</p>
    </div>
  );
}

function CardlistTest() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:1337/api/projects").then((res) => {
      setProjects(res.data || []);
    });
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <CardTest key={project._id || project.title} title={project.title} text={project.description} />
      ))}
      <CardTest
        title="Card title"
        text="Some quick example text to build on the card title and make up the bulk of the card's content."
      />
    </div>
  );
}

export default CardlistTest;
