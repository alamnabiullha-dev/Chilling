
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../socket/client";

const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    {
      urls: "stun:stun1.l.google.com:19302",
    },
  ],
};

export default function useCallManager() {
  // =========================================================
  // REFS
  // =========================================================

  const socketRef = useRef(null);
  const peerRef = useRef(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const pendingIceCandidates = useRef([]);

  // Stores the current call without relying on React state timing
  const callRef = useRef(null);

  // Stores an offer received before the receiver is ready
  const pendingOfferRef = useRef(null);

  // =========================================================
  // STATE
  // =========================================================

  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const [connected, setConnected] = useState(false);

  // =========================================================
  // SOCKET
  // =========================================================

  const getCurrentSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
    }

    return socketRef.current;
  }, []);

  // =========================================================
  // SET CALL HELPER
  // =========================================================

  const updateCall = useCallback((data) => {
    callRef.current = data;
    setCall(data);
  }, []);

  // =========================================================
  // CLEANUP MEDIA / PEER
  // =========================================================

  const cleanupCall = useCallback(() => {
    console.log("🧹 Cleaning up call");

    // Close peer
    if (peerRef.current) {
      try {
        peerRef.current.onicecandidate = null;
        peerRef.current.ontrack = null;
        peerRef.current.close();
      } catch (error) {
        console.error("Peer cleanup error:", error);
      }

      peerRef.current = null;
    }

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            console.error("Track stop error:", error);
          }
        });

      localStreamRef.current = null;
    }

    remoteStreamRef.current = null;

    pendingIceCandidates.current = [];
    pendingOfferRef.current = null;

    callRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setCall(null);
    setIncoming(null);

    setIsMuted(false);
    setIsCameraOff(false);
    setConnected(false);
  }, []);

  // =========================================================
  // CREATE PEER CONNECTION
  // =========================================================

  const createPeerConnection = useCallback(() => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const socket = getCurrentSocket();

    if (!socket) {
      console.error("❌ Socket is not available");
      return null;
    }

    console.log("🔗 Creating RTCPeerConnection");

    const peer = new RTCPeerConnection(ICE_SERVERS);

    // -------------------------------------------------------
    // ICE CANDIDATE
    // -------------------------------------------------------

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      const currentCall = callRef.current;

      if (!currentCall) {
        console.warn(
          "⚠️ No current call while sending ICE candidate"
        );
        return;
      }

      const callId =
        currentCall.callId ||
        currentCall._id ||
        currentCall.id ||
        currentCall.call?._id ||
        currentCall.call?.id;

      console.log("🧊 Sending ICE candidate");

      socket.emit("webrtc:ice-candidate", {
        callId,
        candidate: event.candidate,
      });
    };

    // -------------------------------------------------------
    // REMOTE TRACK
    // -------------------------------------------------------

    peer.ontrack = (event) => {
      console.log(
        "🎧 Remote track received:",
        event.track.kind
      );

      let stream = remoteStreamRef.current;

      if (!stream) {
        stream = new MediaStream();
        remoteStreamRef.current = stream;
      }

      const exists = stream
        .getTracks()
        .some(
          (track) =>
            track.id === event.track.id
        );

      if (!exists) {
        stream.addTrack(event.track);
      }

      setRemoteStream(stream);
    };

    // -------------------------------------------------------
    // CONNECTION STATE
    // -------------------------------------------------------

    peer.onconnectionstatechange = () => {
      console.log(
        "🔗 WebRTC connection state:",
        peer.connectionState
      );

      if (peer.connectionState === "connected") {
        setConnected(true);
      }

      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "disconnected" ||
        peer.connectionState === "closed"
      ) {
        setConnected(false);
      }
    };

    // -------------------------------------------------------
    // ICE CONNECTION STATE
    // -------------------------------------------------------

    peer.oniceconnectionstatechange = () => {
      console.log(
        "🧊 ICE connection state:",
        peer.iceConnectionState
      );

      if (
        peer.iceConnectionState === "failed"
      ) {
        console.warn(
          "⚠️ ICE connection failed"
        );
      }
    };

    peerRef.current = peer;

    return peer;
  }, [getCurrentSocket]);

  // =========================================================
  // GET LOCAL MEDIA
  // =========================================================

  const getLocalMedia = useCallback(
    async (video = false) => {
      try {
        // If already have a stream, reuse it
        if (localStreamRef.current) {
          const existing = localStreamRef.current;

          // For video call, make sure video exists
          if (
            video &&
            existing.getVideoTracks().length === 0
          ) {
            const videoStream =
              await navigator.mediaDevices.getUserMedia({
                video: true,
              });

            videoStream
              .getVideoTracks()
              .forEach((track) => {
                existing.addTrack(track);
              });

            setLocalStream(existing);
          }

          return existing;
        }

        console.log(
          `🎤 Requesting ${video ? "audio + video" : "audio"}`
        );

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video,
          });

        localStreamRef.current = stream;

        setLocalStream(stream);

        console.log("✅ Local media ready", {
          audio:
            stream.getAudioTracks().length,
          video:
            stream.getVideoTracks().length,
        });

        return stream;
      } catch (error) {
        console.error(
          "❌ getUserMedia error:",
          error
        );

        throw error;
      }
    },
    []
  );

  // =========================================================
  // ADD LOCAL TRACKS
  // =========================================================

  const addLocalTracks = useCallback(
    async (video = false) => {
      const peer = peerRef.current;

      if (!peer) {
        console.error(
          "❌ Peer connection does not exist"
        );
        return;
      }

      const stream =
        await getLocalMedia(video);

      const senders = peer.getSenders();

      stream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some(
          (sender) =>
            sender.track?.id === track.id
        );

        if (!alreadyAdded) {
          console.log(
            "➕ Adding local track:",
            track.kind
          );

          peer.addTrack(track, stream);
        }
      });
    },
    [getLocalMedia]
  );

  // =========================================================
  // START CALL
  // =========================================================

  const startCall = useCallback(
    async ({
      userId,
      type = "voice",
      receiverId,
      targetUserId,
      conversationId,
      chatId,
      receiver,
    }) => {
      try {
        const socket =
          getCurrentSocket();

        if (!socket) {
          console.error(
            "❌ Socket not connected"
          );
          return;
        }

        // ---------------------------------------------------
        // Resolve receiver ID
        // ---------------------------------------------------

        const finalReceiverId =
          receiverId ||
          targetUserId ||
          userId ||
          receiver?._id;

        if (!finalReceiverId) {
          console.error(
            "❌ Receiver user ID missing"
          );
          return;
        }

        const isVideo = type === "video";

        console.log(
          `📞 Starting ${
            isVideo ? "video" : "voice"
          } call`
        );

        // ---------------------------------------------------
        // Get camera/microphone
        // ---------------------------------------------------

        const stream =
          await getLocalMedia(isVideo);

        // ---------------------------------------------------
        // Create peer
        // ---------------------------------------------------

        const peer =
          createPeerConnection();

        if (!peer) {
          return;
        }

        // ---------------------------------------------------
        // Add tracks
        // ---------------------------------------------------

        stream.getTracks().forEach((track) => {
          const exists =
            peer
              .getSenders()
              .some(
                (sender) =>
                  sender.track?.id ===
                  track.id
              );

          if (!exists) {
            peer.addTrack(
              track,
              stream
            );
          }
        });

        // ---------------------------------------------------
        // Create call data
        // ---------------------------------------------------

        const callData = {
          receiverId:
            finalReceiverId,

          targetUserId:
            finalReceiverId,

          type,

          video: isVideo,

          conversationId,

          chatId,
        };

        // ---------------------------------------------------
        // IMPORTANT:
        // First initiate call.
        // Do NOT send WebRTC offer yet.
        // Offer will be sent after receiver accepts.
        // ---------------------------------------------------

        console.log(
          "📤 Sending call:initiate",
          callData
        );

        socket.emit(
          "call:initiate",
          callData
        );

        // ---------------------------------------------------
        // Save call state
        // ---------------------------------------------------

        updateCall({
          ...callData,

          callerId:
            socket.id,

          isCaller: true,

          status: "calling",
        });

        console.log(
          "⏳ Waiting for receiver to accept..."
        );
      } catch (error) {
        console.error(
          "❌ Start call error:",
          error
        );

        cleanupCall();
      }
    },
    [
      cleanupCall,
      createPeerConnection,
      getCurrentSocket,
      getLocalMedia,
      updateCall,
    ]
  );

  // =========================================================
  // ACCEPT CALL
  // =========================================================

  const acceptCall = useCallback(
    async () => {
      try {
        if (!incoming) {
          console.error(
            "❌ No incoming call"
          );
          return;
        }

        const socket =
          getCurrentSocket();

        if (!socket) {
          console.error(
            "❌ Socket not connected"
          );
          return;
        }

        const isVideo =
          incoming.video === true ||
          incoming.type === "video" ||
          incoming.call?.video === true ||
          incoming.call?.type === "video";

        console.log(
          `📲 Accepting ${
            isVideo ? "video" : "voice"
          } call`
        );

        // ---------------------------------------------------
        // Get local media
        // ---------------------------------------------------

        const stream =
          await getLocalMedia(isVideo);

        // ---------------------------------------------------
        // Create peer
        // ---------------------------------------------------

        const peer =
          createPeerConnection();

        if (!peer) {
          return;
        }

        // ---------------------------------------------------
        // Add local tracks
        // ---------------------------------------------------

        stream.getTracks().forEach((track) => {
          const exists =
            peer
              .getSenders()
              .some(
                (sender) =>
                  sender.track?.id ===
                  track.id
              );

          if (!exists) {
            peer.addTrack(
              track,
              stream
            );
          }
        });

        // ---------------------------------------------------
        // Resolve call ID
        // ---------------------------------------------------

        const callId =
          incoming.callId ||
          incoming._id ||
          incoming.id ||
          incoming.call?._id ||
          incoming.call?.id;

        const callerId =
          incoming.callerId ||
          incoming.from?._id ||
          incoming.from ||
          incoming.userId;

        const receiverId =
          incoming.receiverId ||
          incoming.to ||
          incoming.targetUserId;

        // ---------------------------------------------------
        // Save call
        // ---------------------------------------------------

        const acceptedCall = {
          ...incoming,

          callId,

          callerId,

          receiverId,

          type: isVideo
            ? "video"
            : "voice",

          video: isVideo,

          isCaller: false,

          status: "connected",
        };

        updateCall(acceptedCall);

        // Hide incoming screen
        setIncoming(null);

        // ---------------------------------------------------
        // Tell caller we accepted
        // ---------------------------------------------------

        console.log(
          "📤 Sending call:accept"
        );

        socket.emit(
          "call:accept",
          {
            callId,
            callerId,
            receiverId,
          }
        );

        // ---------------------------------------------------
        // If offer arrived before accept,
        // process it now.
        // ---------------------------------------------------

        if (pendingOfferRef.current) {
          const offer =
            pendingOfferRef.current;

          pendingOfferRef.current = null;

          await processOffer(
            offer,
            peer,
            socket
          );
        }

        console.log(
          "✅ Call accepted"
        );
      } catch (error) {
        console.error(
          "❌ Accept call error:",
          error
        );
      }
    },
    [
      incoming,
      createPeerConnection,
      getCurrentSocket,
      getLocalMedia,
      updateCall,
    ]
  );

  // =========================================================
  // PROCESS WEBRTC OFFER
  // =========================================================

  const processOffer = useCallback(
    async (
      data,
      peer,
      socket
    ) => {
      try {
        if (!data?.offer) {
          console.error(
            "❌ WebRTC offer missing"
          );
          return;
        }

        const isVideo =
          data.video === true ||
          data.type === "video";

        console.log(
          `📥 Processing ${
            isVideo
              ? "video"
              : "voice"
          } offer`
        );

        // ---------------------------------------------------
        // Make sure local tracks exist
        // ---------------------------------------------------

        if (
          localStreamRef.current
            ?.getTracks()
            ?.length === 0
        ) {
          await addLocalTracks(
            isVideo
          );
        }

        // ---------------------------------------------------
        // Set remote description
        // ---------------------------------------------------

        if (
          peer.signalingState !==
          "stable"
        ) {
          console.log(
            "⚠️ Peer signaling state:",
            peer.signalingState
          );
        }

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            data.offer
          )
        );

        // ---------------------------------------------------
        // Add queued ICE candidates
        // ---------------------------------------------------

        for (const candidate of
          pendingIceCandidates.current) {
          try {
            await peer.addIceCandidate(
              candidate
            );
          } catch (error) {
            console.error(
              "❌ Pending ICE error:",
              error
            );
          }
        }

        pendingIceCandidates.current =
          [];

        // ---------------------------------------------------
        // Create answer
        // ---------------------------------------------------

        const answer =
          await peer.createAnswer();

        await peer.setLocalDescription(
          answer
        );

        // ---------------------------------------------------
        // Send answer
        // ---------------------------------------------------

        const callId =
          data.callId ||
          data._id ||
          data.id ||
          data.call?._id ||
          data.call?.id ||
          callRef.current?.callId ||
          callRef.current?._id;

        console.log(
          "📤 Sending WebRTC answer"
        );

        socket.emit(
          "webrtc:answer",
          {
            callId,
            answer,
          }
        );

        updateCall({
          ...(callRef.current || {}),
          ...(data || {}),
          callId,
          status: "connecting",
        });

        console.log(
          "✅ WebRTC answer sent"
        );
      } catch (error) {
        console.error(
          "❌ Offer processing error:",
          error
        );
      }
    },
    [
      addLocalTracks,
      updateCall,
    ]
  );

  // =========================================================
  // REJECT CALL
  // =========================================================

  const rejectCall = useCallback(
    () => {
      try {
        const socket =
          getCurrentSocket();

        if (!socket) {
          return;
        }

        const callId =
          incoming?.callId ||
          incoming?._id ||
          incoming?.id ||
          incoming?.call?._id ||
          incoming?.call?.id;

        const callerId =
          incoming?.callerId ||
          incoming?.from?._id ||
          incoming?.from ||
          incoming?.userId;

        console.log(
          "❌ Rejecting call"
        );

        socket.emit(
          "call:reject",
          {
            callId,
            callerId,
          }
        );

        setIncoming(null);
      } catch (error) {
        console.error(
          "❌ Reject call error:",
          error
        );
      }
    },
    [
      incoming,
      getCurrentSocket,
    ]
  );

  // =========================================================
  // END CALL
  // =========================================================

  const endCall = useCallback(
    () => {
      try {
        const socket =
          getCurrentSocket();

        const currentCall =
          callRef.current;

        const callId =
          currentCall?.callId ||
          currentCall?._id ||
          currentCall?.id ||
          currentCall?.call?._id ||
          currentCall?.call?.id;

        console.log(
          "📴 Ending call:",
          callId
        );

        if (socket) {
          socket.emit(
            "call:end",
            {
              callId,
            }
          );
        }

        cleanupCall();
      } catch (error) {
        console.error(
          "❌ End call error:",
          error
        );
      }
    },
    [
      cleanupCall,
      getCurrentSocket,
    ]
  );

  // =========================================================
  // MUTE
  // =========================================================

  const toggleMute = useCallback(
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        return;
      }

      const tracks =
        stream.getAudioTracks();

      if (tracks.length === 0) {
        return;
      }

      tracks.forEach((track) => {
        track.enabled =
          !track.enabled;
      });

      setIsMuted(
        (previous) => !previous
      );
    },
    []
  );

  // =========================================================
  // CAMERA
  // =========================================================

  const toggleCamera = useCallback(
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        return;
      }

      const tracks =
        stream.getVideoTracks();

      if (tracks.length === 0) {
        return;
      }

      tracks.forEach((track) => {
        track.enabled =
          !track.enabled;
      });

      setIsCameraOff(
        (previous) => !previous
      );
    },
    []
  );

  // =========================================================
  // SOCKET EVENTS
  // =========================================================

  useEffect(() => {
    const socket =
      getCurrentSocket();

    if (!socket) {
      console.warn(
        "⚠️ Socket unavailable"
      );
      return;
    }

    // -------------------------------------------------------
    // INCOMING CALL
    // -------------------------------------------------------

    const handleIncomingCall = (
      data
    ) => {
      console.log(
        "📞 Incoming call:",
        data
      );

      setIncoming(data);

      updateCall({
        ...(data || {}),
        status: "ringing",
        isCaller: false,
      });
    };

    // -------------------------------------------------------
    // CALL ACCEPTED
    // -------------------------------------------------------

    const handleCallAccepted =
      async (data) => {
        try {
          console.log(
            "✅ Remote user accepted call:",
            data
          );

          const peer =
            peerRef.current;

          if (!peer) {
            console.error(
              "❌ Peer connection missing"
            );
            return;
          }

          const currentCall =
            callRef.current || {};

          const mergedCall = {
            ...currentCall,
            ...(data || {}),
            status: "connecting",
            isCaller: true,
          };

          updateCall(
            mergedCall
          );

          // ------------------------------------------------
          // Now create offer.
          // Receiver has accepted.
          // ------------------------------------------------

          console.log(
            "📤 Creating WebRTC offer after accept"
          );

          const offer =
            await peer.createOffer();

          await peer.setLocalDescription(
            offer
          );

          console.log(
            "📤 Sending WebRTC offer"
          );

          socket.emit(
            "webrtc:offer",
            {
              ...mergedCall,
              offer,
            }
          );
        } catch (error) {
          console.error(
            "❌ Call accepted handling error:",
            error
          );
        }
      };

    // -------------------------------------------------------
    // WEBRTC OFFER
    // -------------------------------------------------------

    const handleOffer = async (
      data
    ) => {
      try {
        console.log(
          "📥 WebRTC offer received"
        );

        const peer =
          createPeerConnection();

        if (!peer) {
          return;
        }

        // ---------------------------------------------------
        // If receiver hasn't accepted yet,
        // save offer and process after Accept.
        // ---------------------------------------------------

        if (
          !callRef.current ||
          callRef.current.isCaller
        ) {
          console.log(
            "⏳ Saving offer until receiver is ready"
          );

          pendingOfferRef.current =
            data;

          return;
        }

        await processOffer(
          data,
          peer,
          socket
        );
      } catch (error) {
        console.error(
          "❌ WebRTC offer handling error:",
          error
        );
      }
    };

    // -------------------------------------------------------
    // WEBRTC ANSWER
    // -------------------------------------------------------

    const handleAnswer =
      async (data) => {
        try {
          console.log(
            "📥 WebRTC answer received"
          );

          const peer =
            peerRef.current;

          if (!peer) {
            console.error(
              "❌ Peer connection missing"
            );
            return;
          }

          if (!data?.answer) {
            console.error(
              "❌ Answer missing"
            );
            return;
          }

          await peer.setRemoteDescription(
            new RTCSessionDescription(
              data.answer
            )
          );

          console.log(
            "✅ Remote answer set"
          );

          // ------------------------------------------------
          // Add queued ICE candidates
          // ------------------------------------------------

          for (const candidate of
            pendingIceCandidates.current) {
            try {
              await peer.addIceCandidate(
                candidate
              );
            } catch (error) {
              console.error(
                "❌ Pending ICE error:",
                error
              );
            }
          }

          pendingIceCandidates.current =
            [];

          updateCall({
            ...(callRef.current || {}),
            ...(data || {}),
            status: "connected",
            isCaller: true,
          });
        } catch (error) {
          console.error(
            "❌ WebRTC answer handling error:",
            error
          );
        }
      };

    // -------------------------------------------------------
    // ICE CANDIDATE
    // -------------------------------------------------------

    const handleIceCandidate =
      async (data) => {
        try {
          if (!data?.candidate) {
            return;
          }

          const candidate =
            new RTCIceCandidate(
              data.candidate
            );

          const peer =
            peerRef.current;

          if (!peer) {
            console.log(
              "⚠️ Peer not ready. Queueing ICE"
            );

            pendingIceCandidates.current.push(
              candidate
            );

            return;
          }

          if (
            peer.remoteDescription
          ) {
            await peer.addIceCandidate(
              candidate
            );

            console.log(
              "🧊 ICE candidate added"
            );
          } else {
            console.log(
              "⏳ Remote description not ready. Queueing ICE"
            );

            pendingIceCandidates.current.push(
              candidate
            );
          }
        } catch (error) {
          console.error(
            "❌ ICE candidate error:",
            error
          );
        }
      };

    // -------------------------------------------------------
    // CALL REJECTED
    // -------------------------------------------------------

    const handleCallRejected =
      () => {
        console.log(
          "❌ Call rejected by receiver"
        );

        cleanupCall();
      };

    // -------------------------------------------------------
    // CALL ENDED
    // -------------------------------------------------------

    const handleCallEnded =
      () => {
        console.log(
          "📴 Remote user ended call"
        );

        cleanupCall();
      };

    // -------------------------------------------------------
    // REGISTER EVENTS
    // -------------------------------------------------------

    socket.on(
      "call:incoming",
      handleIncomingCall
    );

    socket.on(
      "call:offer",
      handleIncomingCall
    );

    socket.on(
      "call:accepted",
      handleCallAccepted
    );

    socket.on(
      "webrtc:offer",
      handleOffer
    );

    socket.on(
      "webrtc:answer",
      handleAnswer
    );

    socket.on(
      "webrtc:ice-candidate",
      handleIceCandidate
    );

    socket.on(
      "call:rejected",
      handleCallRejected
    );

    socket.on(
      "call:ended",
      handleCallEnded
    );

    // -------------------------------------------------------
    // CLEANUP LISTENERS
    // -------------------------------------------------------

    return () => {
      socket.off(
        "call:incoming",
        handleIncomingCall
      );

      socket.off(
        "call:offer",
        handleIncomingCall
      );

      socket.off(
        "call:accepted",
        handleCallAccepted
      );

      socket.off(
        "webrtc:offer",
        handleOffer
      );

      socket.off(
        "webrtc:answer",
        handleAnswer
      );

      socket.off(
        "webrtc:ice-candidate",
        handleIceCandidate
      );

      socket.off(
        "call:rejected",
        handleCallRejected
      );

      socket.off(
        "call:ended",
        handleCallEnded
      );
    };
  }, [
    createPeerConnection,
    cleanupCall,
    getCurrentSocket,
    processOffer,
    updateCall,
  ]);

  // =========================================================
  // CLEANUP ON UNMOUNT
  // =========================================================

  useEffect(() => {
    return () => {
      if (peerRef.current) {
        try {
          peerRef.current.close();
        } catch {}
        peerRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => {
            try {
              track.stop();
            } catch {}
          });

        localStreamRef.current = null;
      }

      remoteStreamRef.current = null;
      pendingIceCandidates.current = [];
      pendingOfferRef.current = null;
      callRef.current = null;
    };
  }, []);

  // =========================================================
  // RETURN
  // =========================================================

  return {
    call,
    incoming,

    localStream,
    remoteStream,

    connected,

    // CallOverlay uses these names
    muted: isMuted,
    cameraOff: isCameraOff,

    // Also expose original names
    isMuted,
    isCameraOff,

    startCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMute,
    toggleCamera,

    getLocalMedia,

    localVideoRef: null,
    remoteVideoRef: null,
  };
}


