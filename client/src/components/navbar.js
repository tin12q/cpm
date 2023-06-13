import React from "react";
import {
    Navbar,
    MobileNav,
    Typography,
    Button,
    Menu,
    MenuHandler,
    MenuList,
    MenuItem,
    Avatar,
    Card,
    IconButton,
} from "@material-tailwind/react";
import {
    CubeTransparentIcon,
    UserCircleIcon,
    CodeBracketSquareIcon,
    Square3Stack3DIcon,
    ChevronDownIcon,
    Cog6ToothIcon,
    InboxArrowDownIcon,
    LifebuoyIcon,
    PowerIcon,
    RocketLaunchIcon,
    Bars2Icon,
    BriefcaseIcon,
    UserGroupIcon
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import cookie from "cookie";
import "../css/navbar.css";
import Project from "../pages/project";
import { CalendarDaysIcon } from "@heroicons/react/24/solid";
// profile menu component

const profileMenuItems = [
    {
        label: "My Profile",
        icon: UserCircleIcon,
    },
    {
        label: "Edit Profile",
        icon: Cog6ToothIcon,
    },
    {
        label: "Inbox",
        icon: InboxArrowDownIcon,
    },
    {
        label: "Help",
        icon: LifebuoyIcon,
    }
];

function ProfileMenu() {
    const navigate = useNavigate();
    const handleLogout = () => {
        document.cookie.split(";").forEach(function (c) { document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); });
        navigate("/signin");
    };
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const closeMenu = () => setIsMenuOpen(false);

    return (
        <Menu open={isMenuOpen} handler={setIsMenuOpen} placement="bottom-end">
            <MenuHandler>
                <Button
                    variant="text"
                    color="blue-gray"
                    className="flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 lg:ml-auto"
                >
                    <Avatar
                        variant="circular"
                        size="sm"
                        alt="candice wu"
                        className="border border-blue-500 p-0.5"
                        src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1480&q=80"
                    />
                    <ChevronDownIcon
                        strokeWidth={2.5}
                        className={`h-3 w-3 transition-transform ${isMenuOpen ? "rotate-180" : ""
                            }`}
                    />
                </Button>
            </MenuHandler>
            <MenuList className="p-1">
                {profileMenuItems.map(({ label, icon }, key) => {
                    const isLastItem = key === profileMenuItems.length - 1;
                    return (
                        <MenuItem
                            key={label}
                            onClick={closeMenu}
                            className={`flex items-center gap-2 rounded `}
                        >
                            {React.createElement(icon, {
                                className: `h-4 w-4 `,
                                strokeWidth: 2,
                            })}
                            <Typography
                                as="span"
                                variant="small"
                                className="font-normal"
                                color="inherit"
                            >
                                {label}
                            </Typography>
                        </MenuItem>
                    );
                })}
                <MenuItem key='Sign Out'
                    onClick={handleLogout}
                    className={`flex items-center gap-2 rounded 
                                hover:bg-red-500/10 focus:bg-red-500/10 active:bg-red-500/10
                                }`}>
                    {React.createElement(PowerIcon, {
                        className: `h-4 w-4 text-red-500`,
                        strokeWidth: 2,
                    })}
                    <Typography
                        as="span"
                        variant="small"
                        className="font-normal"
                        color="red"
                    >
                        Sign Out
                    </Typography>
                </MenuItem>
            </MenuList>
        </Menu>
    );
}


// nav list component
const navListItems = [
    {
        label: "Projects",
        icon: BriefcaseIcon,
        path: '/projects'

    },
    {
        label: "Tasks",
        icon: CubeTransparentIcon,
        path: '/tasks'
    },
    {
        label: "Calendar",
        icon: CalendarDaysIcon,
        path: '/calendar'
    },
    {
        label: "Employees",
        icon: UserGroupIcon,
        path: '/employees'

    }
];

function NavList() {
    return (
        <ul className="mb-4 mt-2 flex flex-col gap-2 lg:mb-0 lg:mt-0 lg:flex-row lg:items-center">

            {navListItems.map(({ label, icon, path }, key) => (
                <Link to={path}>
                    <Typography
                        key={label}
                        as="a"
                        href="#"
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                    >
                        <MenuItem className="flex items-center gap-2 lg:rounded-full">
                            {React.createElement(icon, { className: "h-[18px] w-[18px]" })}{" "}
                            {label}
                        </MenuItem>
                    </Typography>
                </Link>
            ))}
        </ul>
    );
}

export default function ComplexNavbar() {
    const navigate = useNavigate();
    const cookies = cookie.parse(document.cookie);
    const [isNavOpen, setIsNavOpen] = React.useState(false);
    const toggleIsNavOpen = () => setIsNavOpen((cur) => !cur);

    React.useEffect(() => {
        window.addEventListener(
            "resize",
            () => window.innerWidth >= 960 && setIsNavOpen(false)
        );
        if (!cookies.token) {
            navigate('/signin')
        }
    }, []);

    return (
        <Navbar className="Navbar mx-auto max-w-screen-xl p-2 lg:rounded-full lg:pl-6">
            <div className="relative mx-auto flex items-center text-blue-gray-900">
                <Link to="/">
                    <Typography
                        as="a"
                        href="#"
                        className="mr-4 ml-2 cursor-pointer py-1.5 font-medium"
                    >
                        CPM Dashboard
                    </Typography></Link>
                <div className="absolute top-2/4 left-2/4 hidden -translate-x-2/4 -translate-y-2/4 lg:block">
                    <NavList />
                </div>
                <IconButton
                    size="sm"
                    color="blue-gray"
                    variant="text"
                    onClick={toggleIsNavOpen}
                    className="ml-auto mr-2 lg:hidden"
                >
                    <Bars2Icon className="h-6 w-6" />
                </IconButton>
                <ProfileMenu />
            </div>
            <MobileNav open={isNavOpen} className="overflow-scroll">
                <NavList />
            </MobileNav>
        </Navbar>
    );
}