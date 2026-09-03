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

  const [localStream, setLocalStream] = useState(null);

  // ==================================================
  // REFS
  // ==================================================

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const peerRef = useRef(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const remoteUserRef = useRef(null);

  const currentCallIdRef = useRef(null);

  const pendingCandidatesRef = useRef([]);
  const pendingOfferRef = useRef(null);

  const acceptedRef = useRef(false);

  // ==================================================
  // CLOSE CALL
  // ==================================================

  const closeMedia = useCallback(() => {
    console.log("================================");
    console.log("CLOSING CALL");
    console.log("================================");

    // ----------------------------------------------
    // CLOSE PEER
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
    // STOP LOCAL MEDIA
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
    // CLEAR LOCAL VIDEO
    // ----------------------------------------------

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // ----------------------------------------------
    // CLEAR REMOTE VIDEO
    // ----------------------------------------------

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // ----------------------------------------------
    // CLEAR REMOTE AUDIO
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
    // RESET REFS
    // ----------------------------------------------

    remoteUserRef.current = null;
    currentCallIdRef.current = null;

    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;

    acceptedRef.current = false;

    // ----------------------------------------------
    // RESET STATE
    // ----------------------------------------------

    setStatus("idle");
    setCall(null);
    setIncoming(null);

    setMuted(false);
    setCameraOff(false);
  }, []);

  // ==================================================
  // GET MEDIA
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

      localStreamRef.current = stream;

      setLocalStream(stream);

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

    // ----------------------------------------------
    // REMOTE VIDEO
    // ----------------------------------------------

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

    // ----------------------------------------------
    // REMOTE AUDIO
    // ----------------------------------------------

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
  // CREATE PEER
  // ==================================================

  const createPeer = useCallback(
    (targetUserId, callId) => {
      const socket = getSocket();

      if (!targetUserId) {
        throw new Error("Target user ID is missing.");
      }

      if (!callId) {
        throw new Error(
          "Call ID is missing. Cannot create WebRTC peer."
        );
      }

      // ----------------------------------------------
      // CLOSE OLD PEER
      // ----------------------------------------------

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

      // ----------------------------------------------
      // ICE
      // ----------------------------------------------

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;

        const activeCallId =
          callId || currentCallIdRef.current;

        console.log("SENDING ICE CANDIDATE");

        socket?.emit("webrtc:ice-candidate", {
          to: targetUserId,
          callId: activeCallId,
          candidate: event.candidate,
        });
      };

      // ----------------------------------------------
      // REMOTE TRACK
      // ----------------------------------------------

      peer.ontrack = (event) => {
        console.log("================================");
        console.log(
          "REMOTE TRACK RECEIVED:",
          event.track.kind
        );
        console.log("================================");

        let stream = event.streams?.[0];

        if (!stream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }

          const exists =
            remoteStreamRef.current
              .getTracks()
              .some(
                (track) =>
                  track.id === event.track.id
              );

          if (!exists) {
            remoteStreamRef.current.addTrack(
              event.track
            );
          }

          stream = remoteStreamRef.current;
        }

        attachRemoteStream(stream);
      };

      // ----------------------------------------------
      // CONNECTION STATE
      // ----------------------------------------------

      peer.onconnectionstatechange = () => {
        console.log(
          "WEBRTC CONNECTION STATE:",
          peer.connectionState
        );

        switch (peer.connectionState) {
          case "connected":
            console.log("================================");
            console.log("CALL CONNECTED");
            console.log("================================");

            setStatus("connected");
            break;

          case "connecting":
            setStatus("connecting");
            break;

          case "disconnected":
            console.log("WebRTC disconnected");
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

      // ----------------------------------------------
      // ICE CONNECTION STATE
      // ----------------------------------------------

      peer.oniceconnectionstatechange = () => {
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

        if (!offer) {
          throw new Error(
            "WebRTC offer is missing."
          );
        }

        if (!from) {
          throw new Error(
            "Caller ID is missing."
          );
        }

        if (!callId) {
          throw new Error(
            "Call ID is missing from offer."
          );
        }

        remoteUserRef.current = from;

        currentCallIdRef.current = callId;

        // ----------------------------------------------
        // RECEIVER MEDIA
        // ----------------------------------------------

        console.log(
          "Receiver requesting microphone/camera..."
        );

        const stream =
          await getMedia(type);

        // ----------------------------------------------
        // CREATE RECEIVER PEER
        // ----------------------------------------------

        const peer = createPeer(
          from,
          callId
        );

        // ----------------------------------------------
        // ADD RECEIVER TRACKS
        // ----------------------------------------------

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

        // ----------------------------------------------
        // SET REMOTE DESCRIPTION
        // ----------------------------------------------

        console.log(
          "SETTING REMOTE DESCRIPTION..."
        );

        await peer.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        console.log(
          "REMOTE DESCRIPTION SET"
        );

        // ----------------------------------------------
        // ADD QUEUED ICE
        // ----------------------------------------------

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

          pendingCandidatesRef.current = [];
        }

        // ----------------------------------------------
        // CREATE ANSWER
        // ----------------------------------------------

        console.log(
          "CREATING ANSWER..."
        );

        const answer =
          await peer.createAnswer();

        await peer.setLocalDescription(
          answer
        );

        // ----------------------------------------------
        // SEND ANSWER
        // ----------------------------------------------

        const socket = getSocket();

        console.log(
          "SENDING ANSWER..."
        );

        socket?.emit(
          "webrtc:answer",
          {
            to: from,
            callId,
            answer,
          }
        );

        console.log(
          "ANSWER SENT SUCCESSFULLY"
        );

        // ----------------------------------------------
        // STATE
        // ----------------------------------------------

        setCall((existing) => {
          if (existing) return existing;

          return {
            _id: callId,
            type,
          };
        });

        setStatus("connecting");

        setIncoming(null);
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

      // ----------------------------------------------
      // SAVE REMOTE USER
      // ----------------------------------------------

      remoteUserRef.current =
        receiver;

      // ----------------------------------------------
      // GET CALLER MEDIA
      // ----------------------------------------------

      const stream =
        await getMedia(type);

      // =================================================
      // IMPORTANT FIX:
      //
      // CALL INITIATE FIRST
      // THEN CREATE PEER.
      //
      // Previously peer was created here before ACK,
      // causing callId = null.
      // =================================================

      console.log(
        "INITIATING CALL ON SERVER..."
      );

      socket.emit(
        "call:initiate",
        {
          receiver: receiver._id,

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

              // Stop media if call creation failed
              stream
                .getTracks()
                .forEach((track) =>
                  track.stop()
                );

              localStreamRef.current =
                null;

              setLocalStream(null);

              return;
            }

            // ------------------------------------------
            // GET REAL CALL ID
            // ------------------------------------------

            const callId =
              ack.call?._id;

            if (!callId) {
              throw new Error(
                "Server did not return a call ID."
              );
            }

            currentCallIdRef.current =
              callId;

            setCall(ack.call);

            setStatus("calling");

            console.log(
              "================================"
            );
            console.log(
              "CALL ID:",
              callId
            );
            console.log(
              "================================"
            );

            // ------------------------------------------
            // CREATE PEER ONLY AFTER CALL ID
            // ------------------------------------------

            const peer =
              createPeer(
                receiver._id,
                callId
              );

            // ------------------------------------------
            // ADD CALLER TRACKS
            // ------------------------------------------

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

            // ------------------------------------------
            // CREATE OFFER
            // ------------------------------------------

            console.log(
              "CREATING OFFER..."
            );

            const offer =
              await peer.createOffer();

            await peer.setLocalDescription(
              offer
            );

            // ------------------------------------------
            // SEND OFFER
            // ------------------------------------------

            console.log(
              "SENDING OFFER..."
            );

            socket.emit(
              "webrtc:offer",
              {
                to: receiver._id,
                callId,
                offer,
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
              err.message ||
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

      if (!remoteId) {
        throw new Error(
          "Caller information is missing."
        );
      }

      if (!callId) {
        throw new Error(
          "Call ID is missing."
        );
      }

      console.log("================================");
      console.log("ACCEPTING CALL");
      console.log({
        remoteId,
        type,
        callId,
      });
      console.log("================================");

      // ----------------------------------------------
      // NOW ACCEPTED
      // ----------------------------------------------

      acceptedRef.current = true;

      remoteUserRef.current =
        remoteId;

      currentCallIdRef.current =
        callId;

      setCall(incoming.call);

      setStatus("connecting");

      setIncoming(null);

      // ----------------------------------------------
      // TELL SERVER
      // ----------------------------------------------

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

      // ----------------------------------------------
      // PROCESS QUEUED OFFER
      // ----------------------------------------------

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

    if (remoteId) {
      socket?.emit(
        "call:reject",
        {
          to: remoteId,
          callId,
        }
      );
    }

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

    const remoteId =
      remoteUserRef.current?._id ||
      remoteUserRef.current;

    const callId =
      call?._id ||
      currentCallIdRef.current;

    console.log(
      "ENDING CALL",
      {
        remoteId,
        callId,
      }
    );

    socket?.emit(
      "call:end",
      {
        to: remoteId,
        callId,
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

    const newMuted = !muted;

    tracks.forEach((track) => {
      track.enabled = !newMuted;
    });

    setMuted(newMuted);

    console.log(
      "MICROPHONE:",
      newMuted ? "OFF" : "ON"
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
      track.enabled = !newCameraOff;
    });

    setCameraOff(newCameraOff);

    console.log(
      "CAMERA:",
      newCameraOff ? "OFF" : "ON"
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

      pendingCandidatesRef.current = [];

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

        if (!payload?.offer) {
          console.error(
            "Offer payload missing offer."
          );
          return;
        }

        // ----------------------------------------------
        // NOT ACCEPTED
        // ----------------------------------------------

        if (!acceptedRef.current) {
          console.log(
            "Offer received before Accept. Queueing..."
          );

          pendingOfferRef.current =
            payload;

          // Save call ID
          if (payload.callId) {
            currentCallIdRef.current =
              payload.callId;
          }

          // Save caller
          if (payload.from) {
            remoteUserRef.current =
              payload.from;
          }

          return;
        }

        // ----------------------------------------------
        // ACCEPTED
        // ----------------------------------------------

        await handleOffer(payload);
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

    const onAnswer = async (payload) => {
      try {
        const {
          answer,
          callId,
        } = payload || {};

        console.log("================================");
        console.log("WEBRTC ANSWER RECEIVED");
        console.log({
          callId,
          from: payload?.from,
        });
        console.log("================================");

        if (!answer) {
          console.error(
            "Answer is missing."
          );
          return;
        }

        const peer =
          peerRef.current;

        if (!peer) {
          console.error(
            "No peer found for answer."
          );
          return;
        }

        // ----------------------------------------------
        // SET CALL ID
        // ----------------------------------------------

        if (callId) {
          currentCallIdRef.current =
            callId;
        }

        // ----------------------------------------------
        // SET REMOTE DESCRIPTION
        // ----------------------------------------------

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            answer
          )
        );

        console.log(
          "ANSWER APPLIED SUCCESSFULLY"
        );

        // ----------------------------------------------
        // ADD QUEUED ICE
        // ----------------------------------------------

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

          pendingCandidatesRef.current = [];
        }

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

    const onCandidate = async (payload) => {
      try {
        const {
          candidate,
          callId,
        } = payload || {};

        if (!candidate) return;

        console.log(
          "RECEIVED ICE CANDIDATE"
        );

        if (
          callId &&
          !currentCallIdRef.current
        ) {
          currentCallIdRef.current =
            callId;
        }

        const peer =
          peerRef.current;

        // ----------------------------------------------
        // PEER NOT READY
        // ----------------------------------------------

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

        // ----------------------------------------------
        // ADD ICE
        // ----------------------------------------------

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
  // ATTACH LOCAL STREAM
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
  // ATTACH REMOTE AUDIO
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
    // State
    call,
    incoming,
    status,
    muted,
    cameraOff,
    error,

    localStream,

    // Refs
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,

    // Functions
    startCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMute,
    toggleCamera,

    // Extra
    remoteUser:
      remoteUserRef.current,

    callType:
      call?.type ||
      incoming?.call?.type ||
      "voice",
  };
}

