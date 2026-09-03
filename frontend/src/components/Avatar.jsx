import { useMemo, useState } from "react";
import { API_URL } from "../services/api";
import { initials } from "../utils/format";

function resolveImageUrl(url) {
  if (!url) return "";

  const value = String(url).trim();

  if (!value) return "";

  // Already relative URL
  if (value.startsWith("/")) {
    return `${API_URL}${value}`;
  }

  try {
    const parsed = new URL(value);

    // Convert old local HTTP/host URLs
    // to the current HTTPS backend.
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

export default function Avatar({
  user,
  size = "md",
}) {
  const [imageError, setImageError] =
    useState(false);

  const imageUrl = useMemo(() => {
    return resolveImageUrl(
      user?.profilePicture
    );
  }, [user?.profilePicture]);

  const showImage =
    Boolean(imageUrl) && !imageError;

  console.log("AVATAR USER:", user);
  console.log("AVATAR IMAGE:", imageUrl);

  return (
    <span
      className={`avatar ${size}`}
      aria-label={user?.name || "User"}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={user?.name || "User"}
          loading="lazy"
          decoding="async"
          onLoad={() => {
            console.log(
              "AVATAR LOADED:",
              imageUrl
            );
          }}
          onError={(event) => {
            console.error(
              "AVATAR IMAGE FAILED:",
              event.currentTarget.src
            );

            setImageError(true);
          }}
        />
      ) : (
        <span className="avatar-initials">
          {initials(user)}
        </span>
      )}
    </span>
  );
}