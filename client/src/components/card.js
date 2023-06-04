import axios from "axios";

import {
  Card,
  CardBody,
  CardFooter,
  Typography,
  Button,
} from "@material-tailwind/react";
import { useState } from "react";

function Card1(props) {
  return (
    <Card className="mt-6 w-96">
      <CardBody>
        <Typography variant="h5" color="blue-gray" className="mb-2">
          {props.title}
        </Typography>
        <Typography>{props.text}</Typography>
      </CardBody>
      <CardFooter className="pt-0">
        <Button>{props.status}</Button>
      </CardFooter>
    </Card>
  );
}
function CardList(props) {
  const [projects, setProjects] = useState([]);
  const timerId = setInterval(() => {
    axios.get("http://localhost:1337/api/projects").then((res) => {
      setProjects(res.data);
    }, 100000);
  });
  
  return (
    <div>
      {projects.map((project) => {
        return (
          <Card1
            title={project.title}
            text={project.description}
            status={project.status}
          />
        );
      })}
      <Card1
        title="Card title"
        text="Some quick example text to build on the card title and make up the bulk of the card's content."
      />
    </div>
  );
}
export default CardList;
