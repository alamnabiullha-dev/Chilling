import { useState } from "react";
import {
  Save,
  ShieldCheck,
  Clock3,
  Camera,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function PrivacySettingsPage() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useToast();

  const [privacy, setPrivacy] = useState(
    user?.privacy || {
      lastSeen: "everyone",
      profilePhoto: "everyone",
      readReceipts: true,
    }
  );

  const updatePrivacy = (key, value) => {
    setPrivacy((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const save = async (event) => {
    event.preventDefault();

    try {
      await updateProfile({ privacy });
      showToast("Privacy settings saved");
    } catch (error) {
      showToast("Failed to save privacy settings", "error");
    }
  };

  return (
    <div className="privacy-page">
      {/* Header */}
      <div className="privacy-header">
        <div className="privacy-header-icon">
          <ShieldCheck size={23} />
        </div>

        <div>
          <h2>Privacy</h2>
          <p>
            Control who can see your information and activity.
          </p>
        </div>
      </div>

      {/* Main Card */}
      <form className="privacy-card" onSubmit={save}>
        {/* Privacy Options */}
        <div className="privacy-options">

          {/* Last Seen */}
          <div className="privacy-option">
            <div className="privacy-option-left">
              <div className="privacy-option-icon">
                <Clock3 size={19} />
              </div>

              <div className="privacy-option-content">
                <strong>Last seen</strong>
                <span>
                  Control who can see when you were last active.
                </span>
              </div>
            </div>

            <select
              value={privacy.lastSeen}
              onChange={(event) =>
                updatePrivacy("lastSeen", event.target.value)
              }
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">My contacts</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          {/* Profile Photo */}
          <div className="privacy-option">
            <div className="privacy-option-left">
              <div className="privacy-option-icon">
                <Camera size={19} />
              </div>

              <div className="privacy-option-content">
                <strong>Profile photo</strong>
                <span>
                  Choose who can see your profile picture.
                </span>
              </div>
            </div>

            <select
              value={privacy.profilePhoto}
              onChange={(event) =>
                updatePrivacy("profilePhoto", event.target.value)
              }
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">My contacts</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          {/* Read Receipts */}
          <div
            className={`privacy-option ${privacy.readReceipts ? "enabled" : ""
              }`}
          >
            <div className="privacy-option-left">
              <div className="privacy-option-icon">
                <CheckCheck size={19} />
              </div>

              <div className="privacy-option-content">
                <strong>Read receipts</strong>
                <span>
                  Let people know when you have read their messages.
                </span>
              </div>
            </div>

            {/* WhatsApp Toggle */}
            <button
              type="button"
              className={`privacy-switch ${privacy.readReceipts ? "active" : ""
                }`}
              onClick={() =>
                updatePrivacy(
                  "readReceipts",
                  !privacy.readReceipts
                )
              }
              aria-label="Toggle read receipts"
              aria-pressed={privacy.readReceipts}
            >
              <span className="privacy-switch-thumb">
                {privacy.readReceipts && <CheckCheck size={12} />}
              </span>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="privacy-info">
          <ShieldCheck size={16} />

          <p>
            Your privacy settings apply to your account across
            the application.
          </p>
        </div>

        {/* Save */}
        <div className="privacy-save-area">
          <button
            type="submit"
            className="privacy-save-button"
          >
            <Save size={17} />
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}