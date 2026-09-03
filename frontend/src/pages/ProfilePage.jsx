import { useState } from "react";
import {
  LogOut,
  Save,
  UserRound,
  Camera,
  FileText,
} from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import api, { API_URL } from "../services/api";
import Avatar from "../components/Avatar.jsx";

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    name: user?.name || "",
    about: user?.about || "",
    profilePicture: user?.profilePicture || "",
  });

  const save = async (event) => {
    event.preventDefault();

    await updateProfile(form);

    showToast("Profile saved");
  };

  const uploadPhoto = async (file) => {
    const data = new FormData();

    data.append("file", file);

    const response = await api.post("/upload", data);

    setForm((value) => ({
      ...value,
      profilePicture: `${API_URL}${response.data.url}`,
    }));
  };

  return (
    <section className="profile-page">
      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="profile-page-header">
        <div className="profile-page-header-icon">
          <UserRound size={22} />
        </div>

        <div>
          <h2>Profile</h2>
          <p>
            Manage your profile information and photo.
          </p>
        </div>
      </div>

      {/* =====================================================
          PROFILE CONTENT
          ===================================================== */}

      <div className="profile-content">

        {/* ===================================================
            PROFILE PREVIEW
            =================================================== */}

        <div className="profile-card profile-preview-card">

          <div className="profile-cover">
            <div className="profile-avatar-container">

              <Avatar
                user={{ ...user, ...form }}
                size="xl"
              />

              <label
                className="profile-camera-button"
                title="Change profile photo"
              >
                <Camera size={16} />

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    event.target.files?.[0] &&
                    uploadPhoto(event.target.files[0])
                  }
                />
              </label>

            </div>
          </div>

          <div className="profile-preview-info">

            <h2>
              {form.name || user?.phone || "Your name"}
            </h2>

            <p className="profile-phone">
              {user?.phone || "Phone number"}
            </p>

            <div className="profile-about-box">
              <span>About</span>

              <p>
                {form.about || "Hey there! I am using this app."}
              </p>
            </div>

          </div>
        </div>

        {/* ===================================================
            PROFILE FORM
            =================================================== */}

        <form
          className="profile-card profile-form-card"
          onSubmit={save}
        >

          <div className="profile-form-header">
            <div>
              <h3>Edit profile</h3>

              <p>
                Update your personal information.
              </p>
            </div>
          </div>

          {/* Name */}

          <div className="profile-field">

            <div className="profile-field-icon">
              <UserRound size={18} />
            </div>

            <label>
              <span>Name</span>

              <input
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                placeholder="Enter your name"
              />
            </label>

          </div>

          {/* About */}

          <div className="profile-field profile-about-field">

            <div className="profile-field-icon">
              <FileText size={18} />
            </div>

            <label>
              <span>About</span>

              <textarea
                value={form.about}
                onChange={(event) =>
                  setForm({
                    ...form,
                    about: event.target.value,
                  })
                }
                placeholder="Tell something about yourself"
              />
            </label>

          </div>

          {/* Photo Upload */}

          <div className="profile-upload-box">

            <div className="profile-upload-icon">
              <Camera size={19} />
            </div>

            <div className="profile-upload-content">
              <strong>Profile photo</strong>

              <span>
                Choose a new photo from your device.
              </span>
            </div>

            <label className="profile-upload-button">
              Change

              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  event.target.files?.[0] &&
                  uploadPhoto(event.target.files[0])
                }
              />
            </label>

          </div>

          {/* Save */}

          <div className="profile-save-area">

            <button
              type="submit"
              className="profile-save-button"
            >
              <Save size={17} />
              Save profile
            </button>

          </div>

          {/* Logout */}

          <div className="profile-danger-area">

            <button
              type="button"
              className="profile-logout-button"
              onClick={logout}
            >
              <LogOut size={17} />
              Logout
            </button>

          </div>

        </form>
      </div>
    </section>
  );
}