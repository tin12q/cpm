import React, { useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import axios from 'axios';
import cookie from 'cookie';
import { CardBody, Typography, Card, CardHeader } from '@material-tailwind/react';

const DashboardAdmin = () => {

    const options = {
        scales: {
            x: {
                stacked: true,
            },
            y: {
                stacked: true,
            },
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
            },
        },
        layout: {
            padding: {
                left: 20,
                right: 20,
                top: 0,
                bottom: 0,
            },
        },
        barThickness: 20,
    };
    const [data, setData] = React.useState(null);

    useEffect(() => {
        axios.get(`http://localhost:1337/api/tasks/team`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {

                setData({
                    labels: res.data.map((item) => item.team),
                    datasets: [
                        {
                            label: 'completed',
                            data: res.data.map((item) => item.completed),
                            backgroundColor: 'rgba(255, 206, 86, 0.2)',
                            borderColor: 'rgba(255, 206, 86, 1)',
                            borderWidth: 1,
                        },
                        {
                            label: 'in progress',
                            data: res.data.map((item) => item.in_progress),
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1,
                        },
                        {
                            label: 'late',
                            data: res.data.map((item) => item.late),
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1,
                        },
                    ],
                });
            })
            .catch(err => {
                alert(err);
            });

    }, []);

    if (!data) {
        return <div>Loading...</div>;
    }


    return (
        <div className='mt-20 pl-20 pr-20 w-screen justify-items-center overflow-auto'>
            <CardHeader floated={false} shadow={false} className="rounded-none">
                <div className="mb-8 flex items-center justify-between gap-8">
                    <div>
                        <Typography variant="h2" color="blue-gray">
                            Dashboard
                        </Typography>
                        <Typography color="gray" className="mt-1 font-normal">
                            See information about all project
                        </Typography>
                    </div>
                </div>
            </CardHeader>
            <div className='flex flex-row justify-evenly'>
                <div className='w-8/12 flex flex-col text-center mb-4'>
                    <Card>
                        <CardBody>
                            <Bar data={data} options={options} />
                            <Typography color="gray" variant='h4'>Tasks by team</Typography>
                        </CardBody>
                    </Card>
                </div>
                <div className='w-3/12'>
                    <Card>
                        <CardBody>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DashboardAdmin;