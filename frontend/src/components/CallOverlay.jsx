
import { useEffect } from "react";

import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
} from "lucide-react";

import Avatar from "./Avatar.jsx";

export default function CallOverlay({ manager }) {
  const {
    incoming,
    call,

    status,
    muted,
    cameraOff,

    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,

    localStream,

    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = manager;

  /*
  |--------------------------------------------------------------------------
  | CALL DATA
  |--------------------------------------------------------------------------
  */

  const caller =
    incoming?.from ||
    call?.from ||
    call?.user ||
    call?.caller ||
    null;

  const callerName =
    caller?.name ||
    caller?.username ||
    caller?.phone ||
    incoming?.name ||
    call?.name ||
    call?.username ||
    "Aurora Contact";

  const callerAvatar =
    caller?.avatar ||
    caller?.profilePicture ||
    caller?.image ||
    incoming?.avatar ||
    call?.avatar ||
    call?.profilePicture ||
    call?.image ||
    null;

  /*
  |--------------------------------------------------------------------------
  | CALL TYPE
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  | Previous code had a ternary precedence problem.
  | Now video detection is explicit.
  |
  */

  const isVideoCall =
    Boolean(
      incoming?.video === true ||
      incoming?.type === "video" ||
      incoming?.call?.video === true ||
      incoming?.call?.type === "video" ||
      call?.video === true ||
      call?.type === "video" ||
      call?.call?.video === true ||
      call?.call?.type === "video"
    );

  const callType = isVideoCall ? "video" : "voice";

  /*
  |--------------------------------------------------------------------------
  | AVATAR USER
  |--------------------------------------------------------------------------
  */

  const avatarUser =
    caller || {
      name: callerName,
      avatar: callerAvatar,
    };

  /*
  |--------------------------------------------------------------------------
  | ATTACH LOCAL STREAM
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const video = localVideoRef?.current;

    if (!video) {
      return;
    }

    if (!localStream) {
      video.srcObject = null;
      return;
    }

    console.log(
      "📹 CallOverlay: attaching local stream"
    );

    video.srcObject = localStream;

    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

    video.play().catch((error) => {
      console.warn(
        "Local video play blocked:",
        error
      );
    });

  }, [localStream, localVideoRef]);

  /*
  |--------------------------------------------------------------------------
  | REMOTE AUDIO
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const audio = remoteAudioRef?.current;

    if (!audio) {
      return;
    }

    console.log(
      "🔊 CallOverlay: preparing remote audio"
    );

    audio.autoplay = true;
    audio.playsInline = true;
    audio.controls = false;
    audio.muted = false;
    audio.volume = 1;

    if (audio.srcObject) {
      audio
        .play()
        .then(() => {
          console.log(
            "🔊 Remote audio playing"
          );
        })
        .catch((error) => {
          console.warn(
            "⚠️ Remote audio autoplay blocked:",
            error
          );
        });
    }

  }, [remoteAudioRef, call, status]);

  /*
  |--------------------------------------------------------------------------
  | REMOTE VIDEO
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const video = remoteVideoRef?.current;

    if (!video) {
      return;
    }

    console.log(
      "📹 CallOverlay: preparing remote video"
    );

    video.autoplay = true;
    video.playsInline = true;

    /*
     * IMPORTANT:
     *
     * Remote audio is played through
     * remoteAudioRef.
     *
     * Therefore remote video stays muted
     * to prevent duplicate audio / echo.
     */

    video.muted = true;

    if (video.srcObject) {
      video
        .play()
        .then(() => {
          console.log(
            "📹 Remote video playing"
          );
        })
        .catch((error) => {
          console.warn(
            "⚠️ Remote video autoplay blocked:",
            error
          );
        });
    }

  }, [remoteVideoRef, call, status]);

  /*
  |--------------------------------------------------------------------------
  | NOTHING ACTIVE
  |--------------------------------------------------------------------------
  */

  if (
    !incoming &&
    !call &&
    status === "idle"
  ) {
    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | INCOMING CALL
  |--------------------------------------------------------------------------
  */

  if (incoming && !call) {
    return (
      <section
        className="call-overlay incoming-call-overlay"
        aria-live="polite"
      >
        <div className="incoming-call-screen">

          <div className="incoming-call-glow" />

          <div className="incoming-caller">

            <div className="incoming-avatar">
              <Avatar user={avatarUser} />
            </div>

            <p className="incoming-call-label">
              Incoming{" "}
              {isVideoCall
                ? "video"
                : "voice"}{" "}
              call
            </p>

            <h1>
              {callerName}
            </h1>

            {caller?.phone &&
              caller?.name && (
                <p className="incoming-phone">
                  {caller.phone}
                </p>
              )}

            <div className="incoming-ringing">
              <span />
              <span />
              <span />
            </div>

          </div>

          <div className="incoming-call-actions">

            {/* DECLINE */}

            <div className="incoming-action">

              <button
                type="button"
                className="incoming-call-button reject"
                onClick={rejectCall}
                aria-label="Reject call"
                title="Reject"
              >
                <PhoneOff size={25} />
              </button>

              <span>
                Decline
              </span>

            </div>

            {/* ACCEPT */}

            <div className="incoming-action">

              <button
                type="button"
                className="incoming-call-button accept"
                onClick={acceptCall}
                aria-label="Accept call"
                title="Accept"
              >
                {isVideoCall ? (
                  <Camera size={25} />
                ) : (
                  <Phone size={25} />
                )}
              </button>

              <span>
                Accept
              </span>

            </div>

          </div>

        </div>
      </section>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ACTIVE CALL
  |--------------------------------------------------------------------------
  */

  return (
    <section
      className={`call-overlay active-call-overlay ${
        isVideoCall
          ? "video-call-overlay"
          : "voice-call-overlay"
      }`}
      aria-live="polite"
    >
      <div className="active-call-screen">

        {/* ==================================================
            REMOTE AUDIO
        ================================================== */}

        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          controls={false}
          muted={false}
          className="remote-call-audio"
        />

        {/* ==================================================
            VIDEO CALL
        ================================================== */}

        {isVideoCall ? (
          <>
            {/* REMOTE VIDEO */}

            <div className="remote-video-container">

              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="remote-video"
              />

              {status !== "connected" && (
                <div className="video-call-waiting">

                  <div className="video-waiting-avatar">
                    <Avatar
                      user={avatarUser}
                    />
                  </div>

                  <h2>
                    {callerName}
                  </h2>

                  <p>
                    {status === "calling"
                      ? "Calling..."
                      : status === "ringing"
                        ? "Ringing..."
                        : status === "connecting"
                          ? "Connecting..."
                          : status}
                  </p>

                </div>
              )}

            </div>

            {/* LOCAL VIDEO */}

            <div
              className={`local-video-container ${
                cameraOff
                  ? "local-camera-off"
                  : ""
              }`}
            >
              {!cameraOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="local-video"
                />
              ) : (
                <div className="camera-off-preview">

                  <div className="camera-off-avatar">
                    <Avatar
                      user={manager?.user}
                    />
                  </div>

                  <CameraOff size={20} />

                </div>
              )}
            </div>

            {/* TOP BAR */}

            <div className="active-call-topbar">

              <div className="active-call-person">

                <Avatar
                  user={avatarUser}
                />

                <div>

                  <strong>
                    {callerName}
                  </strong>

                  <span>
                    {status === "calling"
                      ? "Calling..."
                      : status === "connected"
                        ? "Connected"
                        : status === "ringing"
                          ? "Ringing..."
                          : status}
                  </span>

                </div>

              </div>

            </div>
          </>
        ) : (
          /* ==================================================
             VOICE CALL
             ================================================== */

          <div className="voice-call-screen">

            <div className="voice-call-content">

              <div className="voice-call-avatar">
                <Avatar
                  user={avatarUser}
                />
              </div>

              <h1>
                {callerName}
              </h1>

              <p className="voice-call-status">
                {status === "calling"
                  ? "Calling..."
                  : status === "connected"
                    ? "Connected"
                    : status === "ringing"
                      ? "Ringing..."
                      : status}
              </p>

              {caller?.phone && (
                <span className="voice-call-phone">
                  {caller.phone}
                </span>
              )}

            </div>

          </div>
        )}

        {/* ==================================================
            CALL CONTROLS
        ================================================== */}

        <div className="call-controls-wrapper">

          <div className="call-controls">

            {/* MUTE */}

            <div className="call-control-item">

              <button
                type="button"
                className={`call-control ${
                  muted
                    ? "active-control"
                    : ""
                }`}
                onClick={toggleMute}
                aria-label={
                  muted
                    ? "Unmute microphone"
                    : "Mute microphone"
                }
                title={
                  muted
                    ? "Unmute"
                    : "Mute"
                }
              >
                {muted ? (
                  <MicOff size={22} />
                ) : (
                  <Mic size={22} />
                )}
              </button>

              <span>
                {muted
                  ? "Unmute"
                  : "Mute"}
              </span>

            </div>

            {/* CAMERA */}

            {isVideoCall && (
              <div className="call-control-item">

                <button
                  type="button"
                  className={`call-control ${
                    cameraOff
                      ? "active-control"
                      : ""
                  }`}
                  onClick={toggleCamera}
                  aria-label={
                    cameraOff
                      ? "Turn camera on"
                      : "Turn camera off"
                  }
                  title={
                    cameraOff
                      ? "Turn camera on"
                      : "Turn camera off"
                  }
                >
                  {cameraOff ? (
                    <CameraOff size={22} />
                  ) : (
                    <Camera size={22} />
                  )}
                </button>

                <span>
                  {cameraOff
                    ? "Camera on"
                    : "Camera off"}
                </span>

              </div>
            )}

            {/* END CALL */}

            <div className="call-control-item">

              <button
                type="button"
                className="call-control end-call-control"
                onClick={endCall}
                aria-label="End call"
                title="End call"
              >
                <PhoneOff size={23} />
              </button>

              <span>
                End
              </span>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

