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
    status,
    muted,
    cameraOff,
    localVideoRef,
    remoteVideoRef,
    localStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = manager;

  /* =========================================================
     ADD — ATTACH LOCAL CAMERA STREAM TO VIDEO
     ========================================================= */

  useEffect(() => {
    if (
      localVideoRef?.current &&
      localStream
    ) {
      localVideoRef.current.srcObject = localStream;

      localVideoRef.current
        .play()
        .catch(() => { });
    }
  }, [localStream, localVideoRef]);

  if (!incoming && status === "idle") {
    return null;
  }

  const callType =
    incoming?.call?.type ||
    manager?.callType ||
    "voice";

  const isVideoCall = callType === "video";

  const caller = incoming?.from;

  const callerName =
    caller?.name ||
    caller?.phone ||
    "Aurora Contact";

  /*
  |--------------------------------------------------------------------------
  | INCOMING CALL
  |--------------------------------------------------------------------------
  */

  if (incoming && status === "idle") {
    return (
      <section
        className="call-overlay incoming-call-overlay"
        aria-live="polite"
      >
        <div className="incoming-call-screen">

          {/* Background */}
          <div className="incoming-call-glow" />

          {/* Caller */}
          <div className="incoming-caller">

            <div className="incoming-avatar">
              <Avatar user={caller} />
            </div>

            <p className="incoming-call-label">
              Incoming {isVideoCall ? "video" : "voice"} call
            </p>

            <h1>{callerName}</h1>

            {caller?.phone && caller?.name && (
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

          {/* Actions */}
          <div className="incoming-call-actions">

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

              <span>Decline</span>

            </div>

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

              <span>Accept</span>

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
      className={`call-overlay active-call-overlay ${isVideoCall
          ? "video-call-overlay"
          : "voice-call-overlay"
        }`}
      aria-live="polite"
    >

      <div className="active-call-screen">

        {/* ======================================================
            VIDEO CALL
        ====================================================== */}

        {isVideoCall ? (
          <>
            {/* Remote Video */}
            <div className="remote-video-container">

              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />

              {/* Waiting / Calling state */}
              {status !== "connected" && (
                <div className="video-call-waiting">

                  <div className="video-waiting-avatar">
                    <Avatar user={caller} />
                  </div>

                  <h2>
                    {callerName}
                  </h2>

                  <p>
                    {status === "calling"
                      ? "Calling..."
                      : status}
                  </p>

                </div>
              )}

            </div>

            {/* Local Video */}
            <div
              className={`local-video-container ${cameraOff
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
                    <Avatar user={manager?.user} />
                  </div>

                  <CameraOff size={20} />

                </div>
              )}

            </div>

            {/* Top Header */}
            <div className="active-call-topbar">

              <div className="active-call-person">

                <Avatar user={caller} />

                <div>
                  <strong>
                    {callerName}
                  </strong>

                  <span>
                    {status === "calling"
                      ? "Calling..."
                      : status === "connected"
                        ? "Connected"
                        : status}
                  </span>
                </div>

              </div>

            </div>
          </>
        ) : (
          /* ====================================================
             VOICE CALL
             ==================================================== */

          <div className="voice-call-screen">

            <div className="voice-call-content">

              <div className="voice-call-avatar">
                <Avatar user={caller} />
              </div>

              <h1>
                {callerName}
              </h1>

              <p className="voice-call-status">

                {status === "calling"
                  ? "Calling..."
                  : status === "connected"
                    ? "Connected"
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

        {/* ======================================================
            CALL CONTROLS
        ====================================================== */}

        <div className="call-controls-wrapper">

          <div className="call-controls">

            {/* Mute */}
            <div className="call-control-item">

              <button
                type="button"
                className={`call-control ${muted
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
                {muted ? "Unmute" : "Mute"}
              </span>

            </div>

            {/* Camera */}
            {isVideoCall && (
              <div className="call-control-item">

                <button
                  type="button"
                  className={`call-control ${cameraOff
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

            {/* End Call */}
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

              <span>End</span>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}