
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../socket/client";

// ============================================================
// ICE SERVERS
// ============================================================

const iceServers = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

export function useCallManager(currentUser) {
  // ============================================================
  // STATE
  // ============================================================

  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [status, setStatus] = useState("idle");

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const [error, setError] = useState("");
  const [localStream, setLocalStream] = useState(null);

  // ============================================================
  // REFS
  // ============================================================

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const peerRef = useRef(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const remoteUserRef = useRef(null);

  const currentCallIdRef = useRef(null);

  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const acceptedRef = useRef(false);

  // ============================================================
  // CLOSE MEDIA / CALL
  // ============================================================

  const closeMedia = useCallback(() => {
    console.log("================================");
    console.log("CLOSING CALL");
    console.log("================================");

    // Close WebRTC peer
    if (peerRef.current) {
      try {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onicecandidateerror = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.oniceconnectionstatechange = null;

        peerRef.current.close();
      } catch (err) {
        console.log("Peer close error:", err);
      }
    }

    peerRef.current = null;

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.log("Track stop error:", err);
        }
      });
    }

    localStreamRef.current = null;

    // Clear local video
    if (localVideoRef.current) {
      localVideoRef.current.pause?.();
      localVideoRef.current.srcObject = null;
    }

    // Clear remote video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.pause?.();
      remoteVideoRef.current.srcObject = null;
    }

    // Clear remote audio
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
      } catch {}

      remoteAudioRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;

    // Reset refs
    remoteUserRef.current = null;
    currentCallIdRef.current = null;

    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];

    acceptedRef.current = false;

    // Reset state
    setLocalStream(null);
    setCall(null);
    setIncoming(null);
    setStatus("idle");

    setMuted(false);
    setCameraOff(false);
  }, []);

  // ============================================================
  // GET USER MEDIA
  // ============================================================

  const getMedia = useCallback(async (type = "voice") => {
    setError("");

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      const message =
        "Camera/microphone is not available. Please use HTTPS or localhost.";

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
      console.log({
        type,
        constraints,
      });
      console.log("================================");

      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );

      console.log(
        "MEDIA GRANTED:",
        stream.getTracks().map((track) => ({
          kind: track.kind,
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
        }))
      );

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Local video
      if (
        type === "video" &&
        localVideoRef.current
      ) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;

        try {
          await localVideoRef.current.play();
        } catch (err) {
          console.log(
            "Local video play error:",
            err
          );
        }
      }

      return stream;
    } catch (err) {
      console.error(
        "GET USER MEDIA FAILED:",
        err
      );

      let message =
        "Could not access microphone/camera.";

      if (err.name === "NotAllowedError") {
        message =
          "Microphone/camera permission was denied.";
      } else if (err.name === "NotFoundError") {
        message =
          "No microphone or camera was found.";
      } else if (err.name === "NotReadableError") {
        message =
          "Microphone/camera is already being used.";
      } else if (err.name === "SecurityError") {
        message =
          "Camera/microphone requires HTTPS.";
      } else if (err.name === "OverconstrainedError") {
        message =
          "Camera settings are not supported.";
      }

      setError(message);

      throw new Error(message);
    }
  }, []);

  // ============================================================
  // ATTACH REMOTE STREAM
  // ============================================================

  const attachRemoteStream = useCallback(
    async (stream) => {
      if (!stream) return;

      remoteStreamRef.current = stream;

      console.log("================================");
      console.log("REMOTE STREAM");
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

      // --------------------------------------------------------
      // REMOTE VIDEO
      // --------------------------------------------------------

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.autoplay = true;
        remoteVideoRef.current.playsInline = true;

        try {
          await remoteVideoRef.current.play();

          console.log(
            "REMOTE VIDEO PLAYING"
          );
        } catch (err) {
          console.log(
            "Remote video play error:",
            err
          );
        }
      }

      // --------------------------------------------------------
      // REMOTE AUDIO
      // --------------------------------------------------------

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;

        remoteAudioRef.current.autoplay = true;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1;

        try {
          await remoteAudioRef.current.play();

          console.log(
            "================================"
          );
          console.log(
            "REMOTE AUDIO PLAYING"
          );
          console.log(
            "================================"
          );
        } catch (err) {
          console.error(
            "REMOTE AUDIO PLAY FAILED:",
            err
          );
        }
      }
    },
    []
  );

  // ============================================================
  // CREATE PEER
  // ============================================================

  const createPeer = useCallback(
    (targetUserId, callId) => {
      const socket = getSocket();

      if (!targetUserId) {
        throw new Error(
          "Target user ID is missing."
        );
      }

      if (!callId) {
        throw new Error(
          "Call ID is missing."
        );
      }

      // Close old peer
      if (peerRef.current) {
        try {
          peerRef.current.close();
        } catch {}

        peerRef.current = null;
      }

      console.log("================================");
      console.log("CREATING PEER");
      console.log({
        targetUserId,
        callId,
      });
      console.log("================================");

      const peer =
        new RTCPeerConnection({
          iceServers,
        });

      // --------------------------------------------------------
      // ICE CANDIDATE
      // --------------------------------------------------------

      peer.onicecandidate = (event) => {
        if (!event.candidate) {
          console.log(
            "ICE GATHERING COMPLETE"
          );
          return;
        }

        console.log(
          "SENDING ICE CANDIDATE"
        );

        socket?.emit(
          "webrtc:ice-candidate",
          {
            to: targetUserId,
            callId,
            candidate: event.candidate,
          }
        );
      };

      // --------------------------------------------------------
      // ICE ERROR
      // --------------------------------------------------------

      peer.onicecandidateerror = (event) => {
        console.error(
          "ICE CANDIDATE ERROR:",
          {
            errorCode: event.errorCode,
            errorText: event.errorText,
            url: event.url,
          }
        );
      };

      // --------------------------------------------------------
      // REMOTE TRACK
      // --------------------------------------------------------

      peer.ontrack = async (event) => {
        console.log("================================");
        console.log(
          "REMOTE TRACK RECEIVED:",
          event.track.kind
        );
        console.log({
          trackId: event.track.id,
          enabled: event.track.enabled,
          muted: event.track.muted,
          readyState: event.track.readyState,
        });
        console.log("================================");

        let stream =
          event.streams?.[0];

        // If browser doesn't provide stream
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

        await attachRemoteStream(
          stream
        );
      };

      // --------------------------------------------------------
      // CONNECTION STATE
      // --------------------------------------------------------

      peer.onconnectionstatechange =
        () => {
          console.log(
            "WEBRTC CONNECTION STATE:",
            peer.connectionState
          );

          if (
            peer.connectionState ===
            "connected"
          ) {
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
          }

          if (
            peer.connectionState ===
            "connecting"
          ) {
            setStatus("connecting");
          }

          if (
            peer.connectionState ===
            "disconnected"
          ) {
            console.log(
              "WEBRTC DISCONNECTED"
            );
          }

          if (
            peer.connectionState ===
            "failed"
          ) {
            console.error(
              "WEBRTC CONNECTION FAILED"
            );

            setStatus("failed");

            setError(
              "WebRTC connection failed. Please try again."
            );
          }

          if (
            peer.connectionState ===
            "closed"
          ) {
            console.log(
              "WEBRTC CONNECTION CLOSED"
            );
          }
        };

      // --------------------------------------------------------
      // ICE CONNECTION
      // --------------------------------------------------------

      peer.oniceconnectionstatechange =
        () => {
          console.log(
            "ICE CONNECTION:",
            peer.iceConnectionState
          );

          if (
            peer.iceConnectionState ===
            "connected"
          ) {
            console.log(
              "ICE CONNECTED"
            );
          }

          if (
            peer.iceConnectionState ===
            "completed"
          ) {
            console.log(
              "ICE COMPLETED"
            );
          }

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

  // ============================================================
  // HANDLE OFFER
  // ============================================================

  const handleOffer = useCallback(
    async ({
      offer,
      from,
      callId,
      type = "voice",
    }) => {
      try {
        console.log("================================");
        console.log(
          "HANDLING WEBRTC OFFER"
        );
        console.log({
          from,
          callId,
          type,
        });
        console.log("================================");

        if (!offer) {
          throw new Error(
            "Offer is missing."
          );
        }

        if (!from) {
          throw new Error(
            "Caller ID is missing."
          );
        }

        if (!callId) {
          throw new Error(
            "Call ID is missing."
          );
        }

        // --------------------------------------------------------
        // SAVE CALL INFORMATION
        // --------------------------------------------------------

        currentCallIdRef.current =
          callId;

        if (
          typeof from === "object"
        ) {
          remoteUserRef.current =
            from;
        } else if (
          !remoteUserRef.current
        ) {
          remoteUserRef.current =
            from;
        }

        // --------------------------------------------------------
        // GET RECEIVER MEDIA
        // IMPORTANT:
        // ONLY AFTER ACCEPT
        // --------------------------------------------------------

        console.log(
          "RECEIVER REQUESTING MEDIA..."
        );

        const stream =
          await getMedia(type);

        console.log(
          "RECEIVER MEDIA READY"
        );

        // --------------------------------------------------------
        // CREATE RECEIVER PEER
        // --------------------------------------------------------

        const peer =
          createPeer(
            from?._id || from,
            callId
          );

        // --------------------------------------------------------
        // ADD RECEIVER AUDIO + VIDEO
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // SET REMOTE OFFER
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // ADD QUEUED ICE
        // --------------------------------------------------------

        if (
          pendingCandidatesRef.current
            .length
        ) {
          console.log(
            "ADDING QUEUED ICE:",
            pendingCandidatesRef.current
              .length
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

              console.log(
                "QUEUED ICE ADDED"
              );
            } catch (err) {
              console.error(
                "QUEUED ICE ERROR:",
                err
              );
            }
          }

          pendingCandidatesRef.current =
            [];
        }

        // --------------------------------------------------------
        // CREATE ANSWER
        // --------------------------------------------------------

        console.log(
          "CREATING ANSWER..."
        );

        const answer =
          await peer.createAnswer();

        await peer.setLocalDescription(
          answer
        );

        console.log(
          "LOCAL ANSWER SET"
        );

        // --------------------------------------------------------
        // SEND ANSWER
        // --------------------------------------------------------

        const socket = getSocket();

        console.log(
          "SENDING ANSWER..."
        );

        socket?.emit(
          "webrtc:answer",
          {
            to:
              from?._id ||
              from,
            callId,
            answer,
          }
        );

        console.log(
          "================================"
        );
        console.log(
          "ANSWER SENT SUCCESSFULLY"
        );
        console.log(
          "================================"
        );

        // --------------------------------------------------------
        // CALL STATE
        // --------------------------------------------------------

        setCall((existing) => {
          if (existing) {
            return existing;
          }

          return {
            _id: callId,
            type,
          };
        });

        setIncoming(null);
        setStatus("connecting");
      } catch (err) {
        console.error(
          "HANDLE OFFER FAILED:",
          err
        );

        setStatus("failed");

        setError(
          err.message ||
            "Could not process WebRTC offer."
        );
      }
    },
    [createPeer, getMedia]
  );

  // ============================================================
  // START CALL
  // ============================================================

  const startCall = async ({
    receiver,
    type = "voice",
    conversationId,
  }) => {
    try {
      setError("");

      const socket = getSocket();

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

      console.log("================================");
      console.log("START CALL");
      console.log({
        receiver: receiver._id,
        type,
        conversationId,
      });
      console.log("================================");

      // Save complete receiver object
      remoteUserRef.current =
        receiver;

      // --------------------------------------------------------
      // CALLER MEDIA
      // --------------------------------------------------------

      const stream =
        await getMedia(type);

      // --------------------------------------------------------
      // CREATE CALL ON SERVER FIRST
      // --------------------------------------------------------

      console.log(
        "INITIATING CALL ON SERVER..."
      );

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
              throw new Error(
                ack?.message ||
                  "Could not start call."
              );
            }

            // --------------------------------------------------
            // REAL CALL ID
            // --------------------------------------------------

            const callId =
              ack.call?._id;

            if (!callId) {
              throw new Error(
                "Server did not return Call ID."
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

            // --------------------------------------------------
            // CREATE CALLER PEER
            // --------------------------------------------------

            const peer =
              createPeer(
                receiver._id,
                callId
              );

            // --------------------------------------------------
            // ADD CALLER AUDIO + VIDEO
            // --------------------------------------------------

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

            // --------------------------------------------------
            // CREATE OFFER
            // --------------------------------------------------

            console.log(
              "CREATING OFFER..."
            );

            const offer =
              await peer.createOffer();

            await peer.setLocalDescription(
              offer
            );

            console.log(
              "LOCAL OFFER SET"
            );

            // --------------------------------------------------
            // SEND OFFER
            // --------------------------------------------------

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
              "CALL OFFER FAILED:",
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
        "START CALL FAILED:",
        err
      );

      setStatus("failed");

      setError(
        err.message ||
          "Could not start call."
      );
    }
  };

  // ============================================================
  // ACCEPT CALL
  // ============================================================

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
          "Caller ID is missing."
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

      // --------------------------------------------------------
      // ACCEPT FIRST
      // --------------------------------------------------------

      acceptedRef.current = true;

      currentCallIdRef.current =
        callId;

      // Keep user object if available
      if (
        typeof incoming.from ===
        "object"
      ) {
        remoteUserRef.current =
          incoming.from;
      } else {
        remoteUserRef.current =
          remoteId;
      }

      setCall(incoming.call);
      setIncoming(null);
      setStatus("connecting");

      // --------------------------------------------------------
      // INFORM SERVER
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // IF OFFER ARRIVED BEFORE ACCEPT
      // PROCESS IT NOW
      // --------------------------------------------------------

      if (pendingOfferRef.current) {
        const offer =
          pendingOfferRef.current;

        pendingOfferRef.current =
          null;

        console.log(
          "PROCESSING QUEUED OFFER..."
        );

        await handleOffer(
          offer
        );
      }
    } catch (err) {
      console.error(
        "ACCEPT CALL FAILED:",
        err
      );

      setStatus("failed");

      setError(
        err.message ||
          "Could not accept call."
      );
    }
  };

  // ============================================================
  // REJECT CALL
  // ============================================================

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
    pendingCandidatesRef.current = [];

    acceptedRef.current = false;

    setIncoming(null);
    setStatus("idle");
  };

  // ============================================================
  // END CALL
  // ============================================================

  const endCall = () => {
    const socket = getSocket();

    const remoteId =
      remoteUserRef.current?._id ||
      remoteUserRef.current;

    const callId =
      call?._id ||
      currentCallIdRef.current;

    console.log(
      "================================"
    );
    console.log(
      "ENDING CALL"
    );
    console.log({
      remoteId,
      callId,
    });
    console.log(
      "================================"
    );

    if (remoteId) {
      socket?.emit(
        "call:end",
        {
          to: remoteId,
          callId,
        }
      );
    }

    closeMedia();
  };

  // ============================================================
  // MUTE / UNMUTE
  // ============================================================

  const toggleMute = () => {
    const tracks =
      localStreamRef.current?.getAudioTracks();

    if (!tracks?.length) {
      console.log(
        "NO AUDIO TRACK"
      );
      return;
    }

    const newMuted = !muted;

    tracks.forEach((track) => {
      track.enabled =
        !newMuted;
    });

    setMuted(newMuted);

    console.log(
      "MICROPHONE:",
      newMuted ? "OFF" : "ON"
    );
  };

  // ============================================================
  // CAMERA ON / OFF
  // ============================================================

  const toggleCamera = () => {
    const tracks =
      localStreamRef.current?.getVideoTracks();

    if (!tracks?.length) {
      console.log(
        "NO VIDEO TRACK"
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

  // ============================================================
  // SOCKET EVENTS
  // ============================================================

  useEffect(() => {
    const socket = getSocket();

    if (!socket || !currentUser) {
      return;
    }

    // ==========================================================
    // INCOMING CALL
    // ==========================================================

    const onRing = (payload) => {
      console.log("================================");
      console.log(
        "INCOMING CALL"
      );
      console.log(payload);
      console.log("================================");

      acceptedRef.current = false;

      pendingOfferRef.current =
        null;

      pendingCandidatesRef.current =
        [];

      if (payload?.from) {
        remoteUserRef.current =
          payload.from;
      }

      if (payload?.call?._id) {
        currentCallIdRef.current =
          payload.call._id;
      }

      setIncoming(payload);
      setStatus("ringing");
    };

    // ==========================================================
    // OFFER
    // ==========================================================

    const onOffer = async (
      payload
    ) => {
      try {
        console.log("================================");
        console.log(
          "WEBRTC OFFER RECEIVED"
        );
        console.log(payload);
        console.log("================================");

        if (!payload?.offer) {
          console.error(
            "OFFER IS MISSING"
          );
          return;
        }

        // ------------------------------------------------------
        // OFFER BEFORE ACCEPT
        // ------------------------------------------------------

        if (!acceptedRef.current) {
          console.log(
            "OFFER RECEIVED BEFORE ACCEPT"
          );

          console.log(
            "QUEUEING OFFER..."
          );

          pendingOfferRef.current =
            payload;

          if (payload.callId) {
            currentCallIdRef.current =
              payload.callId;
          }

          if (payload.from) {
            remoteUserRef.current =
              payload.from;
          }

          return;
        }

        // ------------------------------------------------------
        // ALREADY ACCEPTED
        // ------------------------------------------------------

        console.log(
          "CALL ALREADY ACCEPTED"
        );

        await handleOffer(
          payload
        );
      } catch (err) {
        console.error(
          "OFFER EVENT FAILED:",
          err
        );

        setStatus("failed");

        setError(
          err.message ||
            "Could not process offer."
        );
      }
    };

    // ==========================================================
    // ANSWER
    // ==========================================================

    const onAnswer = async (
      payload
    ) => {
      try {
        console.log("================================");
        console.log(
          "WEBRTC ANSWER RECEIVED"
        );
        console.log(payload);
        console.log("================================");

        const {
          answer,
          callId,
        } = payload || {};

        if (!answer) {
          console.error(
            "ANSWER IS MISSING"
          );
          return;
        }

        const peer =
          peerRef.current;

        if (!peer) {
          console.error(
            "NO PEER FOR ANSWER"
          );
          return;
        }

        if (
          peer.signalingState !==
          "have-local-offer"
        ) {
          console.log(
            "Unexpected signaling state:",
            peer.signalingState
          );
        }

        if (callId) {
          currentCallIdRef.current =
            callId;
        }

        console.log(
          "SETTING REMOTE ANSWER..."
        );

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            answer
          )
        );

        console.log(
          "ANSWER APPLIED SUCCESSFULLY"
        );

        // ------------------------------------------------------
        // ADD QUEUED ICE
        // ------------------------------------------------------

        if (
          pendingCandidatesRef.current
            .length
        ) {
          console.log(
            "ADDING QUEUED ICE:",
            pendingCandidatesRef.current
              .length
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

              console.log(
                "QUEUED ICE ADDED"
              );
            } catch (err) {
              console.error(
                "QUEUED ICE ERROR:",
                err
              );
            }
          }

          pendingCandidatesRef.current =
            [];
        }

        setStatus("connecting");
      } catch (err) {
        console.error(
          "ANSWER HANDLING FAILED:",
          err
        );

        setStatus("failed");

        setError(
          "Could not establish remote connection."
        );
      }
    };

    // ==========================================================
    // ICE CANDIDATE
    // ==========================================================

    const onCandidate = async (
      payload
    ) => {
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

        // ------------------------------------------------------
        // PEER OR REMOTE DESCRIPTION NOT READY
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // ADD ICE
        // ------------------------------------------------------

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
          "ICE CANDIDATE ERROR:",
          err
        );
      }
    };

    // ==========================================================
    // REMOTE END
    // ==========================================================

    const onEnd = () => {
      console.log(
        "REMOTE ENDED CALL"
      );

      closeMedia();
    };

    // ==========================================================
    // REMOTE REJECT
    // ==========================================================

    const onReject = () => {
      console.log(
        "CALL REJECTED"
      );

      closeMedia();
    };

    // ==========================================================
    // REGISTER SOCKET EVENTS
    // ==========================================================

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

    // ==========================================================
    // CLEANUP
    // ==========================================================

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

  // ============================================================
  // ATTACH LOCAL VIDEO
  // ============================================================

  useEffect(() => {
    if (
      localVideoRef.current &&
      localStream
    ) {
      console.log(
        "CALL OVERLAY: attaching local stream"
      );

      localVideoRef.current.srcObject =
        localStream;

      localVideoRef.current.muted =
        true;

      localVideoRef.current.playsInline =
        true;

      localVideoRef.current
        .play()
        .catch(() => {});
    }
  }, [
    localStream,
    cameraOff,
  ]);

  // ============================================================
  // ATTACH REMOTE MEDIA WHEN ELEMENTS ARE READY
  // ============================================================

  useEffect(() => {
    const remoteStream =
      remoteStreamRef.current;

    if (!remoteStream) return;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject =
        remoteStream;

      remoteVideoRef.current
        .play()
        .catch(() => {});
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject =
        remoteStream;

      remoteAudioRef.current.muted =
        false;

      remoteAudioRef.current.volume =
        1;

      remoteAudioRef.current
        .play()
        .catch((err) => {
          console.log(
            "Remote audio play:",
            err
          );
        });
    }
  }, [status]);

  // ============================================================
  // RETURN
  // ============================================================

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

    // Actions
    startCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMute,
    toggleCamera,

    // Remote user
    remoteUser:
      remoteUserRef.current,

    // Call type
    callType:
      call?.type ||
      incoming?.call?.type ||
      "voice",
  };
}

