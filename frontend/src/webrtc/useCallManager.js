
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
  const [status, setStatus] = useState("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // IMPORTANT: separate audio element for voice calls
  const remoteAudioRef = useRef(null);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const remoteUserRef = useRef(null);
  const currentCallIdRef = useRef(null);

  // ICE candidates can arrive before remote description
  const pendingCandidatesRef = useRef([]);

  // -----------------------------------------
  // Close media
  // -----------------------------------------

  const closeMedia = useCallback(() => {
    try {
      peerRef.current?.close();
    } catch (err) {
      console.error("Peer close error:", err);
    }

    peerRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingCandidatesRef.current = [];

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
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

  // -----------------------------------------
  // Get microphone / camera
  // -----------------------------------------

  const getMedia = useCallback(async (type = "voice") => {
    setError("");

    if (!navigator.mediaDevices) {
      const message =
        "Microphone/camera is not available. Open the app using localhost or HTTPS.";

      console.error(message);
      setError(message);
      throw new Error(message);
    }

    if (!navigator.mediaDevices.getUserMedia) {
      const message =
        "Your browser does not support microphone/camera access.";

      console.error(message);
      setError(message);
      throw new Error(message);
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        type === "video"
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
    };

    try {
      console.log("Requesting media:", constraints);

      const stream =
        await navigator.mediaDevices.getUserMedia(constraints);

      console.log("Media permission granted");

      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;

        console.log("Local audio track:", {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
        });
      });

      stream.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });

      localStreamRef.current = stream;

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.autoplay = true;
        localVideoRef.current.playsInline = true;

        try {
          await localVideoRef.current.play();
        } catch (err) {
          console.warn("Local video autoplay failed:", err);
        }
      }

      return stream;
    } catch (err) {
      console.error("getUserMedia failed:", err);

      let message = "Could not access microphone/camera.";

      if (err.name === "NotAllowedError") {
        message =
          "Microphone/camera permission was denied. Please allow permission in browser settings.";
      } else if (err.name === "NotFoundError") {
        message =
          "No microphone or camera was found on this device.";
      } else if (err.name === "NotReadableError") {
        message =
          "Microphone/camera is already being used by another application.";
      } else if (err.name === "SecurityError") {
        message =
          "Camera/microphone access is blocked because the connection is not secure.";
      }

      setError(message);
      throw new Error(message);
    }
  }, []);

  // -----------------------------------------
  // Play remote audio
  // -----------------------------------------

  const playRemoteAudio = useCallback(async (stream) => {
    if (!remoteAudioRef.current || !stream) {
      console.warn("Remote audio element or stream missing");
      return;
    }

    const audio = remoteAudioRef.current;

    audio.srcObject = stream;
    audio.autoplay = true;
    audio.controls = false;
    audio.muted = false;
    audio.volume = 1;

    console.log("Remote audio stream attached", {
      audioTracks: stream.getAudioTracks().length,
      tracks: stream.getTracks().map((track) => ({
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        label: track.label,
      })),
    });

    try {
      await audio.play();
      console.log("Remote audio PLAYING");
    } catch (err) {
      console.error("Remote audio play failed:", err);
      setError(
        "Remote audio was blocked by the browser. Click the call screen and try again."
      );
    }
  }, []);

  // -----------------------------------------
  // Create WebRTC peer
  // -----------------------------------------

  const createPeer = useCallback(
    (targetUserId, callId = null) => {
      const socket = getSocket();

      const peer = new RTCPeerConnection({
        iceServers,
      });

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;

        socket?.emit("webrtc:ice-candidate", {
          to: targetUserId,
          candidate: event.candidate,
          callId:
            callId ||
            currentCallIdRef.current,
        });
      };

      // -----------------------------------------
      // REMOTE TRACK
      // -----------------------------------------

      peer.ontrack = async (event) => {
        console.log("Remote track received:", {
          kind: event.track.kind,
          enabled: event.track.enabled,
          muted: event.track.muted,
          readyState: event.track.readyState,
        });

        const stream =
          event.streams?.[0] ||
          remoteStreamRef.current ||
          new MediaStream();

        if (!event.streams?.[0]) {
          stream.addTrack(event.track);
        }

        remoteStreamRef.current = stream;

        const hasAudio =
          stream.getAudioTracks().length > 0;

        const hasVideo =
          stream.getVideoTracks().length > 0;

        console.log("Remote stream:", {
          hasAudio,
          hasVideo,
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
        });

        // AUDIO
        if (hasAudio && remoteAudioRef.current) {
          await playRemoteAudio(stream);
        }

        // VIDEO
        if (hasVideo && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.autoplay = true;
          remoteVideoRef.current.playsInline = true;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1;

          try {
            await remoteVideoRef.current.play();
            console.log("Remote video PLAYING");
          } catch (err) {
            console.error(
              "Remote video play failed:",
              err
            );
          }
        }
      };

      peer.onconnectionstatechange = () => {
        console.log(
          "WebRTC connection:",
          peer.connectionState
        );

        if (peer.connectionState === "connected") {
          setStatus("connected");
        }

        if (peer.connectionState === "failed") {
          console.error("WebRTC connection FAILED");
          setStatus("failed");
        }

        if (peer.connectionState === "disconnected") {
          console.warn(
            "WebRTC temporarily disconnected"
          );
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log(
          "ICE connection:",
          peer.iceConnectionState
        );
      };

      peerRef.current = peer;

      return peer;
    },
    [call?._id, playRemoteAudio]
  );

  // -----------------------------------------
  // Add pending ICE candidates
  // -----------------------------------------

  const addPendingCandidates = useCallback(async (peer) => {
    if (!peer.remoteDescription) return;

    const candidates = pendingCandidatesRef.current;

    pendingCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (err) {
        console.error(
          "Pending ICE candidate error:",
          err
        );
      }
    }
  }, []);

  // -----------------------------------------
  // Start call
  // -----------------------------------------

  const startCall = async ({
    receiver,
    type = "voice",
    conversationId,
  }) => {
    try {
      setError("");

      const socket = getSocket();

      if (!socket) {
        setError(
          "Socket connection is not available."
        );
        return;
      }

      if (!receiver?._id) {
        setError(
          "Receiver information is missing."
        );
        return;
      }

      console.log("Starting call:", {
        receiver: receiver._id,
        type,
        conversationId,
      });

      remoteUserRef.current =
        receiver._id;

      const stream =
        await getMedia(type);

      const peer = createPeer(
        receiver._id
      );

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      socket.emit(
        "call:initiate",
        {
          receiver: receiver._id,
          participants: [receiver._id],
          type,
          conversationId,
        },
        async (ack) => {
          try {
            if (!ack?.ok) {
              setStatus("failed");
              setError(
                ack?.message ||
                "Could not start call."
              );
              return;
            }

            setCall(ack.call);

            currentCallIdRef.current =
              ack.call._id;

            setStatus("calling");

            const offer =
              await peer.createOffer();

            await peer.setLocalDescription(
              offer
            );

            socket.emit(
              "webrtc:offer",
              {
                to: receiver._id,
                offer,
                callId: ack.call._id,
                type,
              }
            );
          } catch (err) {
            console.error(
              "Offer creation failed:",
              err
            );

            setStatus("failed");
            setError(
              "Could not establish the call."
            );
          }
        }
      );
    } catch (err) {
      console.error(
        "Start call failed:",
        err
      );

      setStatus("failed");
      setError(
        err.message ||
        "Could not access microphone/camera."
      );
    }
  };

  // -----------------------------------------
  // Accept call
  // -----------------------------------------

  const acceptCall = async () => {
    if (!incoming) return;

    try {
      setError("");

      const socket = getSocket();

      const remoteId =
        incoming.from?._id ||
        incoming.from;

      const type =
        incoming.call?.type ||
        "voice";

      remoteUserRef.current =
        remoteId;

      const stream =
        await getMedia(type);

      const peer = createPeer(
        remoteId,
        incoming.call?._id
      );

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      setCall(incoming.call);

      currentCallIdRef.current =
        incoming.call?._id;

      setStatus("connecting");

      socket?.emit("call:accept", {
        to: remoteId,
        callId: incoming.call?._id,
      });

      // Browser user gesture:
      // try to start remote audio immediately
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;

        try {
          await remoteAudioRef.current.play();
        } catch (err) {
          console.log(
            "Audio will start when remote track arrives."
          );
        }
      }

      setIncoming(null);
    } catch (err) {
      console.error(
        "Accept call failed:",
        err
      );

      setStatus("failed");

      setError(
        err.message ||
        "Could not access microphone/camera."
      );
    }
  };

  // -----------------------------------------
  // Reject call
  // -----------------------------------------

  const rejectCall = () => {
    const socket = getSocket();

    const remoteId =
      incoming?.from?._id ||
      incoming?.from;

    const callId =
      incoming?.call?._id;

    socket?.emit("call:reject", {
      to: remoteId,
      callId,
    });

    setIncoming(null);
    setStatus("idle");
  };

  // -----------------------------------------
  // End call
  // -----------------------------------------

  const endCall = () => {
    const socket = getSocket();

    socket?.emit("call:end", {
      to: remoteUserRef.current,
      callId:
        call?._id ||
        currentCallIdRef.current,
    });

    closeMedia();
  };

  // -----------------------------------------
  // Mute
  // -----------------------------------------

  const toggleMute = () => {
    const tracks =
      localStreamRef.current?.getAudioTracks();

    if (!tracks?.length) return;

    const nextEnabled =
      !tracks[0].enabled;

    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    setMuted(!nextEnabled);

    console.log(
      "Microphone:",
      nextEnabled ? "ON" : "OFF"
    );
  };

  // -----------------------------------------
  // Camera
  // -----------------------------------------

  const toggleCamera = () => {
    const tracks =
      localStreamRef.current?.getVideoTracks();

    if (!tracks?.length) return;

    const nextEnabled =
      !tracks[0].enabled;

    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    setCameraOff(!nextEnabled);
  };

  // -----------------------------------------
  // Socket events
  // -----------------------------------------

  useEffect(() => {
    const socket = getSocket();

    if (!socket || !currentUser) {
      return;
    }

    // Incoming ring
    const onRing = (payload) => {
      console.log(
        "Incoming call:",
        payload
      );

      setIncoming(payload);
      setStatus("ringing");
    };

    // -----------------------------------------
    // Offer
    // -----------------------------------------

    const onOffer = async ({
      offer,
      from,
      callId,
      type,
    }) => {
      try {
        console.log(
          "WebRTC offer received"
        );

        remoteUserRef.current = from;
        currentCallIdRef.current =
          callId;

        const stream =
          await getMedia(type);

        const peer = createPeer(
          from,
          callId
        );

        stream.getTracks().forEach(
          (track) => {
            peer.addTrack(
              track,
              stream
            );
          }
        );

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            offer
          )
        );

        await addPendingCandidates(peer);

        const answer =
          await peer.createAnswer();

        await peer.setLocalDescription(
          answer
        );

        socket.emit(
          "webrtc:answer",
          {
            to: from,
            answer,
            callId,
          }
        );

        setCall((existing) =>
          existing || {
            _id: callId,
            type,
          }
        );

        setStatus("connecting");

        setIncoming(null);
      } catch (err) {
        console.error(
          "Offer handling failed:",
          err
        );

        setStatus("failed");

        setError(
          err.message ||
          "Could not accept the call."
        );
      }
    };

    // -----------------------------------------
    // Answer
    // -----------------------------------------

    const onAnswer = async ({
      answer,
    }) => {
      try {
        if (!peerRef.current) {
          console.warn(
            "No peer available for answer"
          );
          return;
        }

        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(
            answer
          )
        );

        await addPendingCandidates(
          peerRef.current
        );

        setStatus("connecting");
      } catch (err) {
        console.error(
          "Answer handling failed:",
          err
        );

        setStatus("failed");
      }
    };

    // -----------------------------------------
    // ICE candidate
    // -----------------------------------------

    const onCandidate = async ({
      candidate,
    }) => {
      try {
        if (!candidate) return;

        const peer =
          peerRef.current;

        if (
          !peer ||
          !peer.remoteDescription
        ) {
          pendingCandidatesRef.current.push(
            candidate
          );

          console.log(
            "ICE candidate queued"
          );

          return;
        }

        await peer.addIceCandidate(
          new RTCIceCandidate(candidate)
        );

        console.log(
          "ICE candidate added"
        );
      } catch (err) {
        console.error(
          "ICE candidate error:",
          err
        );
      }
    };

    // -----------------------------------------
    // Call ended
    // -----------------------------------------

    const onEnd = () => {
      console.log(
        "Remote ended call"
      );

      closeMedia();
    };

    // -----------------------------------------
    // Call rejected
    // -----------------------------------------

    const onReject = () => {
      console.log(
        "Remote rejected call"
      );

      closeMedia();
    };

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

  return {
    call,
    incoming,
    status,
    muted,
    cameraOff,
    error,

    localVideoRef,
    remoteVideoRef,

    // IMPORTANT
    remoteAudioRef,

    startCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMute,
    toggleCamera,
  };
}

