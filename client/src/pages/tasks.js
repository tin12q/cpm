import TaskTable from "../components/tasksTable";
import { Typography } from "@material-tailwind/react";

const Tasks = () => {
  return (
    <div className="mt-20 min-h-screen px-4 pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="max-w-2xl space-y-2">
          <Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
            Task ledger
          </Typography>
          <Typography variant="h2" color="blue-gray" className="sketch-heading">
            Tasks
          </Typography>
          <Typography color="gray" className="text-base leading-7">
            The page header now matches the same overview rhythm as dashboard and projects, while the table below handles the heavier detail work.
          </Typography>
        </div>
        <TaskTable />
      </div>
    </div>
  );
};

export default Tasks;
