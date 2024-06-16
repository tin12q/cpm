import React, { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Dialog, Switch, Typography, } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";

export default function TaskDone(props) {
    const id = props.id;
    const [open, setOpen] = useState(false);
    const [isDone, setDone] = useState(false);
    const [title, setTitle] = useState("");
    useEffect(() => {
        axios.get((process.env.REACT_APP_API_URL ?? `http://localhost:1337/`) + `api/tasks/${id}`, { headers: { Authorization: `Bearer ${cookie.parse(document.cookie).token}` } })
            .then(res => {
                setTitle(res.data.title);
            })
            .catch(err => {
                alert(err);
            });
    }, []);
    const handleOpen = () => {
        setOpen((cur) => !cur);
    };
    const handleSubmit = async e => {
        e.preventDefault();
        const cookies = cookie.parse(document.cookie);
        try {
            axios.post((process.env.REACT_APP_API_URL ?? `http://localhost:1337/`) + `api/tasks/done/${id}`,
                {
                    isDone
                }
                , { headers: { Authorization: `Bearer ${cookies.token}` } });
            window.location.reload();
        } catch (error) {
            alert(error.response.data.error);
        }
    }
    return (
        <React.Fragment>
            <Button className="flex items-center gap-3" color="red" size="sm" onClick={handleOpen}>
                Complete?
            </Button>
            <Dialog
                size="xs"
                open={open}
                handler={handleOpen}
                className="bg-transparent shadow-none"
            >
                <Card className="mx-auto w-full max-w-[24rem]">
                    <CardHeader
                        variant="gradient"
                        color="blue"
                        className="mb-4 grid h-28 place-items-center"
                    >
                        <Typography variant="h3" color="white">
                            {title} Completion
                        </Typography>
                    </CardHeader>
                    <CardBody className="">
                        <form className="flex flex-col justify-center items-center gap-4" onSubmit={handleSubmit}>
                            <Switch label='Done' color="blue" checked={isDone} onChange={() => setDone(!isDone)} />
                            <Button type="submit" variant="gradient" onClick={handleOpen} fullWidth>
                                Confirm
                            </Button>
                        </form>
                    </CardBody>
                </Card>
            </Dialog>
        </React.Fragment>
    );
}