import { Card, CardBody, CardFooter, CardHeader, Tooltip, Typography } from "@material-tailwind/react";

const shell =
	"overflow-hidden rounded-[32px] border border-slate-300/80 bg-[#fbf7ef] shadow-[12px_12px_0_rgba(17,24,39,0.12)]";

export default function ProfileCard() {
	return (
		<Card className={shell}>
			<CardHeader floated={false} className="m-0 h-72 rounded-none border-b border-dashed border-slate-300 bg-[linear-gradient(135deg,#f4e6c2_0%,#fdfaf5_100%)] p-0">
				<div className="flex h-full items-end justify-between bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0.88))] p-6">
					<div>
						<Typography variant="small" className="tracking-[0.2em] text-slate-500 uppercase">
							Profile sketch
						</Typography>
						<Typography variant="h4" color="blue-gray" className="mt-2">
							Natalie Paisley
						</Typography>
					</div>
					<span className="rounded-full border border-slate-300 bg-white/90 px-3 py-1 text-xs text-slate-700 shadow-[4px_4px_0_rgba(17,24,39,0.06)]">
						CEO / Co-Founder
					</span>
				</div>
			</CardHeader>
			<CardBody className="space-y-3 p-6 text-center">
				<Typography color="gray">A warm, hand-drawn profile tile for people-focused dashboards.</Typography>
			</CardBody>
			<CardFooter className="flex justify-center gap-5 border-t border-dashed border-slate-300/80 bg-white/50 px-6 py-4">
				<Tooltip content="Like">
					<Typography as="a" href="#facebook" variant="lead" color="blue" textGradient>
						<i className="fab fa-facebook" />
					</Typography>
				</Tooltip>
				<Tooltip content="Follow">
					<Typography as="a" href="#twitter" variant="lead" color="light-blue" textGradient>
						<i className="fab fa-twitter" />
					</Typography>
				</Tooltip>
				<Tooltip content="Follow">
					<Typography as="a" href="#instagram" variant="lead" color="purple" textGradient>
						<i className="fab fa-instagram" />
					</Typography>
				</Tooltip>
			</CardFooter>
		</Card>
	);
}
