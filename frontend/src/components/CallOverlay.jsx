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
    call,
    incoming,
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

  // =========================================================
  // CALL TYPE
  // =========================================================

  const callType =
    incoming?.call?.type ||
    call?.type ||
    manager?.callType ||
    "voice";

  const isVideoCall = callType === "video";

  // =========================================================
  // CALLER / REMOTE USER
  // =========================================================

  const caller =
    incoming?.from ||
    manager?.remoteUser ||
    null;

  const callerName =
    caller?.name ||
    caller?.phone ||
    "Aurora Contact";

  // =========================================================
  // LOCAL VIDEO
  // IMPORTANT:
  // Always keep the video element mounted.
  // =========================================================

  useEffect(() => {
    if (!isVideoCall) return;

    const video = localVideoRef?.current;

    if (!video) {
      console.log(
        "CALL OVERLAY: local video element not ready"
      );
      return;
    }

    if (!localStream) {
      console.log(
        "CALL OVERLAY: local stream not available"
      );
      return;
    }

    console.log(
      "CALL OVERLAY: attaching local stream",
      localStream.getTracks().map((track) => track.kind)
    );

    if (video.srcObject !== localStream) {
      video.srcObject = localStream;
    }

    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    video.play().catch((error) => {
      console.log(
        "CALL OVERLAY: local video play blocked",
        error
      );
    });
  }, [
    localStream,
    isVideoCall,
    localVideoRef,
    cameraOff,
  ]);

  // =========================================================
  // REMOTE VIDEO
  //
  // The manager's ontrack handler is responsible for setting
  // remoteVideoRef.current.srcObject.
  //
  // Here we only make sure the video element is playable.
  // =========================================================

  useEffect(() => {
    if (!isVideoCall) return;

    const video = remoteVideoRef?.current;

    if (!video) {
      console.log(
        "CALL OVERLAY: remote video element not ready"
      );
      return;
    }

    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;

    console.log(
      "CALL OVERLAY: remote video element ready"
    );

    if (video.srcObject) {
      console.log(
        "CALL OVERLAY: remote video already has stream",
        video.srcObject
          .getTracks()
          .map((track) => track.kind)
      );

      video.play().catch((error) => {
        console.log(
          "CALL OVERLAY: remote video play blocked",
          error
        );
      });
    }
  }, [
    status,
    isVideoCall,
    remoteVideoRef,
  ]);

  // =========================================================
  // REMOTE AUDIO
  // =========================================================

  useEffect(() => {
    const audio = remoteAudioRef?.current;

    if (!audio) {
      return;
    }

    audio.autoplay = true;
    audio.playsInline = true;
    audio.muted = false;
    audio.volume = 1;

    console.log(
      "CALL OVERLAY: remote audio element ready"
    );

    if (audio.srcObject) {
      audio.play().catch((error) => {
        console.log(
          "CALL OVERLAY: remote audio play blocked",
          error
        );
      });
    }
  }, [
    status,
    remoteAudioRef,
  ]);

  // =========================================================
  // NOTHING TO SHOW
  // =========================================================

  if (
    !incoming &&
    !call &&
    status === "idle"
  ) {
    return null;
  }

  // =========================================================
  // INCOMING CALL
  // =========================================================

  if (
    incoming &&
    status === "ringing"
  ) {
    return (
      <section
        className="call-overlay incoming-call-overlay"
        aria-live="polite"
      >
        <div className="incoming-call-screen">

          {/* BACKGROUND */}
          <div className="incoming-call-glow" />

          {/* CALLER */}
          <div className="incoming-caller">

            <div className="incoming-avatar">
              <Avatar user={caller} />
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

          {/* ACTIONS */}
          <div className="incoming-call-actions">

            {/* REJECT */}

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

  // =========================================================
  // ACTIVE CALL
  // =========================================================

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

        {/* ===================================================
            VIDEO CALL
        =================================================== */}

        {isVideoCall ? (
          <>
            {/* =================================================
                REMOTE VIDEO - MAIN VIDEO
            ================================================= */}

            <div className="remote-video-container">

              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                className="remote-video"
                onLoadedMetadata={(event) => {
                  console.log(
                    "REMOTE VIDEO METADATA LOADED"
                  );

                  event.currentTarget
                    .play()
                    .catch((error) => {
                      console.log(
                        "Remote video play error:",
                        error
                      );
                    });
                }}
              />

              {/* REMOTE AUDIO */}

              <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                muted={false}
                controls={false}
              />

              {/* REMOTE WAITING */}

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
                      : status === "connecting"
                        ? "Connecting..."
                        : status === "ringing"
                          ? "Incoming call..."
                          : status}
                  </p>

                </div>
              )}

            </div>

            {/* =================================================
                LOCAL VIDEO - ALWAYS MOUNTED
            ================================================= */}

            <div
              className={`local-video-container ${
                cameraOff
                  ? "local-camera-off"
                  : ""
              }`}
            >

              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`local-video ${
                  cameraOff
                    ? "local-video-hidden"
                    : ""
                }`}
              />

              {/* CAMERA OFF OVERLAY */}

              {cameraOff && (
                <div className="camera-off-preview">

                  <div className="camera-off-avatar">
                    <Avatar
                      user={
                        manager?.user ||
                        caller
                      }
                    />
                  </div>

                  <CameraOff size={20} />

                  <span>
                    Camera off
                  </span>

                </div>
              )}

            </div>

            {/* =================================================
                TOP HEADER
            ================================================= */}

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
                      : status === "connecting"
                        ? "Connecting..."
                        : status === "connected"
                          ? "Connected"
                          : status}
                  </span>

                </div>

              </div>

            </div>
          </>
        ) : (
          /* ===================================================
             VOICE CALL
          =================================================== */

          <div className="voice-call-screen">

            {/* REMOTE AUDIO */}

            <audio
              ref={remoteAudioRef}
              autoPlay
              playsInline
              muted={false}
              controls={false}
            />

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
                  : status === "connecting"
                    ? "Connecting..."
                    : status === "connected"
                      ? "Connected"
                      : status === "ringing"
                        ? "Incoming call..."
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

        {/* ===================================================
            CALL CONTROLS
        =================================================== */}

        <div className="call-controls-wrapper">

          <div className="call-controls">

            {/* =================================================
                MUTE
            ================================================= */}

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

            {/* =================================================
                CAMERA
            ================================================= */}

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

            {/* =================================================
                END CALL
            ================================================= */}

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
