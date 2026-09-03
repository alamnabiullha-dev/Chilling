import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../socket";

const ICE_SERVERS = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

export default function useCallManager() {
  const socket = getSocket();

  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [status, setStatus] = useState("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const peerRef = useRef(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const remoteUserRef = useRef(null);
  const currentCallIdRef = useRef(null);

  const pendingCandidatesRef = useRef([]);

  // =========================================================
  // CLEANUP
  // =========================================================

  const closeMedia = useCallback(() => {
    console.log("🧹 Cleaning call...");

    if (peerRef.current) {
      try {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.oniceconnectionstatechange = null;

        peerRef.current.close();
      } catch (err) {
        console.log("Peer close error:", err);
      }

      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.log("Track stop error:", err);
        }
      });

      localStreamRef.current = null;
    }

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

    remoteStreamRef.current = null;

    remoteUserRef.current = null;
    currentCallIdRef.current = null;

    pendingCandidatesRef.current = [];

    setCall(null);
    setIncoming(null);
    setStatus("idle");
    setMuted(false);
    setCameraOff(false);
    setError("");
  }, []);

  // =========================================================
  // GET MEDIA
  // =========================================================

  const getMedia = useCallback(async (withVideo = false) => {
    try {
      console.log("🎤 Requesting microphone...");
      console.log("📹 Video:", withVideo);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },

        video: withVideo
          ? {
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
              frameRate: {
                ideal: 30,
              },
            }
          : false,
      });

      console.log("✅ Local media received");

      console.log(
        "🎤 Audio tracks:",
        stream.getAudioTracks()
      );

      console.log(
        "📹 Video tracks:",
        stream.getVideoTracks()
      );

      localStreamRef.current = stream;

      return stream;
    } catch (err) {
      console.error("❌ getUserMedia error:", err);

      setError(
        err?.message ||
          "Microphone or camera permission denied."
      );

      throw err;
    }
  }, []);

  // =========================================================
  // ATTACH LOCAL VIDEO
  // =========================================================

  const attachLocalVideo = useCallback((stream) => {
    if (!localVideoRef.current || !stream) {
      return;
    }

    console.log("📹 Attaching local video");

    localVideoRef.current.srcObject = stream;
    localVideoRef.current.autoplay = true;
    localVideoRef.current.playsInline = true;
    localVideoRef.current.muted = true;

    localVideoRef.current.play().catch((err) => {
      console.log("Local video play error:", err);
    });
  }, []);

  // =========================================================
  // ATTACH REMOTE STREAM
  // =========================================================

  const attachRemoteStream = useCallback((stream) => {
    if (!stream) {
      return;
    }

    console.log("📥 Attaching remote stream");

    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();

    console.log(
      "🔊 Remote audio tracks:",
      audioTracks.length
    );

    console.log(
      "📹 Remote video tracks:",
      videoTracks.length
    );

    audioTracks.forEach((track) => {
      track.enabled = true;
    });

    videoTracks.forEach((track) => {
      track.enabled = true;
    });

    remoteStreamRef.current = stream;

    // -------------------------------------------------------
    // REMOTE AUDIO
    // -------------------------------------------------------

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.autoplay = true;
      remoteAudioRef.current.playsInline = true;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1;

      remoteAudioRef.current
        .play()
        .then(() => {
          console.log("🔊 Remote audio PLAYING");
        })
        .catch((err) => {
          console.warn(
            "⚠️ Remote audio play blocked:",
            err
          );
        });
    }

    // -------------------------------------------------------
    // REMOTE VIDEO
    // -------------------------------------------------------

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.autoplay = true;
      remoteVideoRef.current.playsInline = true;

      /*
       * IMPORTANT:
       * Audio is handled by remoteAudioRef.
       * Therefore remote video is muted.
       */
      remoteVideoRef.current.muted = true;

      remoteVideoRef.current
        .play()
        .then(() => {
          console.log("📹 Remote video PLAYING");
        })
        .catch((err) => {
          console.warn(
            "⚠️ Remote video play error:",
            err
          );
        });
    }
  }, []);

  // =========================================================
  // CREATE PEER
  // =========================================================

  const createPeer = useCallback(
    (targetUserId, callId) => {
      /*
       * VERY IMPORTANT:
       * Never create duplicate RTCPeerConnection.
       */
      if (peerRef.current) {
        console.log(
          "♻️ Reusing existing peer connection"
        );

        return peerRef.current;
      }

      console.log(
        "🔗 Creating peer:",
        targetUserId,
        callId
      );

      const peer = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });

      peerRef.current = peer;

      remoteUserRef.current = targetUserId;
      currentCallIdRef.current = callId;

      // =====================================================
      // ADD LOCAL TRACKS
      // =====================================================

      if (localStreamRef.current) {
        const tracks =
          localStreamRef.current.getTracks();

        console.log(
          "📤 Adding local tracks:",
          tracks.length
        );

        tracks.forEach((track) => {
          console.log(
            "📤 Sending:",
            track.kind,
            track.label,
            "enabled:",
            track.enabled
          );

          peer.addTrack(
            track,
            localStreamRef.current
          );
        });
      } else {
        console.warn(
          "⚠️ Local stream doesn't exist"
        );
      }

      // =====================================================
      // ICE
      // =====================================================

      peer.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        console.log("🧊 Sending ICE");

        socket.emit("webrtc:ice-candidate", {
          to: targetUserId,
          candidate: event.candidate,
          callId,
        });
      };

      // =====================================================
      // REMOTE TRACK
      // =====================================================

      peer.ontrack = (event) => {
        console.log(
          "📥 REMOTE TRACK:",
          event.track.kind,
          event.track.label
        );

        let remoteStream =
          remoteStreamRef.current;

        if (!remoteStream) {
          remoteStream = new MediaStream();

          remoteStreamRef.current =
            remoteStream;
        }

        const exists =
          remoteStream
            .getTracks()
            .some(
              (track) =>
                track.id === event.track.id
            );

        if (!exists) {
          remoteStream.addTrack(
            event.track
          );
        }

        event.track.enabled = true;

        console.log(
          "🔊 Remote audio count:",
          remoteStream.getAudioTracks().length
        );

        console.log(
          "📹 Remote video count:",
          remoteStream.getVideoTracks().length
        );

        attachRemoteStream(
          remoteStream
        );
      };

      // =====================================================
      // CONNECTION STATE
      // =====================================================

      peer.onconnectionstatechange = () => {
        console.log(
          "🔗 Connection:",
          peer.connectionState
        );

        if (
          peer.connectionState ===
          "connected"
        ) {
          console.log(
            "✅ WEBRTC CONNECTED"
          );

          setStatus("connected");
        }

        if (
          peer.connectionState ===
          "failed"
        ) {
          console.error(
            "❌ WEBRTC FAILED"
          );

          setError(
            "Call connection failed."
          );

          setStatus("failed");
        }

        if (
          peer.connectionState ===
          "disconnected"
        ) {
          console.warn(
            "⚠️ WEBRTC DISCONNECTED"
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

      return peer;
    },
    [attachRemoteStream, socket]
  );

  // =========================================================
  // PENDING ICE
  // =========================================================

  const addPendingCandidates =
    useCallback(async () => {
      if (!peerRef.current) {
        return;
      }

      if (
        !peerRef.current.remoteDescription
      ) {
        return;
      }

      const candidates =
        pendingCandidatesRef.current;

      if (!candidates.length) {
        return;
      }

      console.log(
        "🧊 Adding queued ICE:",
        candidates.length
      );

      for (const candidate of candidates) {
        try {
          await peerRef.current.addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );
        } catch (err) {
          console.error(
            "❌ ICE error:",
            err
          );
        }
      }

      pendingCandidatesRef.current = [];
    }, []);

  // =========================================================
  // START CALL
  // =========================================================

  const startCall = useCallback(
    async ({
      userId,
      name,
      avatar,
      video = false,
    }) => {
      try {
        setError("");
        setStatus("calling");

        console.log(
          "📞 Starting call:",
          userId,
          "video:",
          video
        );

        const callId =
          `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2)}`;

        currentCallIdRef.current =
          callId;

        remoteUserRef.current =
          userId;

        // Get mic + camera
        const stream =
          await getMedia(video);

        attachLocalVideo(stream);

        // Create peer
        const peer = createPeer(
          userId,
          callId
        );

        setCall({
          callId,
          userId,
          name,
          avatar,
          video,
          outgoing: true,
        });

        // Notify receiver
        socket.emit(
          "call:initiate",
          {
            to: userId,
            callId,
            name,
            avatar,
            video,
          }
        );

        // Create offer
        const offer =
          await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: video,
          });

        await peer.setLocalDescription(
          offer
        );

        console.log(
          "📤 Sending offer"
        );

        socket.emit(
          "webrtc:offer",
          {
            to: userId,
            offer,
            callId,
            video,
          }
        );
      } catch (err) {
        console.error(
          "❌ Start call error:",
          err
        );

        setError(
          err?.message ||
            "Could not start call."
        );

        closeMedia();
      }
    },
    [
      attachLocalVideo,
      closeMedia,
      createPeer,
      getMedia,
      socket,
    ]
  );

  // =========================================================
  // ACCEPT CALL
  // =========================================================

  const acceptCall = useCallback(
    async () => {
      if (!incoming) {
        return;
      }

      try {
        setError("");

        console.log(
          "📲 Accepting call:",
          incoming
        );

        const {
          callId,
          from,
          userId,
          name,
          avatar,
          video,
        } = incoming;

        const targetUserId =
          from || userId;

        currentCallIdRef.current =
          callId;

        remoteUserRef.current =
          targetUserId;

        // Get mic + camera
        const stream =
          await getMedia(
            Boolean(video)
          );

        attachLocalVideo(stream);

        /*
         * Create peer BEFORE offer arrives.
         * onOffer will REUSE this peer.
         */
        createPeer(
          targetUserId,
          callId
        );

        setCall({
          callId,
          userId: targetUserId,
          name,
          avatar,
          video: Boolean(video),
          outgoing: false,
        });

        /*
         * User wanted:
         * Accept -> Connected
         */
        setStatus("connected");

        // Tell caller
        socket.emit(
          "call:accept",
          {
            to: targetUserId,
            callId,
            video: Boolean(video),
          }
        );

        setIncoming(null);

        console.log(
          "✅ Call accepted"
        );
      } catch (err) {
        console.error(
          "❌ Accept call error:",
          err
        );

        setError(
          err?.message ||
            "Could not accept call."
        );
      }
    },
    [
      attachLocalVideo,
      createPeer,
      getMedia,
      incoming,
      socket,
    ]
  );

  // =========================================================
  // OFFER
  // =========================================================

  const onOffer = useCallback(
    async ({
      from,
      offer,
      callId,
      video,
    }) => {
      try {
        console.log(
          "📥 Offer received:",
          from
        );

        let peer =
          peerRef.current;

        /*
         * If acceptCall has not created peer,
         * create it here.
         */
        if (!peer) {
          const stream =
            await getMedia(
              Boolean(video)
            );

          attachLocalVideo(stream);

          peer = createPeer(
            from,
            callId
          );
        }

        /*
         * IMPORTANT:
         * Don't create another peer.
         */

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            offer
          )
        );

        console.log(
          "✅ Remote offer set"
        );

        await addPendingCandidates();

        // Create answer
        const answer =
          await peer.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo:
              Boolean(video),
          });

        await peer.setLocalDescription(
          answer
        );

        console.log(
          "📤 Sending answer"
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

        console.log(
          "✅ Answer sent"
        );
      } catch (err) {
        console.error(
          "❌ Offer error:",
          err
        );

        setError(
          err?.message ||
            "Could not process offer."
        );
      }
    },
    [
      addPendingCandidates,
      attachLocalVideo,
      createPeer,
      getMedia,
      socket,
    ]
  );

  // =========================================================
  // ANSWER
  // =========================================================

  const onAnswer = useCallback(
    async ({ answer }) => {
      try {
        if (!peerRef.current) {
          console.warn(
            "⚠️ No peer for answer"
          );

          return;
        }

        console.log(
          "📥 Answer received"
        );

        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(
            answer
          )
        );

        console.log(
          "✅ Remote answer set"
        );

        await addPendingCandidates();

        setStatus("connected");
      } catch (err) {
        console.error(
          "❌ Answer error:",
          err
        );

        setError(
          err?.message ||
            "Could not process answer."
        );
      }
    },
    [addPendingCandidates]
  );

  // =========================================================
  // ICE
  // =========================================================

  const onCandidate = useCallback(
    async ({ candidate }) => {
      if (!candidate) {
        return;
      }

      console.log(
        "🧊 ICE received"
      );

      if (
        !peerRef.current ||
        !peerRef.current.remoteDescription
      ) {
        console.log(
          "🧊 Queueing ICE"
        );

        pendingCandidatesRef.current.push(
          candidate
        );

        return;
      }

      try {
        await peerRef.current.addIceCandidate(
          new RTCIceCandidate(
            candidate
          )
        );

        console.log(
          "✅ ICE added"
        );
      } catch (err) {
        console.error(
          "❌ ICE candidate error:",
          err
        );
      }
    },
    []
  );

  // =========================================================
  // INCOMING
  // =========================================================

  const onIncoming = useCallback(
    (data) => {
      console.log(
        "📲 Incoming call:",
        data
      );

      setIncoming(data);
      setStatus("ringing");
    },
    []
  );

  // =========================================================
  // REJECT
  // =========================================================

  const rejectCall = useCallback(() => {
    if (!incoming) {
      return;
    }

    const targetUserId =
      incoming.from ||
      incoming.userId;

    socket.emit(
      "call:reject",
      {
        to: targetUserId,
        callId: incoming.callId,
      }
    );

    closeMedia();
  }, [
    closeMedia,
    incoming,
    socket,
  ]);

  // =========================================================
  // END
  // =========================================================

  const endCall = useCallback(() => {
    const targetUserId =
      remoteUserRef.current;

    const callId =
      currentCallIdRef.current;

    console.log(
      "📴 Ending call"
    );

    if (targetUserId) {
      socket.emit(
        "call:end",
        {
          to: targetUserId,
          callId,
        }
      );
    }

    closeMedia();
  }, [
    closeMedia,
    socket,
  ]);

  // =========================================================
  // MUTE
  // =========================================================

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) {
      return;
    }

    const tracks =
      localStreamRef.current.getAudioTracks();

    if (!tracks.length) {
      return;
    }

    const nextMuted = !muted;

    tracks.forEach((track) => {
      track.enabled = !nextMuted;
    });

    console.log(
      "🎤 Mic enabled:",
      !nextMuted
    );

    setMuted(nextMuted);
  }, [muted]);

  // =========================================================
  // CAMERA
  // =========================================================

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) {
      return;
    }

    const tracks =
      localStreamRef.current.getVideoTracks();

    if (!tracks.length) {
      return;
    }

    const nextCameraOff =
      !cameraOff;

    tracks.forEach((track) => {
      track.enabled =
        !nextCameraOff;
    });

    console.log(
      "📹 Camera enabled:",
      !nextCameraOff
    );

    setCameraOff(nextCameraOff);
  }, [cameraOff]);

  // =========================================================
  // SOCKET LISTENERS
  // =========================================================

  useEffect(() => {
    if (!socket) {
      return;
    }

    console.log(
      "🔌 Registering call listeners"
    );

    socket.on(
      "call:incoming",
      onIncoming
    );

    socket.on(
      "call:offer",
      onIncoming
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
      "call:rejected",
      () => {
        closeMedia();
      }
    );

    socket.on(
      "call:ended",
      () => {
        closeMedia();
      }
    );

    socket.on(
      "call:end",
      () => {
        closeMedia();
      }
    );

    socket.on(
      "call:reject",
      () => {
        closeMedia();
      }
    );

    return () => {
      socket.off(
        "call:incoming",
        onIncoming
      );

      socket.off(
        "call:offer",
        onIncoming
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
        "call:rejected"
      );

      socket.off(
        "call:ended"
      );

      socket.off(
        "call:end"
      );

      socket.off(
        "call:reject"
      );
    };
  }, [
    socket,
    onIncoming,
    onOffer,
    onAnswer,
    onCandidate,
    closeMedia,
  ]);

  // =========================================================
  // UNMOUNT CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      closeMedia();
    };
  }, [closeMedia]);

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
