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
  // CLOSE MEDIA
  // ============================================================

  const closeMedia = useCallback(() => {
    console.log("================================");
    console.log("CLOSING CALL");
    console.log("================================");

    // ----------------------------------------------------------
    // CLOSE PEER
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // STOP LOCAL TRACKS
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // CLEAR LOCAL VIDEO
    // ----------------------------------------------------------

    if (localVideoRef.current) {
      try {
        localVideoRef.current.pause();
      } catch {}

      localVideoRef.current.srcObject = null;
    }

    // ----------------------------------------------------------
    // CLEAR REMOTE VIDEO
    // ----------------------------------------------------------

    if (remoteVideoRef.current) {
      try {
        remoteVideoRef.current.pause();
      } catch {}

      remoteVideoRef.current.srcObject = null;
    }

    // ----------------------------------------------------------
    // CLEAR REMOTE AUDIO
    // ----------------------------------------------------------

    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
      } catch {}

      remoteAudioRef.current.srcObject = null;
    }

    // ----------------------------------------------------------
    // RESET REFS
    // ----------------------------------------------------------

    remoteStreamRef.current = null;

    remoteUserRef.current = null;

    currentCallIdRef.current = null;

    pendingOfferRef.current = null;

    pendingCandidatesRef.current = [];

    acceptedRef.current = false;

    // ----------------------------------------------------------
    // RESET STATE
    // ----------------------------------------------------------

    setLocalStream(null);
    setCall(null);
    setIncoming(null);
    setStatus("idle");

    setMuted(false);
    setCameraOff(false);
    setError("");
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

    // ----------------------------------------------------------
    // NORMALIZE CALL TYPE
    // ----------------------------------------------------------

    const callType = type === "video" ? "video" : "voice";

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },

      video:
        callType === "video"
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
        requestedType: type,
        normalizedType: callType,
        constraints,
      });
      console.log("================================");

      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );

      console.log("================================");
      console.log("MEDIA GRANTED");
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

      // ----------------------------------------------------------
      // SAVE LOCAL STREAM
      // ----------------------------------------------------------

      localStreamRef.current = stream;

      setLocalStream(stream);

      // ----------------------------------------------------------
      // ATTACH LOCAL VIDEO
      // ----------------------------------------------------------

      if (
        callType === "video" &&
        localVideoRef.current
      ) {
        const video =
          localVideoRef.current;

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        try {
          await video.play();

          console.log(
            "LOCAL VIDEO PLAYING"
          );
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

      if (
        err.name === "NotAllowedError"
      ) {
        message =
          "Microphone/camera permission was denied.";
      } else if (
        err.name === "NotFoundError"
      ) {
        message =
          "No microphone or camera was found.";
      } else if (
        err.name === "NotReadableError"
      ) {
        message =
          "Microphone/camera is already being used.";
      } else if (
        err.name === "SecurityError"
      ) {
        message =
          "Camera/microphone requires HTTPS.";
      } else if (
        err.name === "OverconstrainedError"
      ) {
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
      if (!stream) {
        return;
      }

      remoteStreamRef.current = stream;

      console.log("================================");
      console.log(
        "REMOTE STREAM UPDATED"
      );

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

      // ----------------------------------------------------------
      // REMOTE VIDEO
      // ----------------------------------------------------------

      if (remoteVideoRef.current) {
        const video =
          remoteVideoRef.current;

        if (
          video.srcObject !== stream
        ) {
          video.srcObject = stream;
        }

        video.autoplay = true;
        video.playsInline = true;
        video.muted = false;

        try {
          await video.play();

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

      // ----------------------------------------------------------
      // REMOTE AUDIO
      // ----------------------------------------------------------

      if (remoteAudioRef.current) {
        const audio =
          remoteAudioRef.current;

        if (
          audio.srcObject !== stream
        ) {
          audio.srcObject = stream;
        }

        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;
        audio.volume = 1;

        try {
          await audio.play();

          console.log(
            "REMOTE AUDIO PLAYING"
          );
        } catch (err) {
          console.log(
            "Remote audio play error:",
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

      // ----------------------------------------------------------
      // CLOSE OLD PEER
      // ----------------------------------------------------------

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

      // ==========================================================
      // ICE CANDIDATE
      // ==========================================================

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

      // ==========================================================
      // ICE ERROR
      // ==========================================================

      peer.onicecandidateerror = (event) => {
        console.error(
          "ICE CANDIDATE ERROR:",
          {
            errorCode:
              event.errorCode,
            errorText:
              event.errorText,
            url: event.url,
          }
        );
      };

      // ==========================================================
      // REMOTE TRACK
      // ==========================================================

      peer.ontrack = async (event) => {
        console.log("================================");
        console.log(
          "REMOTE TRACK RECEIVED:",
          event.track.kind
        );

        console.log({
          trackId:
            event.track.id,
          kind:
            event.track.kind,
          enabled:
            event.track.enabled,
          muted:
            event.track.muted,
          readyState:
            event.track.readyState,
        });

        console.log("================================");

        let stream =
          event.streams?.[0];

        // --------------------------------------------------------
        // CREATE SHARED STREAM IF NEEDED
        // --------------------------------------------------------

        if (!stream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current =
              new MediaStream();
          }

          stream =
            remoteStreamRef.current;

          const alreadyExists =
            stream
              .getTracks()
              .some(
                (track) =>
                  track.id ===
                  event.track.id
              );

          if (!alreadyExists) {
            stream.addTrack(
              event.track
            );
          }
        } else {
          // ------------------------------------------------------
          // USE BROWSER PROVIDED STREAM
          // ------------------------------------------------------

          if (
            !remoteStreamRef.current ||
            remoteStreamRef.current.id !==
              stream.id
          ) {
            remoteStreamRef.current =
              stream;
          }
        }

        console.log(
          "REMOTE STREAM TRACKS:",
          remoteStreamRef.current
            ?.getTracks()
            .map(
              (track) =>
                track.kind
            )
        );

        // --------------------------------------------------------
        // ATTACH AUDIO + VIDEO
        // --------------------------------------------------------

        await attachRemoteStream(
          remoteStreamRef.current
        );
      };

      // ==========================================================
      // CONNECTION STATE
      // ==========================================================

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
              "WEBRTC CONNECTION FAILED"
            );

            setStatus(
              "failed"
            );

            setError(
              "WebRTC connection failed. Please try again."
            );
          }

          if (
            peer.connectionState ===
            "disconnected"
          ) {
            console.log(
              "WEBRTC DISCONNECTED"
            );
          }
        };

      // ==========================================================
      // ICE CONNECTION STATE
      // ==========================================================

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
  // HANDLE OFFER - RECEIVER
  // ============================================================

  const handleOffer = useCallback(
    async ({
      offer,
      from,
      callId,
      type = "voice",
    }) => {
      try {
        // --------------------------------------------------------
        // IMPORTANT FIX
        //
        // Only video or voice is allowed.
        // --------------------------------------------------------

        const callType =
          type === "video"
            ? "video"
            : "voice";

        console.log("================================");
        console.log(
          "HANDLING WEBRTC OFFER"
        );

        console.log({
          from,
          callId,
          receivedType: type,
          normalizedType:
            callType,
        });

        console.log("================================");

        // --------------------------------------------------------
        // VALIDATION
        // --------------------------------------------------------

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
        // SAVE CALL ID
        // --------------------------------------------------------

        currentCallIdRef.current =
          callId;

        // --------------------------------------------------------
        // CALLER ID
        // --------------------------------------------------------

        const callerId =
          typeof from === "object"
            ? from._id
            : from;

        if (!callerId) {
          throw new Error(
            "Caller ID is invalid."
          );
        }

        // --------------------------------------------------------
        // SAVE REMOTE USER
        // --------------------------------------------------------

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

        // ========================================================
        // RECEIVER MEDIA
        //
        // THIS IS THE IMPORTANT PART.
        //
        // For video call:
        // getMedia("video")
        //
        // This gives:
        // audio + video
        // ========================================================

        console.log("================================");
        console.log(
          "RECEIVER REQUESTING MEDIA"
        );
        console.log({
          type: callType,
        });
        console.log("================================");

        const stream =
          await getMedia(
            callType
          );

        console.log("================================");
        console.log(
          "RECEIVER MEDIA READY"
        );

        console.log(
          stream
            .getTracks()
            .map(
              (track) =>
                track.kind
            )
        );

        console.log("================================");

        // --------------------------------------------------------
        // CREATE PEER
        // --------------------------------------------------------

        const peer =
          createPeer(
            callerId,
            callId
          );

        // ========================================================
        // ADD RECEIVER TRACKS
        //
        // VIDEO CALL:
        // audio + video
        //
        // VOICE CALL:
        // audio
        // ========================================================

        stream
          .getTracks()
          .forEach(
            (track) => {
              console.log(
                "ADDING RECEIVER TRACK:",
                track.kind
              );

              peer.addTrack(
                track,
                stream
              );
            }
          );

        console.log(
          "RECEIVER SENDERS:",
          peer
            .getSenders()
            .map(
              (sender) => ({
                kind:
                  sender.track
                    ?.kind,

                id:
                  sender.track
                    ?.id,
              })
            )
        );

        // ========================================================
        // SET REMOTE OFFER
        // ========================================================

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

        // ========================================================
        // ADD QUEUED ICE
        // ========================================================

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

        // ========================================================
        // CREATE ANSWER
        // ========================================================

        console.log(
          "CREATING ANSWER..."
        );

        const answer =
          await peer.createAnswer();

        console.log(
          "ANSWER CREATED"
        );

        // --------------------------------------------------------
        // SET LOCAL ANSWER
        // --------------------------------------------------------

        await peer.setLocalDescription(
          answer
        );

        console.log(
          "LOCAL ANSWER SET"
        );

        // ========================================================
        // SEND ANSWER
        // ========================================================

        const socket =
          getSocket();

        console.log(
          "SENDING ANSWER..."
        );

        socket?.emit(
          "webrtc:answer",
          {
            to: callerId,
            callId,
            answer:
              peer.localDescription,
          }
        );

        console.log("================================");
        console.log(
          "ANSWER SENT SUCCESSFULLY"
        );

        console.log(
          "ANSWER CALL TYPE:",
          callType
        );

        console.log(
          "RECEIVER VIDEO IS NOW IN ANSWER SDP"
        );

        console.log("================================");

        // ========================================================
        // UPDATE CALL STATE
        // ========================================================

        setCall((existing) => {
          if (existing) {
            return {
              ...existing,
              type:
                existing.type ||
                callType,
            };
          }

          return {
            _id: callId,
            type: callType,
          };
        });

        setIncoming(null);

        setStatus(
          "connecting"
        );
      } catch (err) {
        console.error(
          "HANDLE OFFER FAILED:",
          err
        );

        setStatus(
          "failed"
        );

        setError(
          err.message ||
            "Could not process WebRTC offer."
        );
      }
    },
    [
      createPeer,
      getMedia,
    ]
  );

  // ============================================================
  // START CALL - CALLER
  // ============================================================

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

      // ----------------------------------------------------------
      // NORMALIZE TYPE
      // ----------------------------------------------------------

      const callType =
        type === "video"
          ? "video"
          : "voice";

      console.log("================================");
      console.log(
        "START CALL"
      );

      console.log({
        receiver:
          receiver._id,
        type: callType,
        conversationId,
      });

      console.log("================================");

      remoteUserRef.current =
        receiver;

      // ==========================================================
      // CALLER MEDIA
      // ==========================================================

      const stream =
        await getMedia(
          callType
        );

      console.log(
        "CALLER STREAM:",
        stream
          .getTracks()
          .map(
            (track) =>
              track.kind
          )
      );

      // ==========================================================
      // CREATE CALL ON SERVER
      // ==========================================================

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

          type: callType,

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

            const callId =
              ack.call?._id;

            if (!callId) {
              throw new Error(
                "Server did not return Call ID."
              );
            }

            currentCallIdRef.current =
              callId;

            // ----------------------------------------------------
            // SAVE CALL
            // ----------------------------------------------------

            setCall({
              ...ack.call,
              type:
                ack.call?.type ||
                callType,
            });

            setStatus(
              "calling"
            );

            console.log("================================");
            console.log(
              "CALL ID:",
              callId
            );
            console.log(
              "CALL TYPE:",
              callType
            );
            console.log("================================");

            // ====================================================
            // CREATE CALLER PEER
            // ====================================================

            const peer =
              createPeer(
                receiver._id,
                callId
              );

            // ====================================================
            // ADD CALLER TRACKS
            // ====================================================

            stream
              .getTracks()
              .forEach(
                (track) => {
                  console.log(
                    "ADDING CALLER TRACK:",
                    track.kind
                  );

                  peer.addTrack(
                    track,
                    stream
                  );
                }
              );

            console.log(
              "CALLER SENDERS:",
              peer
                .getSenders()
                .map(
                  (sender) => ({
                    kind:
                      sender.track
                        ?.kind,

                    id:
                      sender.track
                        ?.id,
                  })
                )
            );

            // ====================================================
            // CREATE OFFER
            // ====================================================

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

            // ====================================================
            // SEND OFFER
            //
            // IMPORTANT:
            // type is included here.
            // ====================================================

            console.log("================================");
            console.log(
              "SENDING OFFER"
            );

            console.log({
              to:
                receiver._id,
              callId,
              type: callType,
            });

            console.log("================================");

            socket.emit(
              "webrtc:offer",
              {
                to:
                  receiver._id,

                callId,

                offer:
                  peer.localDescription,

                type:
                  callType,
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

            setStatus(
              "failed"
            );

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

      setStatus(
        "failed"
      );

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
    if (!incoming) {
      return;
    }

    try {
      setError("");

      const socket =
        getSocket();

      if (!socket) {
        throw new Error(
          "Socket connection is not available."
        );
      }

      // ----------------------------------------------------------
      // GET CALL DATA
      // ----------------------------------------------------------

      const remoteId =
        incoming.from?._id ||
        incoming.from;

      const incomingType =
        incoming.call?.type ||
        "voice";

      const callType =
        incomingType === "video"
          ? "video"
          : "voice";

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
      console.log(
        "ACCEPTING CALL"
      );

      console.log({
        remoteId,
        incomingType,
        normalizedType:
          callType,
        callId,
      });

      console.log("================================");

      // ==========================================================
      // ACCEPT STATE
      // ==========================================================

      acceptedRef.current =
        true;

      currentCallIdRef.current =
        callId;

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

      // ----------------------------------------------------------
      // SAVE CALL TYPE
      // ----------------------------------------------------------

      setCall({
        ...incoming.call,
        type:
          incoming.call?.type ||
          callType,
      });

      setIncoming(null);

      setStatus(
        "connecting"
      );

      // ==========================================================
      // INFORM SERVER
      // ==========================================================

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

      // ==========================================================
      // OFFER MAY HAVE ARRIVED BEFORE ACCEPT
      //
      // THIS WAS THE MAIN BUG.
      //
      // queuedOffer could contain:
      //
      // type: "voice"
      //
      // or no type at all.
      //
      // We force it to the actual incoming call type.
      // ==========================================================

      if (
        pendingOfferRef.current
      ) {
        const queuedOffer =
          pendingOfferRef.current;

        pendingOfferRef.current =
          null;

        const queuedOfferType =
          queuedOffer.type ===
          "video"
            ? "video"
            : callType;

        console.log("================================");
        console.log(
          "PROCESSING QUEUED OFFER"
        );

        console.log({
          originalOfferType:
            queuedOffer.type,

          incomingCallType:
            callType,

          finalOfferType:
            queuedOfferType,

          callId:
            queuedOffer.callId,
        });

        console.log("================================");

        await handleOffer({
          ...queuedOffer,

          type:
            queuedOfferType,

          callId:
            queuedOffer.callId ||
            callId,

          from:
            queuedOffer.from ||
            incoming.from,
        });
      } else {
        console.log(
          "NO QUEUED OFFER - WAITING FOR OFFER"
        );
      }
    } catch (err) {
      console.error(
        "ACCEPT CALL FAILED:",
        err
      );

      setStatus(
        "failed"
      );

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
    const socket =
      getSocket();

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

    pendingOfferRef.current =
      null;

    pendingCandidatesRef.current =
      [];

    acceptedRef.current =
      false;

    setIncoming(null);

    setStatus(
      "idle"
    );
  };

  // ============================================================
  // END CALL
  // ============================================================

  const endCall = () => {
    const socket =
      getSocket();

    const remoteId =
      remoteUserRef.current?._id ||
      remoteUserRef.current;

    const callId =
      call?._id ||
      currentCallIdRef.current;

    console.log("================================");
    console.log(
      "ENDING CALL"
    );

    console.log({
      remoteId,
      callId,
    });

    console.log("================================");

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
  // MUTE
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

    const newMuted =
      !muted;

    tracks.forEach(
      (track) => {
        track.enabled =
          !newMuted;
      }
    );

    setMuted(
      newMuted
    );

    console.log(
      "MICROPHONE:",
      newMuted
        ? "OFF"
        : "ON"
    );
  };

  // ============================================================
  // CAMERA
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

    tracks.forEach(
      (track) => {
        track.enabled =
          !newCameraOff;
      }
    );

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
    const socket =
      getSocket();

    if (
      !socket ||
      !currentUser
    ) {
      return;
    }

    // ==========================================================
    // INCOMING CALL
    // ==========================================================

    const onRing = (
      payload
    ) => {
      console.log("================================");
      console.log(
        "INCOMING CALL"
      );

      console.log(
        payload
      );

      console.log("================================");

      acceptedRef.current =
        false;

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

      setIncoming(
        payload
      );

      setStatus(
        "ringing"
      );
    };

    // ==========================================================
    // WEBRTC OFFER
    // ==========================================================

    const onOffer = async (
      payload
    ) => {
      try {
        console.log("================================");
        console.log(
          "WEBRTC OFFER RECEIVED"
        );

        console.log(
          payload
        );

        console.log("================================");

        if (!payload?.offer) {
          console.error(
            "OFFER IS MISSING"
          );

          return;
        }

        // ======================================================
        // NORMALIZE OFFER TYPE
        //
        // If backend sends type, use it.
        //
        // Otherwise use incoming.call.type.
        //
        // This prevents video becoming voice.
        // ======================================================

        const fallbackType =
          incoming?.call?.type ||
          call?.type ||
          "voice";

        const offerType =
          payload.type === "video"
            ? "video"
            : fallbackType ===
              "video"
            ? "video"
            : "voice";

        const fixedPayload = {
          ...payload,
          type: offerType,
        };

        console.log("================================");
        console.log(
          "NORMALIZED OFFER"
        );

        console.log({
          originalType:
            payload.type,

          incomingType:
            incoming?.call?.type,

          currentCallType:
            call?.type,

          finalType:
            offerType,
        });

        console.log("================================");

        // ======================================================
        // OFFER BEFORE ACCEPT
        // ======================================================

        if (
          !acceptedRef.current
        ) {
          console.log(
            "OFFER RECEIVED BEFORE ACCEPT"
          );

          pendingOfferRef.current =
            fixedPayload;

          if (
            fixedPayload.callId
          ) {
            currentCallIdRef.current =
              fixedPayload.callId;
          }

          if (
            fixedPayload.from
          ) {
            remoteUserRef.current =
              fixedPayload.from;
          }

          console.log(
            "OFFER QUEUED"
          );

          return;
        }

        // ======================================================
        // CALL ALREADY ACCEPTED
        // ======================================================

        console.log(
          "CALL ALREADY ACCEPTED"
        );

        await handleOffer(
          fixedPayload
        );
      } catch (err) {
        console.error(
          "OFFER EVENT FAILED:",
          err
        );

        setStatus(
          "failed"
        );

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

        console.log(
          payload
        );

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
            "SIGNALING STATE:",
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

        // ======================================================
        // ADD QUEUED ICE
        // ======================================================

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

        setStatus(
          "connecting"
        );
      } catch (err) {
        console.error(
          "ANSWER HANDLING FAILED:",
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

        if (!candidate) {
          return;
        }

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
        // QUEUE UNTIL REMOTE DESCRIPTION
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
        // ADD CANDIDATE
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
    incoming,
    call,
  ]);

  // ============================================================
  // LOCAL VIDEO ATTACH
  // ============================================================

  useEffect(() => {
    if (
      !localStream ||
      !localVideoRef.current
    ) {
      return;
    }

    const video =
      localVideoRef.current;

    video.srcObject =
      localStream;

    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    video.play().catch(
      () => {}
    );
  }, [
    localStream,
    cameraOff,
  ]);

  // ============================================================
  // REMOTE MEDIA ATTACH
  // ============================================================

  useEffect(() => {
    const stream =
      remoteStreamRef.current;

    if (!stream) {
      return;
    }

    console.log(
      "RE-ATTACHING REMOTE STREAM"
    );

    console.log(
      "REMOTE TRACKS:",
      stream
        .getTracks()
        .map(
          (track) =>
            track.kind
        )
    );

    // ----------------------------------------------------------
    // REMOTE VIDEO
    // ----------------------------------------------------------

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject =
        stream;

      remoteVideoRef.current
        .play()
        .catch(
          () => {}
        );
    }

    // ----------------------------------------------------------
    // REMOTE AUDIO
    // ----------------------------------------------------------

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject =
        stream;

      remoteAudioRef.current.muted =
        false;

      remoteAudioRef.current.volume =
        1;

      remoteAudioRef.current
        .play()
        .catch(
          () => {}
        );
    }
  }, [
    status,
  ]);

  // ============================================================
  // RETURN
  // ============================================================

  return {
    call,
    incoming,
    status,

    muted,
    cameraOff,

    error,

    localStream,

    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,

    startCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMute,
    toggleCamera,

    remoteUser:
      remoteUserRef.current,

    callType:
      call?.type ||
      incoming?.call?.type ||
      "voice",
  };
}
