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
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserRef = useRef(null);
  const currentCallIdRef = useRef(null);

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

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
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

    // Browser support check
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
      audio: true,
      video: type === "video",
    };

    try {
      console.log("Requesting media:", constraints);

      const stream =
        await navigator.mediaDevices.getUserMedia(constraints);

      console.log("Media permission granted");

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
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
            currentCallIdRef.current ||
            call?._id,
        });
      };

      peer.ontrack = (event) => {
        console.log("Remote track received");

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject =
            event.streams[0];
        }
      };

      peer.onconnectionstatechange = () => {
        console.log(
          "WebRTC connection:",
          peer.connectionState
        );

        if (
          peer.connectionState === "connected"
        ) {
          setStatus("connected");
        }

        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "disconnected" ||
          peer.connectionState === "closed"
        ) {
          // Don't immediately close on disconnected because
          // WebRTC can recover.
          if (peer.connectionState === "failed") {
            setStatus("failed");
          }
        }
      };

      peerRef.current = peer;

      return peer;
    },
    [call?._id]
  );

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
        setError("Socket connection is not available.");
        return;
      }

      if (!receiver?._id) {
        setError("Receiver information is missing.");
        return;
      }

      console.log("Starting call:", {
        receiver: receiver._id,
        type,
        conversationId,
      });

      remoteUserRef.current = receiver._id;

      // Get microphone/camera FIRST
      const stream = await getMedia(type);

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

      if (!error) {
        setError(
          err.message ||
          "Could not access microphone/camera."
        );
      }
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
        incoming.call?.type || "voice";

      remoteUserRef.current = remoteId;

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

      setStatus("connected");

      socket?.emit("call:accept", {
        to: remoteId,
        callId: incoming.call?._id,
      });

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

    tracks.forEach((track) => {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    });
  };

  // -----------------------------------------
  // Camera
  // -----------------------------------------

  const toggleCamera = () => {
    const tracks =
      localStreamRef.current?.getVideoTracks();

    if (!tracks?.length) return;

    tracks.forEach((track) => {
      track.enabled = !track.enabled;
      setCameraOff(!track.enabled);
    });
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

    // Offer
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
        currentCallIdRef.current = callId;

        setIncoming((existing) =>
          existing || {
            call: {
              _id: callId,
              type,
            },
            from,
          }
        );

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

        setStatus("connected");
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

    // Answer
    const onAnswer = async ({
      answer,
    }) => {
      try {
        if (!peerRef.current) return;

        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(
            answer
          )
        );

        setStatus("connected");
      } catch (err) {
        console.error(
          "Answer handling failed:",
          err
        );

        setStatus("failed");
      }
    };

    // ICE candidate
    const onCandidate = async ({
      candidate,
    }) => {
      try {
        if (
          candidate &&
          peerRef.current
        ) {
          await peerRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (err) {
        console.error(
          "ICE candidate error:",
          err
        );
      }
    };

    // Call ended
    const onEnd = () => {
      closeMedia();
    };

    // Call rejected
    const onReject = () => {
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

    startCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMute,
    toggleCamera,
  };
}

