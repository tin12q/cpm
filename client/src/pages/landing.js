import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Timeline } from '@material-tailwind/react';

const data = {
    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
    datasets: [
        {
            label: 'Sales',
            data: [65, 59, 80, 81, 56, 55, 40],
            backgroundColor: 'rgba(75,192,192,0.4)',
            borderColor: 'rgba(75,192,192,1)',
            borderWidth: 1,
        },
    ],
};

const options = {
    scales: {
        yAxes: [
            {
                ticks: {
                    beginAtZero: true,
                },
            },
        ],
    },
};

const LandingPage = () => {
    const timelineItems = [
        {
            id: 1,
            content: 'First item',
            start: new Date(2022, 0, 1),
            end: new Date(2022, 0, 5),
        },
        {
            id: 2,
            content: 'Second item',
            start: new Date(2022, 0, 2),
            end: new Date(2022, 0, 6),
        },
        {
            id: 3,
            content: 'Third item',
            start: new Date(2022, 0, 3),
            end: new Date(2022, 0, 7),
        },
    ];

    const timelineOptions = {
        width: '100%',
        height: '200px',
    };

    return (
        <div>
            <h1>Landing Page</h1>
            <div>
                <Bar data={data} options={options} />
            </div>
            <div>
                <Timeline items={timelineItems} options={timelineOptions} />
            </div>
        </div>
    );
};

export default LandingPage;