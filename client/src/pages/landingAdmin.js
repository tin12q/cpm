import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Timeline } from '@material-tailwind/react';
import 'chart.js/auto';
const LandingPage = () => {
    const [data, setData] = React.useState({});


    if (!data) {
        return <div>Loading...</div>;
    }

    return (
        <div className='mt-20 pl-20 pr-20 w-screen justify-items-center overflow-auto'>
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