const { useState } = require("react");
const axios = require("axios");
function CardTest(props) {
  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title mb-3 text-2xl font-semibold">
          {props.title}
        </h5>
        <p className="card-text m-0 max-w-[30ch] text-sm opacity-50">
          {props.text}
        </p>
      </div>
    </div>
  );
}
function CardlistTest() {
  const [projects, setProjects] = useState([]);
  axios.get("/api/projects").then((res) => {
    setProjects(res.data);
  });

  return (
    <div>
      {projects.map((project) => {
        return <CardTest title={project.title} text={project.description} />;
      })}
      <CardTest
        title="Card title"
        text="Some quick example text to build on the card title and make up the bulk of the card's content."
      />
    </div>
  );
}
export default CardlistTest;
