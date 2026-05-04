import React from "react";
import { Pie } from "react-chartjs-2";
import "chart.js/auto";
import "../css/project.css";

const PieChart = (props) => {
  const completed = Math.max(0, Number(props.completed) || 0);
  const late = Math.max(0, Number(props.late) || 0);
  const inProgress = Math.max(0, 100 - completed - late);

  const data = {
    labels: ["Completed", "Late", "In Progress"],
    datasets: [
      {
        label: "Tasks",
        data: [completed, late, inProgress],
        backgroundColor: ["rgba(34, 197, 94, 0.78)", "rgba(244, 63, 94, 0.78)", "rgba(251, 191, 36, 0.78)"],
        borderColor: ["#86efac", "#fda4af", "#fde68a"],
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          usePointStyle: true,
          pointStyle: "rectRounded",
          padding: 18,
          color: "#334155",
          font: {
            size: 12,
            weight: "600",
          },
        },
      },
      tooltip: {
        backgroundColor: "#111827",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "#f59e0b",
        borderWidth: 1,
      },
    },
    layout: {
      padding: 12,
    },
  };

  return (
    <div className="h-full w-full">
      <Pie data={data} options={options} />
    </div>
  );
};

export default PieChart;
