"use client";
import {
  Card,
  Input,
  Button,
  Typography,
} from "@material-tailwind/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import cookie from "cookie";


export default function SignIn() {
  const navigate = useNavigate();
  const saltRounds = 10;
  //check if user is logged in
  //FIXME: Can't save token to cookie
  //FIXME: Missing authorization header
  useEffect(() => {
    const cookies = cookie.parse(document.cookie);
    if (cookies.token) {
      navigate("/");
    }
  }, [navigate]);


  //FIXME: cookies bug
  function handleSubmit(e) {
    e.preventDefault();
    console.log("submit");
    console.log(e.target.email.value);
    const qs = require('qs');
    let data = qs.stringify({
      'username': e.target.email.value,
      'password': e.target.password.value
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://localhost:1337/api/auth/login',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',

      },
      data: data
    };


    axios.request(config).then((res) => {
      console.log(res);
      //save jwt token from header to cookie
      console.log(res.headers.token);
      const jwt = res.headers.token.split(" ")[1];

      document.cookie = cookie.serialize("token", jwt, {
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
      });
      navigate("/");
    }).catch((err) => {
      console.log(err);
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

  return (
    <div className=" signin p-48 flex flex-col flex-grow flex-wrap items-end justify-center min-h-screen py-2">
      <Card color="transparent" shadow={false}>
        <Typography variant="h4" color="blue-gray">
          Sign In
        </Typography>
        <Typography color="gray" className="mt-1 font-normal">
          Enter your details to login.
        </Typography>
        <form
          className="mt-8 mb-2 w-80 max-w-screen-lg sm:w-96"
          onSubmit={handleSubmit}
        >
          <div className="mb-4 flex flex-col gap-6">
            <Input size="lg" label="Email" name="email" />
            <Input type="password" size="lg" label="Password" name="password" />
            <Button type="submit" className="mt-6" fullWidth>
              Login
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
