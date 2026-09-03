import { useEffect, useState } from "react";
import {
  Bell,
  MessageCircle,
  Phone,
  CircleDot,
  Check,
  Save,
  ChevronRight,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function NotificationSettingsPage() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useToast();

  const [prefs, setPrefs] = useState(
    user?.notificationPrefs || {
      messages: true,
      calls: true,
      status: true,
    }
  );

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api
      .get("/notifications")
      .then(({ data }) => setNotifications(data))
      .catch(() => {
        showToast("Failed to load notifications");
      });
  }, []);

  const save = async (event) => {
    event.preventDefault();

    try {
      await updateProfile({
        notificationPrefs: prefs,
      });

      showToast("Notification settings saved");
    } catch (error) {
      showToast("Failed to save notification settings");
    }
  };

  const togglePreference = (key) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);

      setNotifications((prev) =>
        prev.map((notification) =>
          notification._id === id
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (error) {
      showToast("Unable to mark notification as read");
    }
  };

  const settings = [
    {
      key: "messages",
      title: "Message notifications",
      description: "Get notified when you receive new messages",
      icon: MessageCircle,
    },
    {
      key: "calls",
      title: "Call notifications",
      description: "Get alerts for incoming calls",
      icon: Phone,
    },
    {
      key: "status",
      title: "Status notifications",
      description: "Get notified about status updates",
      icon: CircleDot,
    },
  ];

  return (
    <section className="notification-page">
      {/* Header */}
      <div className="notification-header">
        <div className="notification-header-icon">
          <Bell size={22} />
        </div>

        <div>
          <h2>Notifications</h2>
          <p>Manage your notification preferences</p>
        </div>
      </div>

      <div className="notification-grid">
        {/* Settings */}
        <form className="notification-card" onSubmit={save}>
          <div className="card-heading">
            <div>
              <h3>Notification preferences</h3>
              <p>Choose what you want to be notified about</p>
            </div>
          </div>

          <div className="notification-options">
            {settings.map((item) => {
              const Icon = item.icon;
              const enabled = prefs[item.key];

              return (
                <div
                  className={`notification-option ${enabled ? "enabled" : ""
                    }`}
                  key={item.key}
                >
                  <div className="notification-option-left">
                    <div className="notification-option-icon">
                      <Icon size={19} />
                    </div>

                    <div className="notification-option-content">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`switch ${enabled ? "active" : ""}`}
                    onClick={() => togglePreference(item.key)}
                    aria-label={`Toggle ${item.title}`}
                    aria-pressed={enabled}
                  >
                    <span className="switch-thumb">
                      {enabled && <Check size={11} />}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="notification-save-area">
            <button className="notification-save-button" type="submit">
              <Save size={17} />
              <span>Save changes</span>
            </button>
          </div>
        </form>

        {/* Recent alerts */}
        <div className="notification-card alerts-card">
          <div className="card-heading alerts-heading">
            <div>
              <h3>Recent alerts</h3>
              <p>Your latest notifications</p>
            </div>

            {notifications.filter((item) => !item.isRead).length > 0 && (
              <span className="unread-count">
                {notifications.filter((item) => !item.isRead).length}
              </span>
            )}
          </div>

          <div className="timeline-list">
            {notifications.map((notification) => (
              <article
                className={`timeline-row ${!notification.isRead ? "unread" : ""
                  }`}
                key={notification._id}
              >
                <div className="timeline-icon">
                  <Bell size={16} />
                </div>

                <div className="timeline-content">
                  <div className="timeline-title-row">
                    <strong>{notification.title}</strong>

                    {!notification.isRead && (
                      <span className="new-dot" />
                    )}
                  </div>

                  <small>{notification.message}</small>
                </div>

                {!notification.isRead && (
                  <button
                    type="button"
                    className="read-button"
                    onClick={() => markAsRead(notification._id)}
                    title="Mark as read"
                  >
                    <Check size={15} />
                  </button>
                )}
              </article>
            ))}

            {!notifications.length && (
              <div className="empty-notifications">
                <div className="empty-notification-icon">
                  <Bell size={25} />
                </div>

                <strong>No notifications yet</strong>
                <span>You're all caught up.</span>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="alerts-footer">
              <span>Recent notifications</span>
              <ChevronRight size={15} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}