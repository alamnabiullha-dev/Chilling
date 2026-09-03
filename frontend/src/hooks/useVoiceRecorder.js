import { useRef, useState } from "react";

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
  };

  const stop = () =>
    new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) return resolve(null);
      recorder.onstop = () => {
        clearInterval(timerRef.current);
        recorder.stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      recorder.stop();
    });

  const cancel = async () => {
    await stop();
    chunksRef.current = [];
  };

  return { recording, seconds, start, stop, cancel };
}
