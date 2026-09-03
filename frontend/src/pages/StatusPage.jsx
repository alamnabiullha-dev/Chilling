import { useEffect, useState } from "react";
import { Image, Send, Trash2, Video } from "lucide-react";
import api, { API_URL } from "../services/api";
import Avatar from "../components/Avatar.jsx";
import { day, time } from "../utils/format";
import { useAuth } from "../context/AuthContext.jsx";

export default function StatusPage() {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState([]);
  const [text, setText] = useState("");

  const load = () =>
    api.get("/status").then(({ data }) => setStatuses(data));

  useEffect(() => {
    load();
  }, []);

  const postText = async (event) => {
    event.preventDefault();

    if (!text.trim()) return;

    await api.post("/status", {
      type: "text",
      text,
    });

    setText("");
    load();
  };

  const upload = async (file) => {
    const form = new FormData();

    form.append("file", file);

    const { data } = await api.post("/upload", form);

    await api.post("/status", {
      type: file.type.startsWith("video/")
        ? "video"
        : "image",

      mediaUrl: `${API_URL}${data.url}`,
    });

    load();
  };

  const remove = async (status) => {
    await api.delete(`/status/${status._id}`);
    load();
  };

  return (
    <section className="status-page">

      {/* Header */}
      <div className="status-header">
        <div>
          <h2>Status</h2>
          <p>
            Share updates that disappear after 24 hours
          </p>
        </div>
      </div>

      {/* Create Status */}
      <form
        className="status-create"
        onSubmit={postText}
      >

        {/* My Status */}
        <div className="my-status-row">

          <div className="my-status-avatar">
            <Avatar user={user} />
            <span className="online-dot"></span>
          </div>

          <div className="my-status-info">
            <strong>My Status</strong>

            <span>
              Share a status update
            </span>
          </div>

        </div>

        {/* Text */}
        <label className="status-text-box">

          <textarea
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            placeholder="What's on your mind?"
          />

        </label>

        {/* Actions */}
        <div className="status-actions">

          {/* Image */}
          <label className="status-action image-action">

            <Image size={19} />

            <span>Photo</span>

            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) =>
                event.target.files?.[0] &&
                upload(event.target.files[0])
              }
            />

          </label>

          {/* Video */}
          <label className="status-action video-action">

            <Video size={19} />

            <span>Video</span>

            <input
              hidden
              type="file"
              accept="video/*"
              onChange={(event) =>
                event.target.files?.[0] &&
                upload(event.target.files[0])
              }
            />

          </label>

          {/* Post */}
          <button
            type="submit"
            className="status-post-btn"
          >
            <Send size={18} />
            <span>Post</span>
          </button>

        </div>

      </form>

      {/* Status Feed */}
      <div className="status-feed">

        <div className="status-section-title">
          <span>Recent updates</span>
        </div>

        {statuses.map((status) => (

          <article
            className="status-card"
            key={status._id}
          >

            {/* User Header */}
            <header className="status-card-header">

              <div className="status-avatar-ring">
                <Avatar user={status.user} />
              </div>

              <div className="status-user-info">

                <strong>
                  {status.user?.name ||
                    status.user?.phone}
                </strong>

                <small>
                  {day(status.createdAt)} ·{" "}
                  {time(status.createdAt)}
                </small>

              </div>

              {/* Delete */}
              {status.user?._id === user?._id && (

                <button
                  type="button"
                  className="status-delete"
                  onClick={() => remove(status)}
                  title="Delete status"
                >
                  <Trash2 size={17} />
                </button>

              )}

            </header>

            {/* Text Status */}
            {status.type === "text" && (

              <div className="text-status">
                <p>{status.text}</p>
              </div>

            )}

            {/* Image Status */}
            {status.type === "image" && (

              <div className="media-status">

                <img
                  src={status.mediaUrl}
                  alt="Status"
                />

              </div>

            )}

            {/* Video Status */}
            {status.type === "video" && (

              <div className="media-status">

                <video
                  src={status.mediaUrl}
                  controls
                />

              </div>

            )}

            {/* Footer */}
            <div className="status-footer">

              <span>
                {status.viewers?.length || 0} viewers
              </span>

              <span>
                Expires in 24h
              </span>

            </div>

          </article>

        ))}

        {/* Empty State */}
        {!statuses.length && (

          <div className="empty-status">

            <div className="empty-status-icon">
              <Image size={28} />
            </div>

            <h3>
              No status updates
            </h3>

            <p>
              Share a photo, video or text update
              with your contacts.
            </p>

          </div>

        )}

      </div>

    </section>
  );
}