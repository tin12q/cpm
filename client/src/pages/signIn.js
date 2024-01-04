import { Button, Card, CardBody, CardFooter, CardHeader, Checkbox, Input, Typography, } from "@material-tailwind/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import cookie from "cookie";


export default function SignIn() {

    const navigate = useNavigate();
    const cookies = cookie.parse(document.cookie);
    const ip = window.location.hostname;
    useEffect(() => {
        if (cookies.token) {
            navigate("/");
        }
    }, []);

    function handleSubmit(e) {
        e.preventDefault();
        const qs = require('qs');
        let data = qs.stringify({
            'username': e.target.email.value,
            'password': e.target.password.value
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: (!process.env.API_URI) ? `http://localhost:1337/api/auth/login` : process.env.API_URI + '/api/auth/login',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: data
        };
        axios.request(config).then((res) => {
            const jwt = res.headers.authorization.split(" ")[1];

            document.cookie = cookie.serialize("token", jwt, {
                maxAge: 60 * 60 * 24 * 7, // 1 week
                path: "/",
            });
            document.cookie = cookie.serialize("role", res.data.role, {
                maxAge: 60 * 60 * 24 * 7, // 1 week
                path: "/",
            });
            navigate("/");
        }).catch((err) => {
            alert(err);
            if (err.response.status === 401) {
                alert("Incorrect username or password");
            }
            if (err.response.status === 500) {
                alert("Server error");
            }
            if (err.response.status === 400) {
                alert("Bad request");
            }
            if (err.response.status === 404) {
                alert("User not found");
            }
        });
    }

    // END: abpxx6d04wxr
    if (cookies.token) return <div><h1>Loading...</h1></div>
    return (
        <div className="flex justify-evenly items-center  h-screen">
            <div className="flex justify-center items-center w-full max-w-md">
                <img
                    src="https://vanphongxanh.vn/wp-content/uploads/2022/03/logo-social.png"
                    alt="Logo"
                    className="w-100 h-100 mr-4"
                />

            </div>
            <Card className="flex max-w-md">
                <CardHeader
                    variant="gradient"
                    color="blue"
                    className="mb-4 grid h-28 place-items-center"
                >
                    <Typography variant="h3" color="white">
                        Sign In
                    </Typography>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardBody className="flex flex-col gap-4">
                        <Input label="Email" size="lg" name="email" />
                        <Input type="password" label="Password" size="lg" name="password" />
                        <div className="-ml-2.5">
                            <Checkbox label="Remember Me" />
                        </div>
                        <Button type="submit" variant="gradient" fullWidth>
                            Sign In
                        </Button>
                    </CardBody>
                </form>
                <CardFooter className="pt-0">
                    <Typography variant="small" className="mt-6 flex justify-center">
                        Don't have an account?
                        <Typography
                            as="a"
                            href="#signup"
                            variant="small"
                            color="blue"
                            className="ml-1 font-bold"
                        >
                            Sign up
                        </Typography>
                    </Typography>
                </CardFooter>
            </Card>
        </div>
    );
}
