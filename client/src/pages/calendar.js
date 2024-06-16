import React, { useEffect, useState } from "react";
import { Scheduler } from '@aldabil/react-scheduler';
import axios from "axios";
import cookie from "cookie";
import { Card, CardHeader, Typography } from "@material-tailwind/react";

export default function CalendarPage() {
    const [events, setEvents] = useState(null);
    const cookies = cookie.parse(document.cookie);
    useEffect(() => {

        axios.get((process.env.REACT_APP_API_URL ?? `http://localhost:1337/`) + `api/tasks/user`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                setEvents(res.data.map((event) => {
                    return {
                        event_id: event._id,
                        title: event.title,
                        start: new Date(event.due_date),
                        end: new Date(event.due_date),
                        editable: false,
                        color: ((event.status === "completed") && "green"),
                        deletable: false,
                    }
                }));
            })
            .catch(err => {
                alert(err);
            });

    }, []);
    if (!events) {
        return <div>Loading...</div>
    }
    return (<div className=" justify-items-center overflow-auto mt-20 ml-20 mr-20 ">
        <Card>
            <CardHeader floated={false} shadow={false} className="rounded-none">
                <div className="mb-8 flex items-center justify-between gap-8">
                    <div>
                        <Typography variant="h2" color="blue-gray">
                            Calendar
                        </Typography>
                    </div>
                </div>
            </CardHeader>
            <Scheduler
                view="month"
                events={events}
            //...
            />
        </Card>
    </div>)
}