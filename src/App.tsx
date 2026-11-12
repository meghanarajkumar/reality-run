import { useCallback, useEffect, useRef, useState } from 'react';
import { Welcome } from './components/Welcome';
import { Scan } from './components/Scan';
import { Game } from './components/Game';
import { demoVocabulary, type Vocabulary } from './vision/vocabulary';

type Stage = 'welcome' | 'scan' | 'play';

export function App() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [vocab, setVocab] = useState<Vocabulary | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const openCamera = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current!;
    if (video.srcObject) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice('The camera only works on a secure (https) address. Open this page over https, or play the demo world.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      setCameraOn(true);
      return true;
    } catch (e) {
      const name = (e as DOMException).name;
      setNotice(name === 'NotAllowedError'
        ? 'Camera access is off. Allow the camera for this site in your browser settings and tap Let’s Play again, or play the demo world.'
        : name === 'NotFoundError' ? 'No camera was found on this device. You can still play the demo world.'
        : 'The camera could not start. Close other apps that use it and try again, or play the demo world.');
      return false;
    }
  }, []);

  const play = useCallback(async () => {
    setBusy(true); setNotice('');
    if (await openCamera()) setStage('scan');
    setBusy(false);
  }, [openCamera]);

  const playDemo = useCallback(() => { setVocab(demoVocabulary()); setStage('play'); }, []);
  const rescan = useCallback(async () => { if (await openCamera()) { setNotice(''); setStage('scan'); } else setStage('welcome'); }, [openCamera]);

  useEffect(() => () => {   // release the camera when the page goes away
    (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach(t => t.stop());
  }, []);

  return (
    <>
      <video ref={videoRef} className={'camera' + (cameraOn && stage !== 'welcome' ? ' on' : '')} playsInline muted autoPlay />
      {stage === 'welcome' && <Welcome onPlay={play} onDemo={playDemo} notice={notice} busy={busy} />}
      {stage === 'scan' && <Scan video={videoRef.current!} onDone={v => { setVocab(v); setStage('play'); }} onDemo={playDemo} />}
      {stage === 'play' && vocab && <Game vocab={vocab} hasCamera={cameraOn} onRescan={rescan} />}
    </>
  );
}
