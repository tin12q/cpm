"use client";
import { Buffer } from "buffer";

import {
  Card,
  Input,
  Checkbox,
  Button,
  Typography,
} from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";

export default function SignIn() {
  //FIXME: cookies bug
  function handleSubmit(e) {
    e.preventDefault();
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "http://localhost:1337/api/user/signin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: {
        email: e.target.email.value,
        password: e.target.password.value,
      },
    };
    console.log("submit");
    console.log(e.target.email.value);
    console.log(e.target.password.value);
    //FIXME: cookies bug here
    /*if (document.cookie) {
      const cookies = cookie.parse(document.cookie);
      console.log(cookies);
      const token = cookies.jwt;
      const decoded = jwt.verify(token, "secret");
      console.log(decoded);
    }*/
    //END
    //else {
    axios
      .request(config)
      .then((res) => {
        console.log(res);
        const token = res.headers["Set-Cookie"];
        document.cookie = `jwt=${token}; path=/; secure; SameSite=Strict`;
        console.log(token);
      })
      .catch(function (error) {
        console.log(error);
      });
    //}
  }
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
