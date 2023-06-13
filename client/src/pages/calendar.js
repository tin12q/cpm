import React, { useEffect, useState } from "react";
import { Scheduler } from '@aldabil/react-scheduler';
import axios from "axios";
import cookie from "cookie";
export default function CalendarPage() {
    const [events, setEvents] = useState(null);
    const cookies = cookie.parse(document.cookie);
    useEffect(() => {
        if (!cookies.token) {
            window.location.href = '/login';
        }
        axios.get(`http://localhost:1337/api/tasks/user`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
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
            .catch(err => { console.log(err); });
        console.log(events);

    }, []);
    if (!events) {
        return <div>Loading...</div>
    }
    return (<div className=" justify-items-center overflow-auto mt-20 ml-20 mr-20 ">
        <Scheduler
            view="month"
            events={events}
        />
    </div>)
}