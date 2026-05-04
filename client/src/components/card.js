import { Button, Card, CardBody, CardFooter, Typography } from "@material-tailwind/react";
import "../css/project.css";

function Card1({ title, text, status = "Open" }) {
  return (
    <Card className="sketch-note sketch-panel-hover w-full overflow-hidden">
      <CardBody className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Typography variant="h5" className="sketch-heading">
            {title}
          </Typography>
          <span className="sketch-chip text-xs">{status}</span>
        </div>
        <Typography className="sketch-subtitle text-sm">{text}</Typography>
      </CardBody>
      <CardFooter className="pt-0 px-5 pb-5">
        <Button className="sketch-button px-4 py-2 text-sm shadow-none" variant="text">
          {status}
        </Button>
      </CardFooter>
    </Card>
  );
}

function CardList({ items = [] }) {
  const cards = items.length
    ? items
    : [
        {
          title: "Sketch note",
          text: "A simple paper-like card for reusable content blocks.",
          status: "Draft",
        },
      ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((project, index) => (
        <Card1
          key={project._id || project.title || index}
          title={project.title}
          text={project.description || project.text}
          status={project.status}
        />
      ))}
    </div>
  );
}

export default CardList;
