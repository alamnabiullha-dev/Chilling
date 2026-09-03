import { Link } from "react-router-dom";
import { Bell, Lock, LogOut, Moon, UserRound } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function SettingsPage() {
  const { toggleTheme, theme } = useTheme();
  const { logout } = useAuth();

  return (
    <section className="settings-list">
      <h2>Settings</h2>
      <Link to="/profile" className="settings-row"><UserRound /> Profile <span>Manage name, photo, and about</span></Link>
      <Link to="/settings/privacy" className="settings-row"><Lock /> Privacy <span>Last seen, photo, and read receipts</span></Link>
      <Link to="/settings/notifications" className="settings-row"><Bell /> Notifications <span>Message, call, and status alerts</span></Link>
      <button className="settings-row" onClick={toggleTheme}><Moon /> Theme <span>{theme === "dark" ? "Dark" : "Light"}</span></button>
      <button className="settings-row danger-text" onClick={logout}><LogOut /> Logout <span>End this session</span></button>
    </section>
  );
}
