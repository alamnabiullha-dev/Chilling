import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Search,
  Users,
  UserPlus,
  Plus,
} from "lucide-react";

import api from "../services/api";
import Avatar from "../components/Avatar.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function ContactsPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const search = async (event) => {
    event.preventDefault();

    if (!query.trim()) {
      setUsers([]);
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.get(
        `/contacts?q=${encodeURIComponent(query.trim())}`
      );

      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Could not search contacts",
        "error"
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (person) => {
    try {
      const { data } = await api.post("/conversations", {
        type: "private",
        participants: [person._id],
      });

      navigate(`/chats/${data._id}`);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Could not start chat",
        "error"
      );
    }
  };

  return (
    <section className="contacts-page">
      <div className="contacts-layout">

        {/* ================= CONTACTS ================= */}

        <div className="contacts-panel">

          {/* Header */}

          <header className="contacts-panel-header">
            <div className="contacts-title">
              <div className="contacts-title-icon">
                <Users size={20} />
              </div>

              <div>
                <h2>Contacts</h2>
                <p>Find people and start a conversation</p>
              </div>
            </div>
          </header>


          {/* Search */}

          <form
            className="contacts-search"
            onSubmit={search}
          >
            <Search size={18} />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search by name or phone"
              autoComplete="off"
            />

            <button
              type="submit"
              aria-label="Search contacts"
              disabled={loading}
            >
              <Search size={16} />
            </button>
          </form>


          {/* Results */}

          <div className="contact-results">

            {loading && (
              <div className="contacts-empty">
                <div className="contacts-empty-icon">
                  <Search size={28} />
                </div>

                <h3>Searching...</h3>

                <p>
                  Looking for matching contacts.
                </p>
              </div>
            )}


            {!loading &&
              users.map((person) => (
                <article
                  className="contact-row"
                  key={person._id}
                >

                  {/* Avatar */}

                  <div className="contact-avatar-wrap">
                    <Avatar user={person} />

                    <span
                      className="contact-online-dot"
                      title="Online"
                    />
                  </div>


                  {/* User info */}

                  <div className="contact-info">
                    <strong>
                      {person.name || person.phone}
                    </strong>

                    <small>
                      {person.about ||
                        person.phone ||
                        "Available on chat"}
                    </small>
                  </div>


                  {/* Start chat */}

                  <button
                    type="button"
                    className="contact-message-btn"
                    onClick={() => startChat(person)}
                    aria-label={`Message ${person.name || person.phone
                      }`}
                    title="Start chat"
                  >
                    <MessageCircle size={19} />
                  </button>

                </article>
              ))}


            {!loading && !users.length && (
              <div className="contacts-empty">

                <div className="contacts-empty-icon">
                  <UserPlus size={30} />
                </div>

                <h3>Find your contacts</h3>

                <p>
                  Search using a name or phone number
                  to find people and start a new chat.
                </p>

              </div>
            )}

          </div>
        </div>


        {/* ================= NEW GROUP ================= */}

        <GroupComposer />

      </div>
    </section>
  );
}


/* =========================================================
   GROUP COMPOSER
   ========================================================= */

function GroupComposer() {
  const [groupName, setGroupName] = useState("");
  const [participantIds, setParticipantIds] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const create = async (event) => {
    event.preventDefault();

    if (!groupName.trim()) {
      showToast("Please enter a group name", "error");
      return;
    }

    setLoading(true);

    try {
      const participants = participantIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      const { data } = await api.post("/groups", {
        groupName: groupName.trim(),
        participants,
      });

      navigate(`/groups/${data._id}`);
    } catch (error) {
      showToast(
        error.response?.data?.message ||
        "Could not create group",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className="group-panel"
      onSubmit={create}
    >

      {/* Header */}

      <div className="group-header">

        <div className="group-icon">
          <Users size={21} />
        </div>

        <div>
          <h2>New group</h2>

          <p>
            Create a group conversation
          </p>
        </div>

      </div>


      {/* Form */}

      <div className="group-form">

        <label>
          <span>Group name</span>

          <input
            value={groupName}
            onChange={(event) =>
              setGroupName(event.target.value)
            }
            placeholder="e.g. Project Team"
            required
          />
        </label>


        <label>
          <span>Member IDs</span>

          <textarea
            value={participantIds}
            onChange={(event) =>
              setParticipantIds(event.target.value)
            }
            placeholder="Enter user IDs separated by commas"
          />
        </label>


        <p className="group-hint">
          Add multiple user IDs separated by commas.
          You can also create the group with no additional
          members and add people later if your backend
          supports it.
        </p>


        <button
          type="submit"
          className="group-create-btn"
          disabled={loading}
        >
          {loading ? (
            "Creating..."
          ) : (
            <>
              <Plus size={17} />
              Create group
            </>
          )}
        </button>

      </div>

    </form>
  );
}