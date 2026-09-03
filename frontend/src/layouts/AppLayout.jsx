import { Link, NavLink, Outlet } from "react-router-dom";
import { Bell, MessageCircle, Moon, Phone, Search, Settings, Sparkles, Sun, UserRound, UsersRound } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/contacts", label: "Contacts", icon: UsersRound },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/status", label: "Status", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings }
];

export default function AppLayout() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <main className="app-shell">
      <aside className="rail">
        <Link className="brand" to="/chats" aria-label="Aurora home">
          <span className="brand-mark">A</span>
        </Link>
        <nav className="rail-nav" aria-label="Primary">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="rail-link" title={label}>
              <Icon size={21} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="rail-actions">
          <button className="icon-button" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link className="avatar-button" to="/profile" title="Profile">
            {user?.profilePicture ? <img src={user.profilePicture} alt="" /> : <UserRound size={19} />}
          </Link>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Aurora</p>
            <h1>Messages</h1>
          </div>
          <div className="topbar-search">
            <Search size={17} />
            <input placeholder="Search conversations or contacts" aria-label="Search" />
          </div>
          <Link className="icon-button" to="/settings/notifications" aria-label="Notifications">
            <Bell size={19} />
          </Link>
        </header>
        <Outlet />
      </section>
    </main>
  );
}
