import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import AuthShell from "./pages/AuthShell.jsx";
import ChatsPage from "./pages/ChatsPage.jsx";
import CallsPage from "./pages/CallsPage.jsx";
import ContactsPage from "./pages/ContactsPage.jsx";
import StatusPage from "./pages/StatusPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import PrivacySettingsPage from "./pages/PrivacySettingsPage.jsx";
import NotificationSettingsPage from "./pages/NotificationSettingsPage.jsx";
import GroupPage from "./pages/GroupPage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function Protected({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="full-screen-loader">Loading Aurora...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthShell />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/chats" replace />} />
        <Route path="home" element={<ChatsPage />} />
        <Route path="chats" element={<ChatsPage />} />
        <Route path="chats/:conversationId" element={<ChatsPage />} />
        <Route path="groups/:conversationId" element={<GroupPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="status" element={<StatusPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/privacy" element={<PrivacySettingsPage />} />
        <Route path="settings/notifications" element={<NotificationSettingsPage />} />
      </Route>
    </Routes>
  );
}
