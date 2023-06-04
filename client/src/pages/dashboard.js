import ProfileCard from "../components/profileCard";

const Dashboard = () => {
    return (
        <div className="grid grid-cols-2 gap-5 justify-items-center overflow-auto mt-20">
            <ProfileCard />
            <ProfileCard />
            <ProfileCard />
            <ProfileCard />
            <ProfileCard />
        </div>
    );
}

export default Dashboard;