
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
  const socketRef = useRef(null);
  const peerRef = useRef(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const pendingIceCandidates = useRef([]);

  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const [connected, setConnected] = useState(false);

  // --------------------------------------------------
  // SOCKET
  // --------------------------------------------------

  const getCurrentSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
    }

    return socketRef.current;
  }, []);

  // --------------------------------------------------
  // CREATE PEER CONNECTION
  // --------------------------------------------------

  const createPeerConnection = useCallback(() => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const socket = getCurrentSocket();

    if (!socket) {
      console.error("❌ Socket is not available");
      return null;
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;

      const currentCall = call;

      if (!currentCall) {
        console.log("⚠️ No call available for ICE candidate");
        return;
      }

      socket.emit("webrtc:ice-candidate", {
        callId: currentCall._id || currentCall.id || currentCall.callId,
        candidate: event.candidate,
      });
    };

    peer.ontrack = (event) => {
      console.log("🎧 Remote track received:", event.track.kind);

      let stream = remoteStreamRef.current;

      if (!stream) {
        stream = new MediaStream();
        remoteStreamRef.current = stream;
      }

      const alreadyExists = stream
        .getTracks()
        .some((track) => track.id === event.track.id);

      if (!alreadyExists) {
        stream.addTrack(event.track);
      }

      setRemoteStream(stream);
    };

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

    peer.oniceconnectionstatechange = () => {
      console.log(
        "🧊 ICE connection state:",
        peer.iceConnectionState
      );
    };

    peerRef.current = peer;

    return peer;
  }, [call, getCurrentSocket]);

  // --------------------------------------------------
  // GET LOCAL MEDIA
  // --------------------------------------------------

  const getLocalMedia = useCallback(
    async (video = false) => {
      try {
        if (localStreamRef.current) {
          return localStreamRef.current;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video,
        });

        localStreamRef.current = stream;
        setLocalStream(stream);

        console.log("🎤 Local media ready:", {
          audio: stream.getAudioTracks().length,
          video: stream.getVideoTracks().length,
        });

        return stream;
      } catch (error) {
        console.error("❌ getUserMedia error:", error);

        throw error;
      }
    },
    []
  );

  // --------------------------------------------------
  // ADD LOCAL TRACKS
  // --------------------------------------------------

  const addLocalTracks = useCallback(async (video = false) => {
    const peer = peerRef.current;

    if (!peer) {
      console.error("❌ Peer connection does not exist");
      return;
    }

    const stream = await getLocalMedia(video);

    const existingSenders = peer.getSenders();

    stream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some(
        (sender) => sender.track?.id === track.id
      );

      if (!alreadyAdded) {
        peer.addTrack(track, stream);
      }
    });
  }, [getLocalMedia]);

  // --------------------------------------------------
  // START CALL
  // --------------------------------------------------

  const startCall = useCallback(
    async ({
      userId,
      type = "audio",
      receiverId,
      targetUserId,
      conversationId,
      chatId,
    }) => {
      try {
        const socket = getCurrentSocket();

        if (!socket) {
          console.error("❌ Socket not connected");
          return;
        }

        const finalReceiverId =
          receiverId || targetUserId || userId;

        if (!finalReceiverId) {
          console.error("❌ Receiver user ID missing");
          return;
        }

        const isVideo = type === "video";

        console.log(
          `📞 Starting ${isVideo ? "video" : "audio"} call`
        );

        const stream = await getLocalMedia(isVideo);

        const peer = createPeerConnection();

        if (!peer) return;

        stream.getTracks().forEach((track) => {
          const alreadyAdded = peer
            .getSenders()
            .some((sender) => sender.track?.id === track.id);

          if (!alreadyAdded) {
            peer.addTrack(track, stream);
          }
        });

        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        const callData = {
          receiverId: finalReceiverId,
          targetUserId: finalReceiverId,
          type,
          video: isVideo,
          conversationId,
          chatId,
        };

        console.log("📤 Sending call:initiate");

        socket.emit("call:initiate", callData);

        setCall({
          ...callData,
          callerId: socket.id,
          isCaller: true,
        });

        console.log("📤 Sending WebRTC offer");

        socket.emit("webrtc:offer", {
          ...callData,
          offer,
        });
      } catch (error) {
        console.error("❌ Start call error:", error);
      }
    },
    [createPeerConnection, getCurrentSocket, getLocalMedia]
  );

  // --------------------------------------------------
  // ACCEPT CALL
  // --------------------------------------------------

  const acceptCall = useCallback(async () => {
    try {
      if (!incoming) {
        console.error("❌ No incoming call");
        return;
      }

      const socket = getCurrentSocket();

      if (!socket) {
        console.error("❌ Socket not connected");
        return;
      }

      const isVideo =
        incoming.video === true ||
        incoming.type === "video" ||
        incoming.call?.video === true ||
        incoming.call?.type === "video";

      console.log(
        `📲 Accepting ${isVideo ? "video" : "audio"} call`
      );

      const stream = await getLocalMedia(isVideo);

      const peer = createPeerConnection();

      if (!peer) return;

      stream.getTracks().forEach((track) => {
        const alreadyAdded = peer
          .getSenders()
          .some((sender) => sender.track?.id === track.id);

        if (!alreadyAdded) {
          peer.addTrack(track, stream);
        }
      });

      const callId =
        incoming.callId ||
        incoming._id ||
        incoming.id ||
        incoming.call?._id ||
        incoming.call?.id;

      setCall({
        ...incoming,
        isCaller: false,
      });

      setIncoming(null);

      socket.emit("call:accept", {
        callId,
        callerId:
          incoming.callerId ||
          incoming.from ||
          incoming.userId,
        receiverId:
          incoming.receiverId ||
          incoming.to,
      });

      console.log("✅ Call accepted");
    } catch (error) {
      console.error("❌ Accept call error:", error);
    }
  }, [incoming, createPeerConnection, getCurrentSocket, getLocalMedia]);

  // --------------------------------------------------
  // REJECT CALL
  // --------------------------------------------------

  const rejectCall = useCallback(() => {
    try {
      const socket = getCurrentSocket();

      if (!socket) return;

      const callId =
        incoming?.callId ||
        incoming?._id ||
        incoming?.id ||
        incoming?.call?._id ||
        incoming?.call?.id;

      socket.emit("call:reject", {
        callId,
        callerId:
          incoming?.callerId ||
          incoming?.from ||
          incoming?.userId,
      });

      setIncoming(null);

      console.log("❌ Call rejected");
    } catch (error) {
      console.error("❌ Reject call error:", error);
    }
  }, [incoming, getCurrentSocket]);

  // --------------------------------------------------
  // END CALL
  // --------------------------------------------------

  const endCall = useCallback(() => {
    try {
      const socket = getCurrentSocket();

      const callId =
        call?.callId ||
        call?._id ||
        call?.id ||
        call?.call?._id ||
        call?.call?.id;

      if (socket) {
        socket.emit("call:end", {
          callId,
        });
      }

      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        localStreamRef.current = null;
      }

      remoteStreamRef.current = null;

      setLocalStream(null);
      setRemoteStream(null);
      setCall(null);
      setIncoming(null);

      setIsMuted(false);
      setIsCameraOff(false);
      setConnected(false);

      console.log("📴 Call ended");
    } catch (error) {
      console.error("❌ End call error:", error);
    }
  }, [call, getCurrentSocket]);

  // --------------------------------------------------
  // MUTE / UNMUTE
  // --------------------------------------------------

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const audioTracks = stream.getAudioTracks();

    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });

    setIsMuted((prev) => !prev);
  }, []);

  // --------------------------------------------------
  // CAMERA ON/OFF
  // --------------------------------------------------

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const videoTracks = stream.getVideoTracks();

    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });

    setIsCameraOff((prev) => !prev);
  }, []);

  // --------------------------------------------------
  // SOCKET EVENTS
  // --------------------------------------------------

  useEffect(() => {
    const socket = getCurrentSocket();

    if (!socket) {
      console.warn("⚠️ Socket unavailable");
      return;
    }

    const handleIncomingCall = (data) => {
      console.log("📞 Incoming call:", data);

      setIncoming(data);
    };

    const handleCallAccepted = async (data) => {
      try {
        console.log("✅ Remote user accepted call:", data);

        const peer = peerRef.current;

        if (!peer) {
          console.error("❌ Peer connection missing");
          return;
        }

        setCall((prev) => ({
          ...(prev || {}),
          ...(data || {}),
          isCaller: true,
        }));

        const currentDescription =
          peer.localDescription;

        if (!currentDescription) {
          console.error("❌ Local offer missing");
          return;
        }

        socket.emit("webrtc:offer", {
          ...(call || {}),
          ...(data || {}),
          offer: currentDescription,
        });
      } catch (error) {
        console.error(
          "❌ Call accepted handling error:",
          error
        );
      }
    };

    const handleOffer = async (data) => {
      try {
        console.log("📥 WebRTC offer received");

        const peer = createPeerConnection();

        if (!peer) return;

        const isVideo =
          data?.video === true ||
          data?.type === "video";

        if (!localStreamRef.current) {
          await addLocalTracks(isVideo);
        } else {
          const existingSenders = peer.getSenders();

          localStreamRef.current
            .getTracks()
            .forEach((track) => {
              const alreadyAdded = existingSenders.some(
                (sender) =>
                  sender.track?.id === track.id
              );

              if (!alreadyAdded) {
                peer.addTrack(
                  track,
                  localStreamRef.current
                );
              }
            });
        }

        await peer.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );

        const answer = await peer.createAnswer();

        await peer.setLocalDescription(answer);

        socket.emit("webrtc:answer", {
          callId:
            data.callId ||
            data._id ||
            data.id,
          answer,
        });

        console.log("📤 WebRTC answer sent");
      } catch (error) {
        console.error(
          "❌ WebRTC offer handling error:",
          error
        );
      }
    };

    const handleAnswer = async (data) => {
      try {
        console.log("📥 WebRTC answer received");

        const peer = peerRef.current;

        if (!peer) {
          console.error("❌ Peer connection missing");
          return;
        }

        if (!data?.answer) {
          console.error("❌ Answer missing");
          return;
        }

        await peer.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );

        console.log("✅ Remote answer set");

        for (const candidate of pendingIceCandidates.current) {
          try {
            await peer.addIceCandidate(candidate);
          } catch (error) {
            console.error(
              "❌ Pending ICE candidate error:",
              error
            );
          }
        }

        pendingIceCandidates.current = [];
      } catch (error) {
        console.error(
          "❌ WebRTC answer handling error:",
          error
        );
      }
    };

    const handleIceCandidate = async (data) => {
      try {
        if (!data?.candidate) return;

        const peer = peerRef.current;

        if (!peer) {
          console.warn(
            "⚠️ Peer not ready, storing ICE candidate"
          );

          pendingIceCandidates.current.push(
            new RTCIceCandidate(data.candidate)
          );

          return;
        }

        if (peer.remoteDescription) {
          await peer.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );

          console.log("🧊 ICE candidate added");
        } else {
          pendingIceCandidates.current.push(
            new RTCIceCandidate(data.candidate)
          );
        }
      } catch (error) {
        console.error(
          "❌ ICE candidate error:",
          error
        );
      }
    };

    const handleCallRejected = () => {
      console.log("❌ Call rejected by receiver");

      setIncoming(null);
      setCall(null);

      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      setConnected(false);
    };

    const handleCallEnded = () => {
      console.log("📴 Remote user ended call");

      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        localStreamRef.current = null;
      }

      remoteStreamRef.current = null;

      setLocalStream(null);
      setRemoteStream(null);
      setCall(null);
      setIncoming(null);

      setIsMuted(false);
      setIsCameraOff(false);
      setConnected(false);
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:offer", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on(
      "webrtc:ice-candidate",
      handleIceCandidate
    );
    socket.on("call:rejected", handleCallRejected);
    socket.on("call:ended", handleCallEnded);

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
    call,
    createPeerConnection,
    addLocalTracks,
    getCurrentSocket,
  ]);

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        localStreamRef.current = null;
      }
    };
  }, []);

  // --------------------------------------------------
  // RETURN
  // --------------------------------------------------

  return {
    call,
    incoming,

    localStream,
    remoteStream,

    connected,

    isMuted,
    isCameraOff,

    startCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMute,
    toggleCamera,

    getLocalMedia,
  };
}

