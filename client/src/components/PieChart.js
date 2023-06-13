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
                    'rgba(25, 118, 210, 0.75)',
                    'rgba(198, 40, 28, 0.75)',
                    'rgba(251, 192, 45, 0.75)',
                ],
                borderColor: [
                    '#64b5f6',
                    '#ef5350',
                    '#ffee58',
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