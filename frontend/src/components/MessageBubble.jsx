import {
  Check,
  CheckCheck,
  Copy,
  Edit3,
  Forward,
  SmilePlus,
  Star,
  Trash2,
} from "lucide-react";

import { time } from "../utils/format";
import { API_URL } from "../services/api";

export default function MessageBubble({
  message,
  mine,
  onEdit,
  onDelete,
  onReact,
  onReply,
}) {
  /*
  |--------------------------------------------------------------------------
  | Message status
  |--------------------------------------------------------------------------
  */

  const statusIcon =
    message.readBy?.length > 1 ? (
      <CheckCheck size={14} />
    ) : (
      <Check size={14} />
    );

  /*
  |--------------------------------------------------------------------------
  | Deleted message
  |--------------------------------------------------------------------------
  */

  const isDeleted =
    message.deleted === true ||
    message.isDeleted === true ||
    message.messageType === "deleted";

  /*
  |--------------------------------------------------------------------------
  | Media URL
  |--------------------------------------------------------------------------
  */

  const getMediaUrl = (url) => {
    if (!url) return "";

    const value = String(url).trim();

    if (!value) return "";

    /*
    Full URL
    */

    if (
      value.startsWith("http://") ||
      value.startsWith("https://")
    ) {
      try {
        const parsed = new URL(value);

        return `${API_URL}${parsed.pathname}${parsed.search}`;
      } catch {
        return value;
      }
    }

    /*
    Relative URL
    */

    if (value.startsWith("/")) {
      return `${API_URL}${value}`;
    }

    /*
    Normal path
    */

    return `${API_URL}/${value}`;
  };

  const mediaUrl = getMediaUrl(message.mediaUrl);

  /*
  |--------------------------------------------------------------------------
  | Copy message
  |--------------------------------------------------------------------------
  */

  const handleCopy = async () => {
    const text = message.text?.trim();

    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error(
        "Could not copy message:",
        error
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Delete message
  |--------------------------------------------------------------------------
  */

  const handleDelete = () => {
    if (!onDelete || !mine) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this message for everyone?"
    );

    if (!confirmed) {
      return;
    }

    onDelete(message);
  };

  /*
  |--------------------------------------------------------------------------
  | Edit message
  |--------------------------------------------------------------------------
  */

  const handleEdit = () => {
    if (!onEdit || !mine) {
      return;
    }

    /*
    Only text messages can be edited.
    */

    if (
      message.messageType &&
      message.messageType !== "text"
    ) {
      return;
    }

    onEdit(message);
  };

  /*
  |--------------------------------------------------------------------------
  | Message content
  |--------------------------------------------------------------------------
  */

  const content = () => {
    /*
    Deleted message
    */

    if (isDeleted) {
      return (
        <span className="deleted-message">
          Message deleted
        </span>
      );
    }

    /*
    Image
    */

    if (message.messageType === "image") {
      return (
        <img
          className="message-media"
          src={mediaUrl}
          alt={
            message.fileName ||
            "Image message"
          }
        />
      );
    }

    /*
    Video
    */

    if (message.messageType === "video") {
      return (
        <video
          className="message-media"
          controls
          src={mediaUrl}
        />
      );
    }

    /*
    Audio / Voice
    */

    if (
      ["audio", "voice"].includes(
        message.messageType
      )
    ) {
      return (
        <audio
          controls
          src={mediaUrl}
        />
      );
    }

    /*
    Document
    */

    if (
      message.messageType ===
      "document"
    ) {
      return (
        <a
          className="message-document"
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
        >
          {message.fileName ||
            "Document"}
        </a>
      );
    }

    /*
    Location
    */

    if (
      message.messageType ===
      "location"
    ) {
      return (
        <span>
          Location:{" "}
          {message.location?.label ||
            `${message.location?.lat}, ${message.location?.lng}`}
        </span>
      );
    }

    /*
    Contact
    */

    if (
      message.messageType ===
      "contact"
    ) {
      return (
        <span>
          Contact:{" "}
          {message.contact?.name}{" "}
          {message.contact?.phone}
        </span>
      );
    }

    /*
    Default text
    */

    return (
      <span>
        {message.text ||
          "Message deleted"}
      </span>
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <article
      className={`message-row ${mine ? "mine" : ""
        } ${isDeleted
          ? "message-deleted"
          : ""
        }`}
    >
      <div className="message-bubble">

        {/* ==================================================
            REPLY PREVIEW
        ================================================== */}

        {!isDeleted &&
          message.replyTo && (
            <p className="reply-preview">
              {message.replyTo.text ||
                message.replyTo.messageType}
            </p>
          )}

        {/* ==================================================
            CONTENT
        ================================================== */}

        <div className="message-content">
          {content()}
        </div>

        {/* ==================================================
            REACTIONS
        ================================================== */}

        {!isDeleted &&
          message.reactions?.length >
          0 && (
            <div className="reactions">
              {message.reactions
                .map(
                  (reaction) =>
                    reaction.emoji
                )
                .join(" ")}
            </div>
          )}

        {/* ==================================================
            FOOTER
        ================================================== */}

        <footer>
          <span>
            {message.edited &&
              !isDeleted
              ? "edited "
              : ""}

            {time(
              message.createdAt
            )}
          </span>

          {mine &&
            !isDeleted &&
            statusIcon}
        </footer>

        {/* ==================================================
            MESSAGE TOOLS
        ================================================== */}

        {!isDeleted && (
          <div className="message-tools">

            {/* REPLY */}

            <button
              type="button"
              title="Reply"
              onClick={() =>
                onReply?.(message)
              }
            >
              <Forward size={14} />
            </button>

            {/* REACT */}

            <button
              type="button"
              title="React"
              onClick={() =>
                onReact?.(
                  message,
                  "👍"
                )
              }
            >
              <SmilePlus size={14} />
            </button>

            {/* STAR */}

            <button
              type="button"
              title="Star"
              onClick={() =>
                onReact?.(
                  message,
                  "⭐"
                )
              }
            >
              <Star size={14} />
            </button>

            {/* COPY */}

            {message.text && (
              <button
                type="button"
                title="Copy"
                onClick={
                  handleCopy
                }
              >
                <Copy size={14} />
              </button>
            )}

            {/* EDIT */}

            {mine &&
              message.messageType ===
              "text" && (
                <button
                  type="button"
                  title="Edit message"
                  onClick={
                    handleEdit
                  }
                >
                  <Edit3 size={14} />
                </button>
              )}

            {/* DELETE */}

            {mine && (
              <button
                type="button"
                title="Delete message"
                onClick={
                  handleDelete
                }
              >
                <Trash2 size={14} />
              </button>
            )}

          </div>
        )}
      </div>
    </article>
  );
}