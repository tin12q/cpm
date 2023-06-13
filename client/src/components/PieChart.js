import React, { useState } from "react";
import { Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import axios from "axios";
import cookie from "cookie";

const PieChart = (props) => {
    const completed = props.completed;
    const total = 100;
    const late = props.late;
    const data = {
        labels: ['Completed', 'Late', 'In Progress'],
        datasets: [
            {
                label: 'Tasks',
                data: [completed, late, 100 - completed - late],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(255, 205, 86, 0.2)',
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 205, 86, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
    };

    return (
        <React.Fragment>
            <Pie data={data} options={options} />
        </React.Fragment>
    )
}
export default PieChart;