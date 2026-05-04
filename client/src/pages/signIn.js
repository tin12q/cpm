import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Input,
  Typography,
} from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiBase from "../helpers/apiBase";
import axios from "axios";
import cookie from "cookie";

export default function SignIn() {
  const navigate = useNavigate();
  const cookies = cookie.parse(document.cookie);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (cookies.token) {
      navigate("/");
    }
  }, [cookies.token, navigate]);

  function handleSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    const username = e.target.email?.value?.trim() || "";
    const password = e.target.password?.value || "";

    axios
      .post(
        `${apiBase}/auth/login`,
        { username, password },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
      .then((res) => {
        const jwt = res.headers.authorization.split(" ")[1];

        document.cookie = cookie.serialize("token", jwt, {
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        });
        document.cookie = cookie.serialize("role", res.data.role, {
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        });
        navigate("/");
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          alert("Incorrect username or password");
        } else if (err.response?.status === 500) {
          alert("Server error");
        } else if (err.response?.status === 400) {
          alert("Bad request");
        } else if (err.response?.status === 404) {
          alert("User not found");
        } else {
          alert("Login failed");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  if (cookies.token) {
    return (
      <div className="auth-shell">
        <Typography variant="h4" className="sketch-title">
          Loading your notebook...
        </Typography>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <section className="paper-card auth-hero overflow-hidden">
          <div className="flex flex-col gap-5">
            <div className="auth-hero__marks">
              <span className="sketch-chip">Team planning</span>
              <span className="sketch-chip">Quick handoff</span>
              <span className="sketch-chip">Notebook UI</span>
            </div>
            <div className="space-y-3">
              <Typography variant="h2" className="sketch-title text-[clamp(2.25rem,4vw,4.25rem)] leading-none text-[var(--ink)]">
                A calmer project workspace.
              </Typography>
              <Typography className="sketch-subtitle max-w-2xl text-base md:text-lg">
                Organize tasks, teams, and schedules in a sketchbook-style dashboard that feels lighter than a traditional admin panel.
              </Typography>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="sketch-note p-4">
              <Typography variant="h6" className="sketch-title mb-2">
                Fast scan
              </Typography>
              <Typography className="text-sm text-[var(--ink-soft)]">
                Clear hierarchy, pastel cards, and quick visual anchors keep the interface easy to read.
              </Typography>
            </div>
            <div className="sketch-note p-4">
              <Typography variant="h6" className="sketch-title mb-2">
                Tactile motion
              </Typography>
              <Typography className="text-sm text-[var(--ink-soft)]">
                Hover states feel like paper shifting on a desk, not a glossy enterprise shell.
              </Typography>
            </div>
            <div className="sketch-note p-4">
              <Typography variant="h6" className="sketch-title mb-2">
                Mobile ready
              </Typography>
              <Typography className="text-sm text-[var(--ink-soft)]">
                The shell stays usable on narrow screens without losing structure or spacing.
              </Typography>
            </div>
          </div>
        </section>

        <Card className="paper-card auth-form border-0 shadow-none">
          <CardHeader floated={false} shadow={false} className="bg-transparent p-0">
            <div className="space-y-2">
              <Typography variant="h4" className="sketch-title text-[var(--ink)]">
                Sign In
              </Typography>
              <Typography className="sketch-subtitle">
                Use your workspace credentials to continue.
              </Typography>
            </div>
          </CardHeader>
          <form className="auth-form__stack" onSubmit={handleSubmit}>
            <CardBody className="p-0">
              <div className="auth-form__stack">
                <Input
                  label="Email"
                  size="lg"
                  name="email"
                  className="sketch-input"
                />
                <Input
                  type="password"
                  label="Password"
                  size="lg"
                  name="password"
                  className="sketch-input"
                />
                <div className="-ml-2.5">
                  <Checkbox label="Remember Me" />
                </div>
              </div>
            </CardBody>
            <CardFooter className="auth-form__footer border-t border-dashed border-[rgba(72,65,108,0.2)] px-0 pb-0 pt-4">
              <Button
                type="submit"
                variant="filled"
                fullWidth
                disabled={isLoading}
                className="sketch-button bg-[var(--ink)] text-white hover:bg-[var(--ink)]"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
              <Typography variant="small" className="text-center text-[var(--ink-soft)]">
                Keep the session open on this device if you are on a trusted machine.
              </Typography>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
