import { useEffect, useState } from "react";
import {
  Camera,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
} from "lucide-react";

import api from "../services/api";
import Avatar from "../components/Avatar.jsx";
import { day, time } from "../utils/format";
import { useAuth } from "../context/AuthContext.jsx";

export default function CallsPage() {
  const { user } = useAuth();
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    api
      .get("/calls")
      .then(({ data }) => setCalls(data))
      .catch((err) => {
        console.error("Failed to load calls:", err);
      });
  }, []);

  return (
    <section className="panel-section calls-page">

      {/* ================= HEADER ================= */}
      <header className="calls-header">
        <div className="calls-header-left">
          <h2>Calls</h2>
          <span>Recent calls</span>
        </div>

        <button className="calls-new-btn" title="New call">
          <Phone size={19} />
        </button>
      </header>

      {/* ================= CALL LIST ================= */}
      <div className="calls-list">

        {calls.map((call) => {
          const other = call.participants?.find(
            (participant) => participant._id !== user?._id
          );

          const contact =
            other ||
            call.receiver ||
            call.caller;

          const outgoing =
            call.caller?._id === user?._id;

          const isMissed =
            call.status === "missed";

          const isVideo =
            call.type === "video";

          return (
            <article
              className={`call-item ${isMissed ? "missed-call" : ""
                }`}
              key={call._id}
            >

              {/* ================= AVATAR ================= */}
              <div className="call-avatar">
                <Avatar user={contact} />
              </div>

              {/* ================= INFO ================= */}
              <div className="call-info">

                <div className="call-name">
                  {contact?.name ||
                    contact?.phone ||
                    "Unknown"}
                </div>

                <div className="call-subinfo">

                  {/* Call direction */}
                  <span className="call-direction">

                    {isMissed ? (
                      <PhoneMissed
                        size={15}
                        strokeWidth={2.4}
                      />
                    ) : outgoing ? (
                      <PhoneOutgoing
                        size={15}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <PhoneIncoming
                        size={15}
                        strokeWidth={2.4}
                      />
                    )}

                  </span>

                  <span>
                    {day(call.createdAt)}
                  </span>

                  <span className="call-dot">
                    ·
                  </span>

                  <span>
                    {time(call.createdAt)}
                  </span>

                  {call.duration && (
                    <>
                      <span className="call-dot">
                        ·
                      </span>

                      <span>
                        {call.duration}s
                      </span>
                    </>
                  )}

                </div>
              </div>

              {/* ================= CALL ACTION ================= */}
              <button
                className={`call-action ${isVideo ? "video-call" : "voice-call"
                  }`}
                title={
                  isVideo
                    ? "Video call"
                    : "Voice call"
                }
              >
                {isVideo ? (
                  <Camera size={20} />
                ) : (
                  <Phone size={20} />
                )}
              </button>

            </article>
          );
        })}

        {/* ================= EMPTY STATE ================= */}
        {!calls.length && (
          <div className="calls-empty">

            <div className="calls-empty-circle">
              <Phone size={30} />
            </div>

            <h3>No calls yet</h3>

            <p>
              Your voice and video call history
              will appear here.
            </p>

            <button className="start-call-btn">
              <Phone size={17} />
              Start a call
            </button>

          </div>
        )}

      </div>
    </section>
  );
}