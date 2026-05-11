import { Button, Card, CardBody, CardFooter, CardHeader, Checkbox, Input, Typography } from "@material-tailwind/react";
import { Link } from "react-router-dom";

export default function SignUp() {
  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <section className="paper-card auth-hero overflow-hidden">
          <div className="space-y-3">
            <div className="auth-hero__marks">
              <span className="sketch-chip">Invite only</span>
              <span className="sketch-chip">Team workspace</span>
              <span className="sketch-chip">Simple onboarding</span>
            </div>
            <Typography variant="h2" className="sketch-title text-[clamp(2.25rem,4vw,4.25rem)] leading-none text-[var(--ink)]">
              Join the workspace.
            </Typography>
            <Typography className="sketch-subtitle max-w-2xl text-base md:text-lg">
              This screen is styled to match the rest of the notebook system and can be wired to a live registration flow later without redesigning the shell.
            </Typography>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="sketch-note p-4">
              <Typography variant="h6" className="sketch-title mb-2">
                Consistent shell
              </Typography>
              <Typography className="text-sm text-[var(--ink-soft)]">
                Cards, spacing, and typography match the sign-in flow for a calmer onboarding experience.
              </Typography>
            </div>
            <div className="sketch-note p-4">
              <Typography variant="h6" className="sketch-title mb-2">
                Human-friendly
              </Typography>
              <Typography className="text-sm text-[var(--ink-soft)]">
                The layout stays readable, with enough whitespace to feel organized instead of crowded.
              </Typography>
            </div>
          </div>
        </section>

        <Card className="paper-card auth-form border-0 shadow-none">
          <CardHeader floated={false} shadow={false} className="bg-transparent p-0">
            <div className="space-y-2">
              <Typography variant="h4" className="sketch-title text-[var(--ink)]">
                Sign Up
              </Typography>
              <Typography className="sketch-subtitle">
                Enter your details to register a new workspace identity.
              </Typography>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <form className="auth-form__stack">
              <div className="grid gap-4">
                <Input size="lg" label="Name" className="sketch-input" />
                <Input size="lg" label="Email" className="sketch-input" />
                <Input type="password" size="lg" label="Password" className="sketch-input" />
              </div>
              <Checkbox
                label={
                  <Typography variant="small" color="gray" className="flex items-center font-normal">
                    I agree to the <span className="mx-1 font-medium text-[var(--ink)]">Terms and Conditions</span>
                  </Typography>
                }
                containerProps={{ className: "-ml-2.5" }}
              />
            </form>
          </CardBody>
          <CardFooter className="auth-form__footer border-t border-dashed border-[rgba(72,65,108,0.2)] px-0 pb-0 pt-4">
            <Button fullWidth variant="filled" className="sketch-button bg-[var(--ink)] text-white hover:bg-[var(--ink)]">
              Register
            </Button>
            <Typography color="gray" className="text-center font-normal">
              Already have an account?{" "}
              <Link to="/signin" className="font-medium text-[var(--ink)] underline decoration-dashed underline-offset-4">
                Sign In
              </Link>
            </Typography>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
