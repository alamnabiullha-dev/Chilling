
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../socket/client";

const iceServers = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

export function useCallManager(currentUser) {
  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);

  // idle | ringing | calling | connecting | connected | failed
  const [status, setStatus] = useState("idle");

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // VIDEO / AUDIO REFS
  // =========================================================

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // =========================================================
  // WEBRTC REFS
  // =========================================================

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const remoteUserRef = useRef(null);
  const currentCallIdRef = useRef(null);

  // ICE candidates which arrive before remote description
  const pendingCandidatesRef = useRef([]);

  // =========================================================
  // CLOSE MEDIA
  // =========================================================

  const closeMedia = useCallback(() => {
    console.log("🧹 Closing call...");

    // -------------------------------------------------------
    // Close peer connection
    // -------------------------------------------------------

    if (peerRef.current) {
      try {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.oniceconnectionstatechange = null;
        peerRef.current.close();
      } catch (err) {
        console.error("Peer close error:", err);
      }
    }

    peerRef.current = null;

    // -------------------------------------------------------
    // Stop microphone + camera
    // -------------------------------------------------------

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.error("Track stop error:", err);
        }
      });
    }

    localStreamRef.current = null;
    remoteStreamRef.current = null;

    pendingCandidatesRef.current = [];

    // -------------------------------------------------------
    // Clear local video
    // -------------------------------------------------------

    if (localVideoRef.current) {
      try {
        localVideoRef.current.pause();
      } catch {}

      localVideoRef.current.srcObject = null;
    }

    // -------------------------------------------------------
    // Clear remote video
    // -------------------------------------------------------

    if (remoteVideoRef.current) {
      try {
        remoteVideoRef.current.pause();
      } catch {}

      remoteVideoRef.current.srcObject = null;
    }

    // -------------------------------------------------------
    // Clear remote audio
    // -------------------------------------------------------

    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
      } catch {}

      remoteAudioRef.current.srcObject = null;
    }

    remoteUserRef.current = null;
    currentCallIdRef.current = null;

    setStatus("idle");
    setCall(null);
    setIncoming(null);
    setMuted(false);
    setCameraOff(false);
  }, []);

  // =========================================================
  // GET MICROPHONE / CAMERA
  // =========================================================

  const getMedia = useCallback(async (type = "voice") => {
    setError("");

    if (!navigator.mediaDevices) {
      const message =
        "Microphone/camera is not available. Please use localhost or HTTPS.";

      setError(message);
      throw new Error(message);
    }

    if (!navigator.mediaDevices.getUserMedia) {
      const message =
        "Your browser does not support microphone/camera access.";

      setError(message);
      throw new Error(message);
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },

      video:
        type === "video"
          ? {
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
              facingMode: "user",
            }
          : false,
    };

    try {
      console.log("🎤 Requesting media:", constraints);

      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );

      // =====================================================
      // MICROPHONE CHECK
      // =====================================================

      const audioTracks =
        stream.getAudioTracks();

      console.log(
        "🎤 Microphone tracks:",
        audioTracks.length
      );

      if (audioTracks.length === 0) {
        throw new Error(
          "No microphone track found."
        );
      }

      audioTracks.forEach((track) => {
        track.enabled = true;

        console.log(
          "🎤 Local microphone:",
          {
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          }
        );
      });

      // =====================================================
      // CAMERA CHECK
      // =====================================================

      const videoTracks =
        stream.getVideoTracks();

      videoTracks.forEach((track) => {
        track.enabled = true;

        console.log(
          "📷 Local camera:",
          {
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          }
        );
      });

      localStreamRef.current = stream;

      // =====================================================
      // LOCAL VIDEO
      // =====================================================

      if (
        type === "video" &&
        localVideoRef.current
      ) {
        localVideoRef.current.srcObject =
          stream;

        localVideoRef.current.muted = true;
        localVideoRef.current.autoplay = true;
        localVideoRef.current.playsInline = true;

        try {
          await localVideoRef.current.play();
        } catch (err) {
          console.warn(
            "Local video play failed:",
            err
          );
        }
      }

      console.log(
        "✅ Local media ready"
      );

      return stream;
    } catch (err) {
      console.error(
        "❌ getUserMedia failed:",
        err
      );

      let message =
        "Could not access microphone/camera.";

      if (err.name === "NotAllowedError") {
        message =
          "Microphone/camera permission denied. Please allow permission in browser settings.";
      }

      if (err.name === "NotFoundError") {
        message =
          "No microphone or camera found.";
      }

      if (err.name === "NotReadableError") {
        message =
          "Microphone/camera is already being used by another application.";
      }

      if (err.name === "SecurityError") {
        message =
          "Microphone/camera requires localhost or HTTPS.";
      }

      setError(message);

      throw new Error(message);
    }
  }, []);

  // =========================================================
  // PLAY REMOTE AUDIO
  // =========================================================

  const playRemoteAudio = useCallback(
    async (stream) => {
      const audio =
        remoteAudioRef.current;

      if (!audio) {
        console.warn(
          "⚠️ Remote audio element not available"
        );
        return;
      }

      if (!stream) {
        console.warn(
          "⚠️ Remote stream not available"
        );
        return;
      }

      const audioTracks =
        stream.getAudioTracks();

      console.log(
        "🔊 Remote audio tracks:",
        audioTracks.length
      );

      audio.srcObject = stream;
      audio.autoplay = true;
      audio.controls = false;
      audio.muted = false;
      audio.volume = 1;
      audio.playsInline = true;

      audioTracks.forEach((track) => {
        console.log(
          "🔊 Remote audio track:",
          {
            id: track.id,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            label: track.label,
          }
        );
      });

      try {
        await audio.play();

        console.log(
          "✅ Remote audio playing"
        );
      } catch (err) {
        console.error(
          "❌ Remote audio play failed:",
          err
        );

        setError(
          "Remote audio was blocked. Click the call screen and try again."
        );
      }
    },
    []
  );

  // =========================================================
  // CREATE PEER
  // =========================================================

  const createPeer = useCallback(
    (targetUserId, callId = null) => {
      const socket =
        getSocket();

      // =====================================================
      // VERY IMPORTANT
      // NEVER CREATE TWO PEERS FOR ONE CALL
      // =====================================================

      if (peerRef.current) {
        console.log(
          "♻️ Using existing WebRTC peer"
        );

        return peerRef.current;
      }

      console.log(
        "🆕 Creating WebRTC peer"
      );

      const peer =
        new RTCPeerConnection({
          iceServers,
        });

      // =====================================================
      // ICE CANDIDATE
      // =====================================================

      peer.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        console.log(
          "🧊 Sending ICE candidate"
        );

        socket?.emit(
          "webrtc:ice-candidate",
          {
            to: targetUserId,
            candidate:
              event.candidate,
            callId:
              callId ||
              currentCallIdRef.current,
          }
        );
      };

      // =====================================================
      // REMOTE TRACK
      // =====================================================

      peer.ontrack = async (event) => {
        console.log(
          "📥 REMOTE TRACK:",
          {
            kind: event.track.kind,
            id: event.track.id,
            enabled:
              event.track.enabled,
            muted:
              event.track.muted,
            readyState:
              event.track.readyState,
          }
        );

        let stream =
          event.streams?.[0];

        // ---------------------------------------------------
        // Fallback if browser doesn't provide stream
        // ---------------------------------------------------

        if (!stream) {
          stream =
            remoteStreamRef.current ||
            new MediaStream();

          const exists =
            stream
              .getTracks()
              .some(
                (track) =>
                  track.id ===
                  event.track.id
              );

          if (!exists) {
            stream.addTrack(
              event.track
            );
          }
        }

        remoteStreamRef.current =
          stream;

        console.log(
          "📥 Remote stream:",
          {
            audioTracks:
              stream.getAudioTracks()
                .length,

            videoTracks:
              stream.getVideoTracks()
                .length,
          }
        );

        // ===================================================
        // AUDIO
        // ===================================================

        if (
          stream.getAudioTracks()
            .length > 0
        ) {
          await playRemoteAudio(
            stream
          );
        }

        // ===================================================
        // VIDEO
        // ===================================================

        if (
          stream.getVideoTracks()
            .length > 0 &&
          remoteVideoRef.current
        ) {
          const video =
            remoteVideoRef.current;

          video.srcObject =
            stream;

          video.autoplay = true;
          video.playsInline = true;
          video.muted = false;
          video.volume = 1;

          try {
            await video.play();

            console.log(
              "✅ Remote video playing"
            );
          } catch (err) {
            console.error(
              "❌ Remote video play failed:",
              err
            );
          }
        }
      };

      // =====================================================
      // CONNECTION STATE
      // =====================================================

      peer.onconnectionstatechange =
        () => {
          console.log(
            "🌐 WebRTC connection:",
            peer.connectionState
          );

          if (
            peer.connectionState ===
            "connected"
          ) {
            console.log(
              "✅ WEBRTC CONNECTED"
            );

            setStatus(
              "connected"
            );
          }

          if (
            peer.connectionState ===
            "connecting"
          ) {
            setStatus(
              "connecting"
            );
          }

          if (
            peer.connectionState ===
            "failed"
          ) {
            console.error(
              "❌ WEBRTC FAILED"
            );

            setStatus(
              "failed"
            );

            setError(
              "WebRTC connection failed."
            );
          }

          if (
            peer.connectionState ===
            "disconnected"
          ) {
            console.warn(
              "⚠️ WebRTC disconnected"
            );
          }
        };

      // =====================================================
      // ICE STATE
      // =====================================================

      peer.oniceconnectionstatechange =
        () => {
          console.log(
            "🧊 ICE:",
            peer.iceConnectionState
          );
        };

      peerRef.current =
        peer;

      return peer;
    },
    [playRemoteAudio]
  );

  // =========================================================
  // ADD PENDING ICE
  // =========================================================

  const addPendingCandidates =
    useCallback(async (peer) => {
      if (
        !peer ||
        !peer.remoteDescription
      ) {
        return;
      }

      const candidates =
        pendingCandidatesRef.current;

      if (!candidates.length) {
        return;
      }

      pendingCandidatesRef.current =
        [];

      console.log(
        `🧊 Adding ${candidates.length} queued candidates`
      );

      for (
        const candidate of candidates
      ) {
        try {
          await peer.addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );

          console.log(
            "✅ Queued ICE added"
          );
        } catch (err) {
          console.error(
            "❌ Queued ICE error:",
            err
          );
        }
      }
    }, []);

  // =========================================================
  // START CALL
  // =========================================================

  const startCall = async ({
    receiver,
    type = "voice",
    conversationId,
  }) => {
    try {
      setError("");

      const socket =
        getSocket();

      if (!socket) {
        throw new Error(
          "Socket connection is not available."
        );
      }

      if (!receiver?._id) {
        throw new Error(
          "Receiver information is missing."
        );
      }

      console.log(
        "📞 START CALL",
        {
          receiver:
            receiver._id,
          type,
          conversationId,
        }
      );

      remoteUserRef.current =
        receiver._id;

      // =====================================================
      // GET LOCAL MEDIA
      // =====================================================

      const stream =
        await getMedia(type);

      // =====================================================
      // CREATE PEER
      // =====================================================

      const peer =
        createPeer(
          receiver._id
        );

      // =====================================================
      // ADD ALL LOCAL TRACKS
      // =====================================================

      stream
        .getTracks()
        .forEach((track) => {
          console.log(
            "📤 ADDING LOCAL TRACK:",
            {
              kind:
                track.kind,
              id:
                track.id,
              enabled:
                track.enabled,
              muted:
                track.muted,
              readyState:
                track.readyState,
            }
          );

          peer.addTrack(
            track,
            stream
          );
        });

      // =====================================================
      // MICROPHONE VERIFY
      // =====================================================

      const audioTracks =
        stream.getAudioTracks();

      console.log(
        "🎤 AUDIO TRACKS BEING SENT:",
        audioTracks.length
      );

      audioTracks.forEach(
        (track) => {
          console.log(
            "🎤 MIC:",
            {
              enabled:
                track.enabled,
              muted:
                track.muted,
              readyState:
                track.readyState,
            }
          );
        }
      );

      // =====================================================
      // CREATE CALL ON SERVER
      // =====================================================

      socket.emit(
        "call:initiate",
        {
          receiver:
            receiver._id,

          participants: [
            receiver._id,
          ],

          type,

          conversationId,
        },
        async (ack) => {
          try {
            if (!ack?.ok) {
              setStatus(
                "failed"
              );

              setError(
                ack?.message ||
                  "Could not start call."
              );

              return;
            }

            setCall(
              ack.call
            );

            currentCallIdRef.current =
              ack.call._id;

            setStatus(
              "calling"
            );

            // =================================================
            // CREATE OFFER
            // =================================================

            const offer =
              await peer.createOffer();

            await peer.setLocalDescription(
              offer
            );

            console.log(
              "📤 Sending OFFER"
            );

            socket.emit(
              "webrtc:offer",
              {
                to:
                  receiver._id,

                offer,

                callId:
                  ack.call._id,

                type,
              }
            );
          } catch (err) {
            console.error(
              "❌ Offer creation failed:",
              err
            );

            setStatus(
              "failed"
            );

            setError(
              "Could not establish the call."
            );
          }
        }
      );
    } catch (err) {
      console.error(
        "❌ Start call failed:",
        err
      );

      setStatus(
        "failed"
      );

      setError(
        err.message ||
          "Could not access microphone/camera."
      );
    }
  };

  // =========================================================
  // ACCEPT CALL
  // =========================================================

  const acceptCall =
    async () => {
      if (!incoming) {
        return;
      }

      try {
        setError("");

        const socket =
          getSocket();

        const remoteId =
          incoming.from?._id ||
          incoming.from;

        const type =
          incoming.call?.type ||
          "voice";

        const callId =
          incoming.call?._id;

        console.log(
          "📞 ACCEPT CALL",
          {
            remoteId,
            type,
            callId,
          }
        );

        remoteUserRef.current =
          remoteId;

        currentCallIdRef.current =
          callId;

        // =====================================================
        // GET LOCAL MEDIA
        // =====================================================

        const stream =
          await getMedia(type);

        // =====================================================
        // CREATE ONLY ONE PEER
        // =====================================================

        const peer =
          createPeer(
            remoteId,
            callId
          );

        // =====================================================
        // ADD MICROPHONE + CAMERA
        // =====================================================

        stream
          .getTracks()
          .forEach((track) => {
            console.log(
              "📤 ACCEPT - ADD TRACK:",
              {
                kind:
                  track.kind,
                id:
                  track.id,
                enabled:
                  track.enabled,
                muted:
                  track.muted,
                readyState:
                  track.readyState,
              }
            );

            peer.addTrack(
              track,
              stream
            );
          });

        // =====================================================
        // IMPORTANT
        // SHOW CONNECTED IMMEDIATELY AFTER ACCEPT
        // =====================================================

        setCall(
          incoming.call
        );

        setStatus(
          "connected"
        );

        // =====================================================
        // ACCEPT ON SERVER
        // =====================================================

        socket?.emit(
          "call:accept",
          {
            to:
              remoteId,

            callId,
          }
        );

        // =====================================================
        // REMOVE INCOMING SCREEN
        // =====================================================

        setIncoming(
          null
        );

        console.log(
          "✅ CALL ACCEPTED"
        );
      } catch (err) {
        console.error(
          "❌ Accept call failed:",
          err
        );

        setStatus(
          "failed"
        );

        setError(
          err.message ||
            "Could not access microphone/camera."
        );
      }
    };

  // =========================================================
  // REJECT
  // =========================================================

  const rejectCall =
    () => {
      const socket =
        getSocket();

      const remoteId =
        incoming?.from?._id ||
        incoming?.from;

      const callId =
        incoming?.call?._id;

      socket?.emit(
        "call:reject",
        {
          to:
            remoteId,
          callId,
        }
      );

      setIncoming(
        null
      );

      setStatus(
        "idle"
      );
    };

  // =========================================================
  // END CALL
  // =========================================================

  const endCall =
    () => {
      const socket =
        getSocket();

      const remoteId =
        remoteUserRef.current;

      const callId =
        call?._id ||
        currentCallIdRef.current;

      console.log(
        "☎️ END CALL",
        {
          remoteId,
          callId,
        }
      );

      socket?.emit(
        "call:end",
        {
          to:
            remoteId,
          callId,
        }
      );

      closeMedia();
    };

  // =========================================================
  // MUTE
  // =========================================================

  const toggleMute =
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        console.warn(
          "⚠️ No local stream"
        );
        return;
      }

      const tracks =
        stream.getAudioTracks();

      if (!tracks.length) {
        console.warn(
          "⚠️ No microphone track"
        );
        return;
      }

      const currentEnabled =
        tracks[0].enabled;

      const nextEnabled =
        !currentEnabled;

      tracks.forEach(
        (track) => {
          track.enabled =
            nextEnabled;
        }
      );

      setMuted(
        !nextEnabled
      );

      console.log(
        nextEnabled
          ? "🎤 MICROPHONE ON"
          : "🔇 MICROPHONE OFF"
      );
    };

  // =========================================================
  // CAMERA
  // =========================================================

  const toggleCamera =
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        return;
      }

      const tracks =
        stream.getVideoTracks();

      if (!tracks.length) {
        return;
      }

      const currentEnabled =
        tracks[0].enabled;

      const nextEnabled =
        !currentEnabled;

      tracks.forEach(
        (track) => {
          track.enabled =
            nextEnabled;
        }
      );

      setCameraOff(
        !nextEnabled
      );

      console.log(
        nextEnabled
          ? "📷 CAMERA ON"
          : "📷 CAMERA OFF"
      );
    };

  // =========================================================
  // SOCKET EVENTS
  // =========================================================

  useEffect(() => {
    const socket =
      getSocket();

    if (!socket || !currentUser) {
      return;
    }

    // =======================================================
    // INCOMING CALL
    // =======================================================

    const onRing =
      (payload) => {
        console.log(
          "📞 INCOMING CALL:",
          payload
        );

        setIncoming(
          payload
        );

        setStatus(
          "ringing"
        );
      };

    // =======================================================
    // OFFER
    // =======================================================

    const onOffer =
      async ({
        offer,
        from,
        callId,
        type,
      }) => {
        try {
          console.log(
            "📥 OFFER RECEIVED",
            {
              from,
              callId,
              type,
            }
          );

          remoteUserRef.current =
            from;

          currentCallIdRef.current =
            callId;

          // =================================================
          // REUSE PEER CREATED BY ACCEPT CALL
          // =================================================

          let peer =
            peerRef.current;

          if (!peer) {
            console.log(
              "🆕 Creating peer from offer"
            );

            const stream =
              await getMedia(
                type
              );

            peer =
              createPeer(
                from,
                callId
              );

            stream
              .getTracks()
              .forEach(
                (track) => {
                  peer.addTrack(
                    track,
                    stream
                  );
                }
              );
          } else {
            console.log(
              "♻️ Reusing existing peer"
            );
          }

          // =================================================
          // SET REMOTE DESCRIPTION
          // =================================================

          await peer.setRemoteDescription(
            new RTCSessionDescription(
              offer
            )
          );

          console.log(
            "✅ Remote description set"
          );

          // =================================================
          // ADD QUEUED ICE
          // =================================================

          await addPendingCandidates(
            peer
          );

          // =================================================
          // CREATE ANSWER
          // =================================================

          const answer =
            await peer.createAnswer();

          await peer.setLocalDescription(
            answer
          );

          console.log(
            "📤 Sending ANSWER"
          );

          socket.emit(
            "webrtc:answer",
            {
              to:
                from,

              answer,

              callId,
            }
          );

          setCall(
            (existing) =>
              existing || {
                _id:
                  callId,

                type:
                  type,
              }
          );

          // =================================================
          // ACCEPTED / CONNECTED UI
          // =================================================

          setStatus(
            "connected"
          );

          setIncoming(
            null
          );

          console.log(
            "✅ CALL CONNECTED"
          );
        } catch (err) {
          console.error(
            "❌ Offer handling failed:",
            err
          );

          setStatus(
            "failed"
          );

          setError(
            err.message ||
              "Could not accept the call."
          );
        }
      };

    // =======================================================
    // ANSWER
    // =======================================================

    const onAnswer =
      async ({
        answer,
      }) => {
        try {
          const peer =
            peerRef.current;

          if (!peer) {
            console.warn(
              "⚠️ No peer for answer"
            );
            return;
          }

          console.log(
            "📥 ANSWER RECEIVED"
          );

          await peer.setRemoteDescription(
            new RTCSessionDescription(
              answer
            )
          );

          console.log(
            "✅ Answer remote description set"
          );

          await addPendingCandidates(
            peer
          );

          // =================================================
          // CALLER ALSO SHOW CONNECTED
          // =================================================

          setStatus(
            "connected"
          );

          console.log(
            "✅ CALL CONNECTED"
          );
        } catch (err) {
          console.error(
            "❌ Answer handling failed:",
            err
          );

          setStatus(
            "failed"
          );

          setError(
            "Could not complete WebRTC connection."
          );
        }
      };

    // =======================================================
    // ICE
    // =======================================================

    const onCandidate =
      async ({
        candidate,
      }) => {
        try {
          if (!candidate) {
            return;
          }

          const peer =
            peerRef.current;

          // -------------------------------------------------
          // Remote description not ready
          // -------------------------------------------------

          if (
            !peer ||
            !peer.remoteDescription
          ) {
            console.log(
              "🧊 Queueing ICE candidate"
            );

            pendingCandidatesRef.current.push(
              candidate
            );

            return;
          }

          await peer.addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );

          console.log(
            "✅ ICE candidate added"
          );
        } catch (err) {
          console.error(
            "❌ ICE error:",
            err
          );
        }
      };

    // =======================================================
    // REMOTE END
    // =======================================================

    const onEnd =
      () => {
        console.log(
          "☎️ Remote ended call"
        );

        closeMedia();
      };

    // =======================================================
    // REMOTE REJECT
    // =======================================================

    const onReject =
      () => {
        console.log(
          "❌ Remote rejected call"
        );

        closeMedia();
      };

    // =======================================================
    // REGISTER
    // =======================================================

    socket.on(
      "call:ring",
      onRing
    );

    socket.on(
      "webrtc:offer",
      onOffer
    );

    socket.on(
      "webrtc:answer",
      onAnswer
    );

    socket.on(
      "webrtc:ice-candidate",
      onCandidate
    );

    socket.on(
      "call:end",
      onEnd
    );

    socket.on(
      "call:reject",
      onReject
    );

    // =======================================================
    // CLEANUP
    // =======================================================

    return () => {
      socket.off(
        "call:ring",
        onRing
      );

      socket.off(
        "webrtc:offer",
        onOffer
      );

      socket.off(
        "webrtc:answer",
        onAnswer
      );

      socket.off(
        "webrtc:ice-candidate",
        onCandidate
      );

      socket.off(
        "call:end",
        onEnd
      );

      socket.off(
        "call:reject",
        onReject
      );
    };
  }, [
    closeMedia,
    createPeer,
    currentUser,
    getMedia,
    addPendingCandidates,
  ]);

  // =========================================================
  // RETURN
  // =========================================================

  return {
    call,
    incoming,
    status,
    muted,
    cameraOff,
    error,

    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,

    // Useful if needed elsewhere
    localStream:
      localStreamRef.current,

    startCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMute,
    toggleCamera,
  };
}


