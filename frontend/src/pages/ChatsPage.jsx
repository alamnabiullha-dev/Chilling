
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Camera,
  MapPin,
  Mic,
  Paperclip,
  Phone,
  Send,
  Smile,
  UsersRound,
  X,
} from "lucide-react";

import api, { API_URL } from "../services/api";
import { getSocket } from "../socket/client";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";
import { useCallManager } from "../webrtc/useCallManager.js";

import Avatar from "../components/Avatar.jsx";
import MessageBubble from "../components/MessageBubble.jsx";
import CallOverlay from "../components/CallOverlay.jsx";
import { day, time } from "../utils/format.js";

const emojis = ["👍", "❤️", "😂", "🔥", "🙏", "🎉"];

/*
|--------------------------------------------------------------------------
| Resolve media/profile image URL
|--------------------------------------------------------------------------
| Backend may return:
|   /api/upload/media/xxx.jpg
|   http://localhost:5002/api/upload/media/xxx.jpg
|   http://10.15.141.0:5002/api/upload/media/xxx.jpg
|
| But frontend is now HTTPS.
| So we always convert old localhost/http URLs to current API_URL.
|--------------------------------------------------------------------------
*/

function resolveMediaUrl(url) {
  if (!url) return "";

  const value = String(url).trim();

  if (!value) return "";

  // Relative URL
  if (value.startsWith("/")) {
    return `${API_URL}${value}`;
  }

  try {
    const parsed = new URL(value);

    // Old HTTP localhost URL
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "10.15.141.0"
    ) {
      return `${API_URL}${parsed.pathname}${parsed.search}`;
    }

    return value;
  } catch {
    return value;
  }
}

/*
|--------------------------------------------------------------------------
| Make sure Avatar receives a correct profilePicture URL
|--------------------------------------------------------------------------
*/

function normalizeUser(user) {
  if (!user) return user;

  return {
    ...user,
    profilePicture: resolveMediaUrl(user.profilePicture),
  };
}

function mediaType(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";

  return "document";
}

export default function ChatsPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [typing, setTyping] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const fileInput = useRef(null);
  const typingTimer = useRef(null);

  const recorder = useVoiceRecorder();
  const callManager = useCallManager(user);

  /*
  |--------------------------------------------------------------------------
  | Active conversation
  |--------------------------------------------------------------------------
  */

  const activeConversation = useMemo(() => {
    return conversations.find(
      (conversation) =>
        String(conversation._id) === String(conversationId)
    );
  }, [conversations, conversationId]);

  /*
  |--------------------------------------------------------------------------
  | Peer user
  |--------------------------------------------------------------------------
  */

  const peer = useMemo(() => {
    if (!activeConversation || activeConversation.type === "group") {
      return null;
    }

    const found = activeConversation.participants?.find(
      (participant) =>
        String(participant._id) !== String(user?._id)
    );

    return normalizeUser(found);
  }, [activeConversation, user?._id]);

  /*
  |--------------------------------------------------------------------------
  | Load conversations
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    api
      .get("/conversations")
      .then(({ data }) => {
        if (!mounted) return;

        setConversations(Array.isArray(data) ? data : []);

        if (!conversationId && data?.[0]) {
          navigate(`/chats/${data[0]._id}`, {
            replace: true,
          });
        }
      })
      .catch((error) => {
        console.error(
          "Failed to load conversations:",
          error
        );

        showToast(
          error.response?.data?.message ||
          "Failed to load conversations",
          "error"
        );
      });

    return () => {
      mounted = false;
    };
  }, [conversationId, navigate, showToast]);

  /*
  |--------------------------------------------------------------------------
  | Socket listeners
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const socket = getSocket();

    if (!socket) return;

    const onConversation = (conversation) => {
      setConversations((items) => [
        conversation,
        ...items.filter(
          (item) => item._id !== conversation._id
        ),
      ]);
    };

    const onMessage = (message) => {
      setMessages((items) => {
        const exists = items.some(
          (item) =>
            String(item._id) === String(message._id)
        );

        if (exists) {
          return items;
        }

        return [...items, message];
      });

      setConversations((items) =>
        items.map((conversation) =>
          String(conversation._id) ===
            String(message.conversationId)
            ? {
              ...conversation,
              lastMessage: message,
              updatedAt: message.createdAt,
            }
            : conversation
        )
      );
    };

    const onEdit = (message) => {
      setMessages((items) =>
        items.map((item) =>
          String(item._id) === String(message._id)
            ? message
            : item
        )
      );
    };

    const onDelete = onEdit;
    const onReaction = onEdit;

    const onTyping = ({
      conversationId: id,
      user: typingUser,
    }) => {
      if (String(id) === String(conversationId)) {
        setTyping(typingUser);
      }
    };

    const offTyping = ({
      conversationId: id,
    }) => {
      if (String(id) === String(conversationId)) {
        setTyping(null);
      }
    };

    socket.on(
      "conversation:new",
      onConversation
    );

    socket.on(
      "message:new",
      onMessage
    );

    socket.on(
      "message:edit",
      onEdit
    );

    socket.on(
      "message:delete",
      onDelete
    );

    socket.on(
      "message:reaction",
      onReaction
    );

    socket.on(
      "typing:start",
      onTyping
    );

    socket.on(
      "typing:stop",
      offTyping
    );

    return () => {
      socket.off(
        "conversation:new",
        onConversation
      );

      socket.off(
        "message:new",
        onMessage
      );

      socket.off(
        "message:edit",
        onEdit
      );

      socket.off(
        "message:delete",
        onDelete
      );

      socket.off(
        "message:reaction",
        onReaction
      );

      socket.off(
        "typing:start",
        onTyping
      );

      socket.off(
        "typing:stop",
        offTyping
      );
    };
  }, [conversationId]);

  /*
  |--------------------------------------------------------------------------
  | Join conversation
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const socket = getSocket();

    if (!conversationId || !socket) {
      return;
    }

    socket.emit("conversation:join", {
      conversationId,
    });

    api
      .get(`/messages/${conversationId}`)
      .then(({ data }) => {
        setMessages(
          Array.isArray(data) ? data : []
        );
      })
      .catch((error) => {
        console.error(
          "Failed to load messages:",
          error
        );
      });

    api
      .put(`/messages/${conversationId}/read`)
      .catch((error) => {
        console.error(
          "Failed to mark messages as read:",
          error
        );
      });

    return () => {
      socket.emit("conversation:leave", {
        conversationId,
      });
    };
  }, [conversationId]);

  /*
  |--------------------------------------------------------------------------
  | Send payload
  |--------------------------------------------------------------------------
  */

  const sendPayload = async (payload) => {
    if (!conversationId) return;

    const socket = getSocket();

    if (!socket) {
      showToast(
        "Socket connection is not available",
        "error"
      );

      return;
    }

    socket.emit(
      "message:send",
      {
        ...payload,
        conversationId,
      },
      (ack) => {
        if (!ack?.ok) {
          showToast(
            ack?.message ||
            "Could not send message",
            "error"
          );

          return;
        }

        setDraft("");
        setReplyTo(null);
      }
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Send text
  |--------------------------------------------------------------------------
  */

  const sendText = (event) => {
    event.preventDefault();

    const text = draft.trim();

    if (!text || !conversationId) {
      return;
    }

    sendPayload({
      messageType: "text",
      text,
      replyTo: replyTo?._id,
    });

    getSocket()?.emit(
      "typing:stop",
      {
        conversationId,
      }
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Upload and send
  |--------------------------------------------------------------------------
  */

  const uploadAndSend = async (
    file,
    forcedType = null
  ) => {
    if (!file) return;

    try {
      const form = new FormData();

      form.append("file", file);

      const { data } = await api.post(
        "/upload",
        form
      );

      const mediaUrl = resolveMediaUrl(
        data.url
      );

      await sendPayload({
        messageType:
          forcedType || mediaType(file),

        mediaUrl,

        fileName: data.fileName,

        fileSize: data.fileSize,
      });
    } catch (error) {
      console.error(
        "Upload failed:",
        error
      );

      showToast(
        error.response?.data?.message ||
        "File upload failed",
        "error"
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Typing
  |--------------------------------------------------------------------------
  */

  const handleTyping = (value) => {
    setDraft(value);

    const socket = getSocket();

    if (!socket || !conversationId) {
      return;
    }

    socket.emit(
      "typing:start",
      {
        conversationId,
      }
    );

    clearTimeout(
      typingTimer.current
    );

    typingTimer.current =
      setTimeout(() => {
        socket.emit(
          "typing:stop",
          {
            conversationId,
          }
        );
      }, 900);
  };

  /*
  |--------------------------------------------------------------------------
  | Edit
  |--------------------------------------------------------------------------
  */

  const editMessage = async (message) => {
    const text = window.prompt(
      "Edit message",
      message.text || ""
    );

    if (!text?.trim()) {
      return;
    }

    try {
      const { data } = await api.put(
        `/messages/${message._id}`,
        {
          text: text.trim(),
        }
      );

      setMessages((items) =>
        items.map((item) =>
          String(item._id) ===
            String(data._id)
            ? data
            : item
        )
      );
    } catch (error) {
      console.error(
        "Edit message failed:",
        error
      );

      showToast(
        error.response?.data?.message ||
        "Could not edit message",
        "error"
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Delete
  |--------------------------------------------------------------------------
  */

  const deleteMessage = async (message) => {
    try {
      const { data } = await api.delete(
        `/messages/${message._id}`,
        {
          data: {
            everyone: true,
          },
        }
      );

      setMessages((items) =>
        items.map((item) =>
          String(item._id) ===
            String(data._id)
            ? data
            : item
        )
      );
    } catch (error) {
      console.error(
        "Delete message failed:",
        error
      );

      showToast(
        error.response?.data?.message ||
        "Could not delete message",
        "error"
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Reaction
  |--------------------------------------------------------------------------
  */

  const react = async (
    message,
    emoji
  ) => {
    try {
      const { data } = await api.post(
        `/messages/${message._id}/reaction`,
        {
          emoji,
        }
      );

      setMessages((items) =>
        items.map((item) =>
          String(item._id) ===
            String(data._id)
            ? data
            : item
        )
      );
    } catch (error) {
      console.error(
        "Reaction failed:",
        error
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Location
  |--------------------------------------------------------------------------
  */

  const sendLocation = () => {
    if (!navigator.geolocation) {
      showToast(
        "Geolocation is not supported",
        "error"
      );

      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        sendPayload({
          messageType: "location",

          location: {
            lat: coords.latitude,
            lng: coords.longitude,
            label: "Shared location",
          },
        });
      },
      (error) => {
        console.error(
          "Location error:",
          error
        );

        showToast(
          "Location permission was not granted",
          "error"
        );
      }
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Voice
  |--------------------------------------------------------------------------
  */

  const finishVoice = async () => {
    try {
      const blob = await recorder.stop();

      if (!blob) {
        return;
      }

      const file = new File(
        [blob],
        `voice-${Date.now()}.webm`,
        {
          type: "audio/webm",
        }
      );

      await uploadAndSend(
        file,
        "voice"
      );
    } catch (error) {
      console.error(
        "Voice message failed:",
        error
      );

      showToast(
        "Voice message failed",
        "error"
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Conversation avatar
  |--------------------------------------------------------------------------
  */

  const getConversationPerson = (
    conversation
  ) => {
    if (conversation.type === "group") {
      return {
        name: conversation.groupName,
        profilePicture:
          resolveMediaUrl(
            conversation.groupPicture
          ),
      };
    }

    const person =
      conversation.participants?.find(
        (participant) =>
          String(participant._id) !==
          String(user?._id)
      );

    return normalizeUser(person);
  };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <section className="chat-grid">

      {/* ======================================================
          CONVERSATION LIST
      ====================================================== */}

      <aside className="conversation-list">

        <div className="list-heading">
          <h2>Chats</h2>

          <button
            className="icon-button"
            onClick={() =>
              navigate("/contacts")
            }
            title="New chat"
            type="button"
          >
            <UsersRound size={18} />
          </button>
        </div>

        {conversations.length === 0 && (
          <p className="empty-state">
            Find contacts to start a
            conversation.
          </p>
        )}

        {conversations.map(
          (conversation) => {
            const person =
              getConversationPerson(
                conversation
              );

            return (
              <button
                key={conversation._id}
                className={`conversation-item ${String(
                  conversation._id
                ) ===
                  String(conversationId)
                  ? "active"
                  : ""
                  }`}
                onClick={() =>
                  navigate(
                    `/chats/${conversation._id}`
                  )
                }
                type="button"
              >

                <Avatar
                  user={person}
                />

                <span>
                  <strong>
                    {person?.name ||
                      person?.phone ||
                      "New chat"}
                  </strong>

                  <small>
                    {conversation
                      .lastMessage
                      ?.text ||
                      conversation
                        .lastMessage
                        ?.messageType ||
                      "No messages yet"}
                  </small>
                </span>

                <time>
                  {day(
                    conversation.updatedAt
                  )}
                </time>

              </button>
            );
          }
        )}
      </aside>

      {/* ======================================================
          CHAT PANEL
      ====================================================== */}

      <section className="chat-panel">

        {!activeConversation ? (
          <div className="empty-chat">
            Select a conversation
          </div>
        ) : (
          <>
            {/* ==================================================
                HEADER
            ================================================== */}

            <header className="chat-header">

              <Avatar
                user={
                  activeConversation.type ===
                    "group"
                    ? {
                      name:
                        activeConversation.groupName,
                      profilePicture:
                        resolveMediaUrl(
                          activeConversation.groupPicture
                        ),
                    }
                    : peer
                }
              />

              <div>
                <h2>
                  {activeConversation.type ===
                    "group"
                    ? activeConversation.groupName
                    : peer?.name ||
                    peer?.phone ||
                    "Unknown user"}
                </h2>

                <p>
                  {typing
                    ? `${typing.name ||
                    typing.phone ||
                    "User"
                    } is typing...`
                    : peer?.isOnline
                      ? "Online"
                      : peer?.lastSeen
                        ? `Last seen ${time(
                          peer.lastSeen
                        )}`
                        : "Secure chat"}
                </p>
              </div>

              {/* CALL BUTTONS */}

              {activeConversation.type ===
                "private" &&
                peer && (
                  <div className="chat-actions">

                    <button
                      type="button"
                      className="icon-button"
                      onClick={async () => {
                        try {
                          await callManager.startCall(
                            {
                              receiver: peer,
                              type: "voice",
                              conversationId,
                            }
                          );
                        } catch (error) {
                          console.error(
                            "Voice call failed:",
                            error
                          );
                        }
                      }}
                      title="Voice call"
                    >
                      <Phone size={18} />
                    </button>

                    <button
                      type="button"
                      className="icon-button"
                      onClick={async () => {
                        try {
                          await callManager.startCall(
                            {
                              receiver: peer,
                              type: "video",
                              conversationId,
                            }
                          );
                        } catch (error) {
                          console.error(
                            "Video call failed:",
                            error
                          );
                        }
                      }}
                      title="Video call"
                    >
                      <Camera size={18} />
                    </button>

                  </div>
                )}

            </header>

            {/* ==================================================
                MESSAGES
            ================================================== */}

            <div className="message-list">

              {messages.map(
                (message) => (
                  <MessageBubble
                    key={message._id}
                    message={message}
                    mine={
                      String(
                        message.sender?._id ||
                        message.sender
                      ) ===
                      String(user?._id)
                    }
                    onEdit={
                      editMessage
                    }
                    onDelete={
                      deleteMessage
                    }
                    onReact={react}
                    onReply={
                      setReplyTo
                    }
                  />
                )
              )}

            </div>

            {/* ==================================================
                COMPOSER
            ================================================== */}

            <form
              className="composer"
              onSubmit={sendText}
            >

              {/* REPLY */}

              {replyTo && (
                <div className="composer-reply">

                  <span>
                    Replying to:{" "}
                    {replyTo.text ||
                      replyTo.messageType}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setReplyTo(null)
                    }
                  >
                    <X size={14} />
                  </button>

                </div>
              )}

              {/* EMOJI */}

              {showEmoji && (
                <div className="emoji-popover">

                  {emojis.map(
                    (emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => {
                          setDraft(
                            (value) =>
                              value + emoji
                          );
                        }}
                      >
                        {emoji}
                      </button>
                    )
                  )}

                </div>
              )}

              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  setShowEmoji(
                    (value) => !value
                  )
                }
                aria-label="Emoji picker"
              >
                <Smile size={18} />
              </button>

              {/* FILE */}

              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  fileInput.current?.click()
                }
                aria-label="Attach file"
              >
                <Paperclip size={18} />
              </button>

              {/* LOCATION */}

              <button
                type="button"
                className="icon-button"
                onClick={
                  sendLocation
                }
                aria-label="Share location"
              >
                <MapPin size={18} />
              </button>

              <input
                ref={fileInput}
                hidden
                type="file"
                onChange={(event) => {
                  const file =
                    event.target.files?.[0];

                  if (file) {
                    uploadAndSend(file);
                  }

                  event.target.value = "";
                }}
              />

              {/* TEXT */}

              <input
                value={draft}
                onChange={(event) =>
                  handleTyping(
                    event.target.value
                  )
                }
                placeholder="Type a message..."
              />

              {/* VOICE */}

              {recorder.recording ? (
                <button
                  type="button"
                  className="danger-button"
                  onClick={
                    finishVoice
                  }
                >
                  Send{" "}
                  {recorder.seconds}s
                </button>
              ) : (
                <button
                  type="button"
                  className="icon-button"
                  onMouseDown={
                    recorder.start
                  }
                  onTouchStart={
                    recorder.start
                  }
                  aria-label="Record voice"
                >
                  <Mic size={18} />
                </button>
              )}

              {/* SEND */}

              <button
                type="submit"
                className="primary-icon"
                aria-label="Send"
              >
                <Send size={18} />
              </button>

            </form>
          </>
        )}

      </section>

      {/* ======================================================
          CALL OVERLAY
      ====================================================== */}

      <CallOverlay
        manager={callManager}
      />

    </section>
  );
}
