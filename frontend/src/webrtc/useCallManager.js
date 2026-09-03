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

  // --------------------------------------------------
  // Refs
  // --------------------------------------------------

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // IMPORTANT: remote audio
  const remoteAudioRef = useRef(null);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const remoteUserRef = useRef(null);
  const currentCallIdRef = useRef(null);

  // ICE candidates can arrive before remote description
  const pendingCandidatesRef = useRef([]);

  // --------------------------------------------------
  // Close everything
  // --------------------------------------------------

  const closeMedia = useCallback(() => {
    console.log("Closing call...");

    try {
      if (peerRef.current) {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
      }
    } catch (err) {
      console.error("Peer close error:", err);
    }

    peerRef.current = null;

    // Stop local tracks
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

    // Clear local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // Clear remote video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Clear remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;

    remoteUserRef.current = null;
    currentCallIdRef.current = null;

    pendingCandidatesRef.current = [];

    setStatus("idle");
    setCall(null);
    setIncoming(null);
    setMuted(false);
    setCameraOff(false);
  }, []);

  // --------------------------------------------------
  // Get microphone / camera
  // --------------------------------------------------

  const getMedia = useCallback(async (type = "voice") => {
    setError("");

    if (!navigator.mediaDevices) {
      const message =
        "Microphone/camera is not available. Please use HTTPS or localhost.";

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
      video: type === "video",
    };

    try {
      console.log("Requesting media:", constraints);

      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );

      console.log(
        "Media permission granted:",
        stream.getTracks().map((track) => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
        }))
      );

      localStreamRef.current = stream;

      // Local video only for video call
      if (
        type === "video" &&
        localVideoRef.current
      ) {
        localVideoRef.current.srcObject = stream;

        try {
          await localVideoRef.current.play();
        } catch (err) {
          console.log(
            "Local video autoplay:",
            err
          );
        }
      }

      return stream;
    } catch (err) {
      console.error(
        "getUserMedia failed:",
        err
      );

      let message =
        "Could not access microphone/camera.";

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

  // --------------------------------------------------
  // Attach remote stream
  // --------------------------------------------------

  const attachRemoteStream = useCallback((stream) => {
    if (!stream) return;

    console.log(
      "REMOTE STREAM:",
      stream.getTracks().map((track) => ({
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      }))
    );

    remoteStreamRef.current = stream;

    // ----------------------------
    // Remote video
    // ----------------------------

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;

      remoteVideoRef.current
        .play()
        .then(() => {
          console.log(
            "Remote video playing"
          );
        })
        .catch((err) => {
          console.log(
            "Remote video play:",
            err
          );
        });
    }

    // ----------------------------
    // Remote audio
    // ----------------------------

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject =
        stream;

      remoteAudioRef.current
        .play()
        .then(() => {
          console.log(
            "Remote audio playing"
          );
        })
        .catch((err) => {
          console.error(
            "Remote audio play failed:",
            err
          );
        });
    }
  }, []);

  // --------------------------------------------------
  // Create peer connection
  // --------------------------------------------------

  const createPeer = useCallback(
    (targetUserId, callId = null) => {
      const socket = getSocket();

      console.log(
        "Creating RTCPeerConnection:",
        {
          targetUserId,
          callId,
        }
      );

      const peer =
        new RTCPeerConnection({
          iceServers,
        });

      // ------------------------------------------------
      // ICE
      // ------------------------------------------------

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;

        console.log(
          "Sending ICE candidate"
        );

        socket?.emit(
          "webrtc:ice-candidate",
          {
            to: targetUserId,
            candidate: event.candidate,
            callId:
              callId ||
              currentCallIdRef.current,
          }
        );
      };

      // ------------------------------------------------
      // Remote tracks
      // ------------------------------------------------

      peer.ontrack = (event) => {
        console.log(
          "REMOTE TRACK RECEIVED:",
          event.track.kind
        );

        let stream =
          event.streams?.[0];

        // Fallback
        if (!stream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current =
              new MediaStream();
          }

          const alreadyAdded =
            remoteStreamRef.current
              .getTracks()
              .some(
                (track) =>
                  track.id ===
                  event.track.id
              );

          if (!alreadyAdded) {
            remoteStreamRef.current.addTrack(
              event.track
            );
          }

          stream =
            remoteStreamRef.current;
        }

        attachRemoteStream(stream);
      };

      // ------------------------------------------------
      // Connection state
      // ------------------------------------------------

      peer.onconnectionstatechange = () => {
        console.log(
          "WebRTC connection:",
          peer.connectionState
        );

        if (
          peer.connectionState ===
          "connected"
        ) {
          setStatus("connected");
        }

        if (
          peer.connectionState ===
          "failed"
        ) {
          console.error(
            "WebRTC connection failed"
          );

          setStatus("failed");
          setError(
            "WebRTC connection failed."
          );
        }
      };

      // ------------------------------------------------
      // ICE connection state
      // ------------------------------------------------

      peer.oniceconnectionstatechange =
        () => {
          console.log(
            "ICE connection:",
            peer.iceConnectionState
          );

          if (
            peer.iceConnectionState ===
            "failed"
          ) {
            console.error(
              "ICE connection failed"
            );
          }
        };

      peerRef.current = peer;

      return peer;
    },
    [attachRemoteStream]
  );

  // --------------------------------------------------
  // Start call
  // --------------------------------------------------

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

      console.log(
        "STARTING CALL:",
        {
          receiver: receiver._id,
          type,
          conversationId,
        }
      );

      remoteUserRef.current =
        receiver._id;

      // --------------------------------------------
      // Get caller microphone/camera
      // --------------------------------------------

      const stream =
        await getMedia(type);

      // --------------------------------------------
      // Create peer
      // --------------------------------------------

      const peer =
        createPeer(
          receiver._id
        );

      // --------------------------------------------
      // Add local tracks
      // --------------------------------------------

      stream
        .getTracks()
        .forEach((track) => {
          console.log(
            "Adding caller track:",
            track.kind
          );

          peer.addTrack(
            track,
            stream
          );
        });

      // --------------------------------------------
      // Create call
      // --------------------------------------------

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
            console.log(
              "Call initiate ACK:",
              ack
            );

            if (!ack?.ok) {
              setStatus("failed");

              setError(
                ack?.message ||
                  "Could not start call."
              );

              return;
            }

            // Save call
            setCall(ack.call);

            currentCallIdRef.current =
              ack.call._id;

            setStatus("calling");

            // --------------------------------------
            // Create OFFER
            // --------------------------------------

            const offer =
              await peer.createOffer();

            await peer.setLocalDescription(
              offer
            );

            console.log(
              "Sending OFFER..."
            );

            socket.emit(
              "webrtc:offer",
              {
                to: receiver._id,
                offer,
                callId:
                  ack.call._id,
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

  // --------------------------------------------------
  // Accept incoming call
  // --------------------------------------------------

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

      const callId =
        incoming.call?._id;

      console.log(
        "ACCEPTING CALL:",
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

      /*
       IMPORTANT:

       Do NOT create peer here.

       Do NOT get media here.

       The caller's OFFER will arrive
       through webrtc:offer.

       Then onOffer() will:
       - get mic/camera
       - create peer
       - add tracks
       - set offer
       - create answer
      */

      setCall(incoming.call);

      setStatus("connecting");

      socket?.emit(
        "call:accept",
        {
          to: remoteId,
          callId,
        }
      );

      // Remove incoming screen
      setIncoming(null);

      console.log(
        "Call accepted. Waiting for OFFER..."
      );
    } catch (err) {
      console.error(
        "Accept call failed:",
        err
      );

      setStatus("failed");

      setError(
        err.message ||
          "Could not accept the call."
      );
    }
  };

  // --------------------------------------------------
  // Reject call
  // --------------------------------------------------

  const rejectCall = () => {
    const socket = getSocket();

    const remoteId =
      incoming?.from?._id ||
      incoming?.from;

    const callId =
      incoming?.call?._id;

    console.log(
      "Rejecting call:",
      {
        remoteId,
        callId,
      }
    );

    socket?.emit(
      "call:reject",
      {
        to: remoteId,
        callId,
      }
    );

    setIncoming(null);
    setStatus("idle");
  };

  // --------------------------------------------------
  // End call
  // --------------------------------------------------

  const endCall = () => {
    const socket = getSocket();

    console.log(
      "Ending call"
    );

    socket?.emit(
      "call:end",
      {
        to:
          remoteUserRef.current,

        callId:
          call?._id ||
          currentCallIdRef.current,
      }
    );

    closeMedia();
  };

  // --------------------------------------------------
  // Toggle microphone
  // --------------------------------------------------

  const toggleMute = () => {
    const tracks =
      localStreamRef.current?.getAudioTracks();

    if (!tracks?.length) {
      console.log(
        "No audio track found"
      );
      return;
    }

    const newMuted =
      !muted;

    tracks.forEach(
      (track) => {
        track.enabled =
          !newMuted;
      }
    );

    setMuted(newMuted);

    console.log(
      "Microphone:",
      newMuted
        ? "OFF"
        : "ON"
    );
  };

  // --------------------------------------------------
  // Toggle camera
  // --------------------------------------------------

  const toggleCamera = () => {
    const tracks =
      localStreamRef.current?.getVideoTracks();

    if (!tracks?.length) {
      console.log(
        "No video track found"
      );
      return;
    }

    const newCameraOff =
      !cameraOff;

    tracks.forEach(
      (track) => {
        track.enabled =
          !newCameraOff;
      }
    );

    setCameraOff(
      newCameraOff
    );
  };

  // --------------------------------------------------
  // Socket events
  // --------------------------------------------------

  useEffect(() => {
    const socket =
      getSocket();

    if (
      !socket ||
      !currentUser
    ) {
      return;
    }

    // =================================================
    // Incoming call
    // =================================================

    const onRing = (
      payload
    ) => {
      console.log(
        "INCOMING CALL:",
        payload
      );

      setIncoming(
        payload
      );

      setStatus(
        "ringing"
      );
    };

    // =================================================
    // OFFER
    // =================================================

    const onOffer = async ({
      offer,
      from,
      callId,
      type,
    }) => {
      try {
        console.log(
          "WEBRTC OFFER RECEIVED:",
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

        // --------------------------------------------
        // Get receiver microphone/camera
        // --------------------------------------------

        const stream =
          await getMedia(
            type
          );

        // --------------------------------------------
        // Create receiver peer
        // --------------------------------------------

        const peer =
          createPeer(
            from,
            callId
          );

        // --------------------------------------------
        // Add receiver tracks
        // --------------------------------------------

        stream
          .getTracks()
          .forEach(
            (track) => {
              console.log(
                "Adding receiver track:",
                track.kind
              );

              peer.addTrack(
                track,
                stream
              );
            }
          );

        // --------------------------------------------
        // Set caller OFFER
        // --------------------------------------------

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            offer
          )
        );

        console.log(
          "Remote description set"
        );

        // --------------------------------------------
        // Add queued ICE candidates
        // --------------------------------------------

        if (
          pendingCandidatesRef.current
            .length
        ) {
          console.log(
            "Adding queued ICE candidates:",
            pendingCandidatesRef.current.length
          );

          for (
            const candidate of
              pendingCandidatesRef.current
          ) {
            try {
              await peer.addIceCandidate(
                new RTCIceCandidate(
                  candidate
                )
              );
            } catch (err) {
              console.error(
                "Queued ICE error:",
                err
              );
            }
          }

          pendingCandidatesRef.current =
            [];
        }

        // --------------------------------------------
        // Create ANSWER
        // --------------------------------------------

        const answer =
          await peer.createAnswer();

        await peer.setLocalDescription(
          answer
        );

        console.log(
          "Sending ANSWER..."
        );

        socket.emit(
          "webrtc:answer",
          {
            to: from,
            answer,
            callId,
          }
        );

        setCall(
          (existing) =>
            existing || {
              _id: callId,
              type,
            }
        );

        setStatus(
          "connecting"
        );

        setIncoming(
          null
        );
      } catch (err) {
        console.error(
          "Offer handling failed:",
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

    // =================================================
    // ANSWER
    // =================================================

    const onAnswer = async ({
      answer,
    }) => {
      try {
        const peer =
          peerRef.current;

        if (!peer) {
          console.error(
            "No peer found for answer"
          );
          return;
        }

        console.log(
          "WEBRTC ANSWER RECEIVED"
        );

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            answer
          )
        );

        // --------------------------------------------
        // Add queued ICE
        // --------------------------------------------

        if (
          pendingCandidatesRef.current
            .length
        ) {
          console.log(
            "Adding queued ICE:",
            pendingCandidatesRef.current.length
          );

          for (
            const candidate of
              pendingCandidatesRef.current
          ) {
            try {
              await peer.addIceCandidate(
                new RTCIceCandidate(
                  candidate
                )
              );
            } catch (err) {
              console.error(
                "Queued ICE error:",
                err
              );
            }
          }

          pendingCandidatesRef.current =
            [];
        }

        console.log(
          "Answer applied successfully"
        );

        setStatus(
          "connecting"
        );
      } catch (err) {
        console.error(
          "Answer handling failed:",
          err
        );

        setStatus(
          "failed"
        );

        setError(
          "Could not establish remote connection."
        );
      }
    };

    // =================================================
    // ICE CANDIDATE
    // =================================================

    const onCandidate = async ({
      candidate,
    }) => {
      try {
        if (!candidate) return;

        const peer =
          peerRef.current;

        /*
         ICE can arrive before
         remoteDescription.
        */

        if (
          !peer ||
          !peer.remoteDescription
        ) {
          console.log(
            "Queueing ICE candidate"
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
          "ICE candidate added"
        );
      } catch (err) {
        console.error(
          "ICE candidate error:",
          err
        );
      }
    };

    // =================================================
    // Remote end call
    // =================================================

    const onEnd = () => {
      console.log(
        "REMOTE ENDED CALL"
      );

      closeMedia();
    };

    // =================================================
    // Remote rejected call
    // =================================================

    const onReject = () => {
      console.log(
        "CALL REJECTED"
      );

      closeMedia();
    };

    // =================================================
    // Register events
    // =================================================

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

    // =================================================
    // Cleanup
    // =================================================

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

  // --------------------------------------------------
  // Return manager
  // --------------------------------------------------

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
