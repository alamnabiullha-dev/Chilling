
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../socket/client";

const iceServers = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

export function useCallManager(currentUser) {
  // ==================================================
  // STATE
  // ==================================================

  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);

  const [status, setStatus] = useState("idle");

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const [error, setError] = useState("");

  // IMPORTANT:
  // CallOverlay ko localStream directly dene ke liye state
  const [localStream, setLocalStream] = useState(null);

  // ==================================================
  // REFS
  // ==================================================

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // IMPORTANT:
  // Remote audio isi element mein attach hoga
  const remoteAudioRef = useRef(null);

  const peerRef = useRef(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const remoteUserRef = useRef(null);

  const currentCallIdRef = useRef(null);

  // ICE candidates received before remote description
  const pendingCandidatesRef = useRef([]);

  // Offer received before receiver clicks Accept
  const pendingOfferRef = useRef(null);

  // Receiver has clicked Accept
  const acceptedRef = useRef(false);

  // ==================================================
  // CLOSE MEDIA / PEER
  // ==================================================

  const closeMedia = useCallback(() => {
    console.log("================================");
    console.log("CLOSING CALL");
    console.log("================================");

    // ----------------------------------------------
    // Close peer
    // ----------------------------------------------

    try {
      if (peerRef.current) {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.oniceconnectionstatechange = null;

        peerRef.current.close();
      }
    } catch (err) {
      console.error("Peer close error:", err);
    }

    peerRef.current = null;

    // ----------------------------------------------
    // Stop local media
    // ----------------------------------------------

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
    setLocalStream(null);

    // ----------------------------------------------
    // Clear local video
    // ----------------------------------------------

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // ----------------------------------------------
    // Clear remote video
    // ----------------------------------------------

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // ----------------------------------------------
    // Clear remote audio
    // ----------------------------------------------

    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
      } catch (err) {
        console.log(err);
      }

      remoteAudioRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;

    // ----------------------------------------------
    // Reset refs
    // ----------------------------------------------

    remoteUserRef.current = null;
    currentCallIdRef.current = null;

    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;

    acceptedRef.current = false;

    // ----------------------------------------------
    // Reset state
    // ----------------------------------------------

    setStatus("idle");
    setCall(null);
    setIncoming(null);

    setMuted(false);
    setCameraOff(false);
  }, []);

  // ==================================================
  // GET MICROPHONE / CAMERA
  // ==================================================

  const getMedia = useCallback(async (type = "voice") => {
    setError("");

    if (!navigator.mediaDevices) {
      const message =
        "Microphone/camera is not available. Please use HTTPS or localhost.";

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
      console.log("================================");
      console.log("REQUESTING MEDIA");
      console.log(constraints);
      console.log("================================");

      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );

      console.log(
        "MEDIA GRANTED:",
        stream.getTracks().map((track) => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
        }))
      );

      // Save in ref
      localStreamRef.current = stream;

      // IMPORTANT:
      // Save in state so React UI gets the stream
      setLocalStream(stream);

      // ----------------------------------------------
      // Local video
      // ----------------------------------------------

      if (type === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;

        try {
          await localVideoRef.current.play();
        } catch (err) {
          console.log("Local video play:", err);
        }
      }

      return stream;
    } catch (err) {
      console.error("getUserMedia failed:", err);

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
      } else if (err.name === "OverconstrainedError") {
        message =
          "Camera settings are not supported by this device.";
      }

      setError(message);

      throw new Error(message);
    }
  }, []);

  // ==================================================
  // ATTACH REMOTE STREAM
  // ==================================================

  const attachRemoteStream = useCallback((stream) => {
    if (!stream) return;

    console.log("================================");
    console.log("REMOTE STREAM RECEIVED");
    console.log(
      stream.getTracks().map((track) => ({
        kind: track.kind,
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      }))
    );
    console.log("================================");

    remoteStreamRef.current = stream;

    // =================================================
    // REMOTE VIDEO
    // =================================================

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;

      remoteVideoRef.current
        .play()
        .then(() => {
          console.log("REMOTE VIDEO PLAYING");
        })
        .catch((err) => {
          console.log("Remote video play:", err);
        });
    }

    // =================================================
    // REMOTE AUDIO
    // =================================================

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;

      remoteAudioRef.current
        .play()
        .then(() => {
          console.log("================================");
          console.log("REMOTE AUDIO PLAYING");
          console.log("================================");
        })
        .catch((err) => {
          console.error(
            "REMOTE AUDIO PLAY FAILED:",
            err
          );
        });
    }
  }, []);

  // ==================================================
  // CREATE PEER CONNECTION
  // ==================================================

  const createPeer = useCallback(
    (targetUserId, callId = null) => {
      const socket = getSocket();

      // If an old peer exists, close it first
      if (peerRef.current) {
        try {
          peerRef.current.close();
        } catch (err) {
          console.log("Old peer close:", err);
        }

        peerRef.current = null;
      }

      console.log("================================");
      console.log("CREATING PEER");
      console.log({
        targetUserId,
        callId,
      });
      console.log("================================");

      const peer = new RTCPeerConnection({
        iceServers,
      });

      // =================================================
      // ICE CANDIDATE
      // =================================================

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;

        console.log(
          "SENDING ICE CANDIDATE"
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

      // =================================================
      // REMOTE TRACK
      // =================================================

      peer.ontrack = (event) => {
        console.log("================================");
        console.log(
          "REMOTE TRACK RECEIVED:",
          event.track.kind
        );
        console.log("================================");

        let stream =
          event.streams?.[0];

        // ----------------------------------------------
        // Fallback MediaStream
        // ----------------------------------------------

        if (!stream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current =
              new MediaStream();
          }

          const exists =
            remoteStreamRef.current
              .getTracks()
              .some(
                (track) =>
                  track.id ===
                  event.track.id
              );

          if (!exists) {
            remoteStreamRef.current.addTrack(
              event.track
            );
          }

          stream =
            remoteStreamRef.current;
        }

        // ----------------------------------------------
        // Attach BOTH audio + video
        // ----------------------------------------------

        attachRemoteStream(stream);
      };

      // =================================================
      // CONNECTION STATE
      // =================================================

      peer.onconnectionstatechange = () => {
        console.log(
          "WEBRTC CONNECTION STATE:",
          peer.connectionState
        );

        switch (peer.connectionState) {
          case "connected":
            console.log(
              "================================"
            );
            console.log(
              "CALL CONNECTED"
            );
            console.log(
              "================================"
            );

            setStatus("connected");
            break;

          case "connecting":
            setStatus("connecting");
            break;

          case "disconnected":
            console.log(
              "WebRTC disconnected"
            );
            break;

          case "failed":
            console.error(
              "WEBRTC CONNECTION FAILED"
            );

            setStatus("failed");

            setError(
              "WebRTC connection failed. Please try again."
            );
            break;

          case "closed":
            console.log(
              "WebRTC connection closed"
            );
            break;

          default:
            break;
        }
      };

      // =================================================
      // ICE CONNECTION STATE
      // =================================================

      peer.oniceconnectionstatechange =
        () => {
          console.log(
            "ICE CONNECTION:",
            peer.iceConnectionState
          );

          if (
            peer.iceConnectionState ===
            "failed"
          ) {
            console.error(
              "ICE CONNECTION FAILED"
            );
          }
        };

      peerRef.current = peer;

      return peer;
    },
    [attachRemoteStream]
  );

  // ==================================================
  // HANDLE OFFER
  // ==================================================

  const handleOffer = useCallback(
    async ({
      offer,
      from,
      callId,
      type = "voice",
    }) => {
      try {
        console.log("================================");
        console.log("HANDLING WEBRTC OFFER");
        console.log({
          from,
          callId,
          type,
        });
        console.log("================================");

        remoteUserRef.current = from;

        currentCallIdRef.current =
          callId;

        // =================================================
        // GET RECEIVER MEDIA
        // =================================================

        console.log(
          "Receiver requesting microphone/camera..."
        );

        const stream =
          await getMedia(type);

        // =================================================
        // CREATE RECEIVER PEER
        // =================================================

        const peer =
          createPeer(
            from,
            callId
          );

        // =================================================
        // ADD RECEIVER AUDIO + VIDEO TRACKS
        // =================================================

        stream
          .getTracks()
          .forEach((track) => {
            console.log(
              "ADDING RECEIVER TRACK:",
              track.kind
            );

            peer.addTrack(
              track,
              stream
            );
          });

        // =================================================
        // SET CALLER OFFER
        // =================================================

        console.log(
          "SETTING REMOTE DESCRIPTION..."
        );

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            offer
          )
        );

        console.log(
          "REMOTE DESCRIPTION SET"
        );

        // =================================================
        // ADD QUEUED ICE
        // =================================================

        if (
          pendingCandidatesRef.current
            .length > 0
        ) {
          console.log(
            "ADDING QUEUED ICE:",
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

        // =================================================
        // CREATE ANSWER
        // =================================================

        console.log(
          "CREATING ANSWER..."
        );

        const answer =
          await peer.createAnswer();

        await peer.setLocalDescription(
          answer
        );

        // =================================================
        // SEND ANSWER
        // =================================================

        console.log(
          "SENDING ANSWER..."
        );

        socket?.emit(
          "webrtc:answer",
          {
            to: from,
            answer,
            callId,
          }
        );

        // =================================================
        // UPDATE STATE
        // =================================================

        setCall((existing) => {
          if (existing) {
            return existing;
          }

          return {
            _id: callId,
            type,
          };
        });

        setStatus("connecting");

        setIncoming(null);

        console.log(
          "ANSWER SENT SUCCESSFULLY"
        );
      } catch (err) {
        console.error(
          "HANDLE OFFER FAILED:",
          err
        );

        setStatus("failed");

        setError(
          err.message ||
            "Could not establish the call."
        );
      }
    },
    [createPeer, getMedia]
  );

  // ==================================================
  // START CALL
  // ==================================================

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

      console.log("================================");
      console.log("START CALL");
      console.log({
        receiver: receiver._id,
        type,
        conversationId,
      });
      console.log("================================");

      // =================================================
      // SAVE REMOTE USER
      // =================================================

      remoteUserRef.current =
        receiver._id;

      // =================================================
      // GET CALLER MEDIA
      // =================================================

      const stream =
        await getMedia(type);

      // =================================================
      // CREATE CALLER PEER
      // =================================================

      const peer =
        createPeer(
          receiver._id
        );

      // =================================================
      // ADD CALLER AUDIO + VIDEO
      // =================================================

      stream
        .getTracks()
        .forEach((track) => {
          console.log(
            "ADDING CALLER TRACK:",
            track.kind
          );

          peer.addTrack(
            track,
            stream
          );
        });

      // =================================================
      // INITIATE CALL
      // =================================================

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
              "CALL INITIATE ACK:",
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

            // --------------------------------------------
            // Save call
            // --------------------------------------------

            setCall(ack.call);

            currentCallIdRef.current =
              ack.call._id;

            setStatus("calling");

            // --------------------------------------------
            // Create OFFER
            // --------------------------------------------

            console.log(
              "CREATING OFFER..."
            );

            const offer =
              await peer.createOffer();

            await peer.setLocalDescription(
              offer
            );

            // --------------------------------------------
            // Send OFFER
            // --------------------------------------------

            console.log(
              "SENDING OFFER..."
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

            console.log(
              "OFFER SENT"
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

  // ==================================================
  // ACCEPT CALL
  // ==================================================

  const acceptCall = async () => {
    if (!incoming) return;

    try {
      setError("");

      const socket = getSocket();

      if (!socket) {
        throw new Error(
          "Socket connection is not available."
        );
      }

      const remoteId =
        incoming.from?._id ||
        incoming.from;

      const type =
        incoming.call?.type ||
        "voice";

      const callId =
        incoming.call?._id;

      console.log("================================");
      console.log("ACCEPTING CALL");
      console.log({
        remoteId,
        type,
        callId,
      });
      console.log("================================");

      // =================================================
      // IMPORTANT
      // =================================================
      // Ab receiver ne Accept click kiya hai.
      // Ab offer process ho sakta hai.
      // =================================================

      acceptedRef.current = true;

      remoteUserRef.current =
        remoteId;

      currentCallIdRef.current =
        callId;

      setCall(incoming.call);

      setStatus("connecting");

      // Remove incoming UI
      setIncoming(null);

      // =================================================
      // TELL SERVER CALL ACCEPTED
      // =================================================

      socket.emit(
        "call:accept",
        {
          to: remoteId,
          callId,
        }
      );

      console.log(
        "CALL ACCEPT SENT"
      );

      // =================================================
      // IF OFFER ARRIVED BEFORE ACCEPT
      // PROCESS IT NOW
      // =================================================

      if (pendingOfferRef.current) {
        const pendingOffer =
          pendingOfferRef.current;

        pendingOfferRef.current =
          null;

        console.log(
          "PROCESSING QUEUED OFFER..."
        );

        await handleOffer(
          pendingOffer
        );
      }
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

  // ==================================================
  // REJECT CALL
  // ==================================================

  const rejectCall = () => {
    const socket = getSocket();

    const remoteId =
      incoming?.from?._id ||
      incoming?.from;

    const callId =
      incoming?.call?._id;

    console.log(
      "REJECTING CALL:",
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

    pendingOfferRef.current = null;

    acceptedRef.current = false;

    setIncoming(null);
    setStatus("idle");
  };

  // ==================================================
  // END CALL
  // ==================================================

  const endCall = () => {
    const socket = getSocket();

    console.log(
      "ENDING CALL"
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

  // ==================================================
  // TOGGLE MUTE
  // ==================================================

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

    tracks.forEach((track) => {
      track.enabled =
        !newMuted;
    });

    setMuted(newMuted);

    console.log(
      "MICROPHONE:",
      newMuted
        ? "OFF"
        : "ON"
    );
  };

  // ==================================================
  // TOGGLE CAMERA
  // ==================================================

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

    tracks.forEach((track) => {
      track.enabled =
        !newCameraOff;
    });

    setCameraOff(
      newCameraOff
    );

    console.log(
      "CAMERA:",
      newCameraOff
        ? "OFF"
        : "ON"
    );
  };

  // ==================================================
  // SOCKET EVENTS
  // ==================================================

  useEffect(() => {
    const socket = getSocket();

    if (!socket || !currentUser) {
      return;
    }

    // =================================================
    // INCOMING CALL
    // =================================================

    const onRing = (payload) => {
      console.log("================================");
      console.log("INCOMING CALL");
      console.log(payload);
      console.log("================================");

      acceptedRef.current = false;

      pendingOfferRef.current = null;

      setIncoming(payload);

      setStatus("ringing");
    };

    // =================================================
    // OFFER
    // =================================================

    const onOffer = async (payload) => {
      try {
        console.log("================================");
        console.log("WEBRTC OFFER RECEIVED");
        console.log(payload);
        console.log("================================");

        // =================================================
        // IMPORTANT
        //
        // Receiver ne Accept nahi kiya?
        // Media access nahi karenge.
        // Offer queue kar denge.
        // =================================================

        if (!acceptedRef.current) {
          console.log(
            "Offer received before Accept. Queueing..."
          );

          pendingOfferRef.current =
            payload;

          return;
        }

        await handleOffer(
          payload
        );
      } catch (err) {
        console.error(
          "Offer event failed:",
          err
        );

        setStatus("failed");

        setError(
          err.message ||
            "Could not process call offer."
        );
      }
    };

    // =================================================
    // ANSWER
    // =================================================

    const onAnswer = async ({
      answer,
      callId,
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
          "================================"
        );
        console.log(
          "WEBRTC ANSWER RECEIVED"
        );
        console.log(
          "================================"
        );

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            answer
          )
        );

        // =================================================
        // ADD QUEUED ICE
        // =================================================

        if (
          pendingCandidatesRef.current
            .length > 0
        ) {
          console.log(
            "ADDING QUEUED ICE:",
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

        if (callId) {
          currentCallIdRef.current =
            callId;
        }

        console.log(
          "ANSWER APPLIED SUCCESSFULLY"
        );

        setStatus("connecting");
      } catch (err) {
        console.error(
          "Answer handling failed:",
          err
        );

        setStatus("failed");

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
      callId,
    }) => {
      try {
        if (!candidate) return;

        const peer =
          peerRef.current;

        // Save call ID
        if (
          callId &&
          !currentCallIdRef.current
        ) {
          currentCallIdRef.current =
            callId;
        }

        // =================================================
        // PEER NOT READY OR REMOTE DESCRIPTION NOT READY
        // =================================================

        if (
          !peer ||
          !peer.remoteDescription
        ) {
          console.log(
            "QUEUEING ICE CANDIDATE"
          );

          pendingCandidatesRef.current.push(
            candidate
          );

          return;
        }

        // =================================================
        // ADD ICE
        // =================================================

        await peer.addIceCandidate(
          new RTCIceCandidate(
            candidate
          )
        );

        console.log(
          "ICE CANDIDATE ADDED"
        );
      } catch (err) {
        console.error(
          "ICE candidate error:",
          err
        );
      }
    };

    // =================================================
    // REMOTE END
    // =================================================

    const onEnd = () => {
      console.log(
        "REMOTE ENDED CALL"
      );

      closeMedia();
    };

    // =================================================
    // REMOTE REJECT
    // =================================================

    const onReject = () => {
      console.log(
        "CALL REJECTED"
      );

      closeMedia();
    };

    // =================================================
    // REGISTER EVENTS
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
    // CLEANUP
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
    currentUser,
    closeMedia,
    handleOffer,
  ]);

  // ==================================================
  // ATTACH LOCAL STREAM WHEN VIDEO ELEMENT CHANGES
  // ==================================================

  useEffect(() => {
    if (
      localVideoRef.current &&
      localStream
    ) {
      localVideoRef.current.srcObject =
        localStream;

      localVideoRef.current
        .play()
        .catch(() => {});
    }
  }, [
    localStream,
    cameraOff,
  ]);

  // ==================================================
  // ATTACH REMOTE STREAM WHEN AUDIO ELEMENT CHANGES
  // ==================================================

  useEffect(() => {
    if (
      remoteAudioRef.current &&
      remoteStreamRef.current
    ) {
      remoteAudioRef.current.srcObject =
        remoteStreamRef.current;

      remoteAudioRef.current
        .play()
        .catch((err) => {
          console.log(
            "Remote audio play:",
            err
          );
        });
    }
  }, [
    status,
  ]);

  // ==================================================
  // RETURN
  // ==================================================

  return {
    // ----------------------------------------------
    // State
    // ----------------------------------------------

    call,
    incoming,

    status,

    muted,
    cameraOff,

    error,

    // IMPORTANT
    localStream,

    // ----------------------------------------------
    // Refs
    // ----------------------------------------------

    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,

    // ----------------------------------------------
    // Call functions
    // ----------------------------------------------

    startCall,
    acceptCall,
    rejectCall,
    endCall,

    // ----------------------------------------------
    // Controls
    // ----------------------------------------------

    toggleMute,
    toggleCamera,

    // ----------------------------------------------
    // Extra information
    // ----------------------------------------------

    remoteUser:
      remoteUserRef.current,

    callType:
      call?.type ||
      incoming?.call?.type ||
      "voice",
  };
}

