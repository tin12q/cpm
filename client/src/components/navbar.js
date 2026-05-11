import React from "react";
import {
  Avatar,
  Button,
  IconButton,
  Menu,
  MenuHandler,
  MenuItem,
  MenuList,
  MobileNav,
  Navbar,
  Typography,
} from "@material-tailwind/react";
import {
  Bars2Icon,
  BriefcaseIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  CubeTransparentIcon,
  InboxArrowDownIcon,
  LifebuoyIcon,
  PowerIcon,
  UserCircleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import cookie from "cookie";
import { CalendarDaysIcon } from "@heroicons/react/24/solid";

const profileMenuItems = [
  { label: "My Profile", icon: UserCircleIcon },
  { label: "Edit Profile", icon: Cog6ToothIcon },
  { label: "Inbox", icon: InboxArrowDownIcon },
  { label: "Stage Templates", icon: CubeTransparentIcon, path: "/stage-templates" },
  { label: "Contacts", icon: UserGroupIcon, path: "/contacts" },
  { label: "Help", icon: LifebuoyIcon },
];

const navListItems = [
  { label: "Projects", icon: BriefcaseIcon, path: "/projects" },
  { label: "Tasks", icon: CubeTransparentIcon, path: "/tasks" },
  { label: "Calendar", icon: CalendarDaysIcon, path: "/calendar" },
  { label: "Employees", icon: UserGroupIcon, path: "/employees" },
  { label: "Skills", icon: Cog6ToothIcon, path: "/skills" },
];

function ProfileMenu() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const closeMenu = () => setIsMenuOpen(false);
  const handleLogout = () => {
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });
    navigate("/signin");
  };

  return (
    <Menu open={isMenuOpen} handler={setIsMenuOpen} placement="bottom-end">
      <MenuHandler>
        <Button variant="text" color="blue-gray" className="ui-button ui-button--ghost flex items-center gap-2 rounded-full px-2 py-1.5 shadow-none">
          <Avatar
            variant="circular"
            size="sm"
            alt="profile"
            className="border border-slate-300 p-0.5"
            src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1480&q=80"
          />
          <div className="hidden text-left sm:block">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">Workspace</div>
            <div className="text-sm font-semibold text-slate-800">Profile menu</div>
          </div>
          <ChevronDownIcon strokeWidth={2.5} className={`h-3 w-3 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
        </Button>
      </MenuHandler>
      <MenuList className="nav-menu paper-card border-0 bg-[rgba(255,253,248,0.98)] p-2 shadow-[8px_8px_0_rgba(17,24,39,0.12)]">
        {profileMenuItems.map(({ label, icon, path }) => (
          <MenuItem
            key={label}
            onClick={() => {
              closeMenu();
              if (path) navigate(path);
            }}
            className="nav-menu__item mb-1 flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 hover:border-slate-200 hover:bg-white/80"
          >
            {React.createElement(icon, { className: "h-4 w-4", strokeWidth: 2 })}
            <Typography as="span" variant="small" className="font-medium" color="inherit">
              {label}
            </Typography>
          </MenuItem>
        ))}
        <MenuItem
          key="Sign Out"
          onClick={handleLogout}
          className="nav-menu__item flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 hover:bg-rose-100"
        >
          {React.createElement(PowerIcon, { className: "h-4 w-4 text-rose-600", strokeWidth: 2 })}
          <Typography as="span" variant="small" className="font-semibold" color="red">
            Sign Out
          </Typography>
        </MenuItem>
      </MenuList>
    </Menu>
  );
}

function NavList({ mobile = false, onNavigate }) {
  const location = useLocation();

  return (
    <ul className={`nav-links ${mobile ? "nav-links--mobile" : "nav-links--desktop"}`}>
      {navListItems.map(({ label, icon, path }) => {
        const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);

        return (
          <li key={label}>
            <NavLink to={path} onClick={onNavigate} className={`nav-link sketch-link ${isActive ? "sketch-link--active" : ""}`}>
              {React.createElement(icon, { className: "nav-link__icon h-[18px] w-[18px]" })}
              <span className="nav-link__label">{label}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

export default function ComplexNavbar() {
  const navigate = useNavigate();
  const cookies = cookie.parse(document.cookie);
  const [isNavOpen, setIsNavOpen] = React.useState(false);

  React.useEffect(() => {
    const onResize = () => window.innerWidth >= 900 && setIsNavOpen(false);
    window.addEventListener("resize", onResize);

    if (!cookies.token) {
      navigate("/signin");
    }

    return () => window.removeEventListener("resize", onResize);
  }, [cookies.token, navigate]);

  return (
    <div className="nav-shell">
      <Navbar className="paper-card nav-shell__inner rounded-[24px] border-0 bg-[rgba(255,253,248,0.9)] px-0 shadow-none">
        <div className="flex w-full flex-col gap-3">
          <div className="nav-row">
            <NavLink to="/" className="nav-brand">
              <span className="nav-brand__mark sketch-title">CPM</span>
              <span className="nav-brand__text">
                <span className="nav-brand__eyebrow">Project notebook</span>
                <span className="nav-brand__title">CPM Dashboard</span>
              </span>
            </NavLink>

            <div className="nav-center">
              <div className="nav-actions__desktop">
                <NavList />
              </div>
            </div>

            <div className="nav-actions">
              <span className="ui-badge ui-badge--draft hidden xl:inline-flex">Sketch UI</span>
              <ProfileMenu />
              <IconButton size="sm" color="blue-gray" variant="text" onClick={() => setIsNavOpen((cur) => !cur)} className="nav-toggle ui-button ui-button--ghost">
                <Bars2Icon className="h-6 w-6" />
              </IconButton>
            </div>
          </div>

          {isNavOpen && (
            <MobileNav open={isNavOpen} className="overflow-hidden lg:hidden">
              <div className="sketch-divider mt-2 pt-3">
                <NavList mobile onNavigate={() => setIsNavOpen(false)} />
              </div>
            </MobileNav>
          )}
        </div>
      </Navbar>
    </div>
  );
}
