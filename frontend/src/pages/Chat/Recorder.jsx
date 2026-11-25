import {useEffect,useEffectEvent,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import Waveform from '../../components/ChatShare/Waveform';
import {useLiveWaveform} from '../../components/ChatShare/useAudioWaveform';
import {mediaTime} from '../../utils/mediaTime';
import {t} from '../../i18n';
import {errorText} from '../../api/client';
import Icon from '../../components/Icon/Icon';
import styles from './Recorder.module.css';

function LivePreview({stream,className}) {
 const ref=useRef(null);
 useEffect(()=>{
  const video=ref.current;
  if(!video||!stream)return;
  video.srcObject=stream;
  void video.play().catch(()=>{});
  return()=>{video.srcObject=null;};
 },[stream]);
 return <video ref={ref} autoPlay playsInline muted className={className}/>;
}

const LIMIT=25*1024*1024;
export default function Recorder({disabled,onSend,onRecordingChange}) {
 const [liveStream,setLiveStream]=useState(null);
 const [mode,setMode]=useState('round');
 const liveLevels=useLiveWaveform(mode==='voice'?liveStream:null);
 const [phase,setPhase]=useState('idle');
 const [locked,setLocked]=useState(false);
 const [seconds,setSeconds]=useState(0);
 const [error,setError]=useState('');
 const session=useRef(null),gesture=useRef(null),hold=useRef(null);
 const alive=useRef(true),generation=useRef(0),ready=useRef(null),ignoreClick=useRef(false);
 const sendRef=useRef(onSend);
 useEffect(()=>{sendRef.current=onSend;},[onSend]);
 useEffect(()=>{onRecordingChange(phase!=='idle');},[phase,onRecordingChange]);
 useEffect(()=>{
  alive.current=true;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- generation is an async request token, not a DOM ref
  return()=>{alive.current=false;generation.current++;clearTimeout(hold.current);const s=session.current;if(s){s.send=false;clearInterval(s.clock);clearTimeout(s.limit);if(s.recorder.state!=='inactive')s.recorder.stop();s.stream.getTracks().forEach(track=>track.stop());}onRecordingChange(false);};
 },[onRecordingChange]);
 function finish(send) {
  const s=session.current;
  if(!s||s.finishing)return;
  s.finishing=true;s.send=send;
  clearInterval(s.clock);clearTimeout(s.limit);
  s.duration=Math.max(.01,(performance.now()-s.started)/1000);
  if(s.kind==='round')s.duration=Math.min(60,s.duration);
  if(alive.current)setPhase('stopping');
  if(s.recorder.state!=='inactive')s.recorder.stop();
  s.stream.getTracks().forEach(track=>track.stop());
 }
 async function upload() {
  const clip=ready.current;
  if(!clip||clip.sending)return;
  clip.sending=true;setPhase('sending');setError('');
  try {await sendRef.current(clip.file,clip.kind,clip.duration);if(alive.current){ready.current=null;setPhase('idle');}}
  catch(e){clip.sending=false;if(alive.current){setError(errorText(e));setPhase('ready');}}
 }
 async function start(keyboard=false) {
  if(disabled||session.current||phase!=='idle')return;
  const token=++generation.current;
  setError('');setPhase('permission');setSeconds(0);setLocked(keyboard);
  if(gesture.current)gesture.current.started=true;
  let stream;
  try {
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error(t('chatRich.recordUnsupported'));
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:mode==='round'?{facingMode:'user',width:{ideal:480},height:{ideal:480},frameRate:{ideal:24,max:30}}:false});
   if(!alive.current||generation.current!==token||(!keyboard&&!gesture.current?.held)){stream.getTracks().forEach(track=>track.stop());if(alive.current&&generation.current===token)setPhase('idle');return;}
   const choices=mode==='round'?['video/webm;codecs=vp8,opus','video/mp4','video/webm']:['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'];
   const mimeType=choices.find(type=>MediaRecorder.isTypeSupported(type));
   if(!mimeType)throw new Error(t('chatRich.recordUnsupported'));
   const recorder=new MediaRecorder(stream,{mimeType,audioBitsPerSecond:64000,...(mode==='round'?{videoBitsPerSecond:600000}:{})});
   const s={recorder,stream,kind:mode,started:performance.now(),chunks:[],bytes:0,send:false,finishing:false};
   session.current=s;
   recorder.ondataavailable=e=>{if(e.data.size){s.chunks.push(e.data);s.bytes+=e.data.size;if(s.bytes>LIMIT&&!s.finishing){setError(t('chatRich.tooLarge'));finish(false);}}};
   recorder.onerror=()=>{if(alive.current)setError(t('chatRich.recordFailed'));finish(false);};
   recorder.onstop=()=>{
    clearInterval(s.clock);clearTimeout(s.limit);stream.getTracks().forEach(track=>track.stop());
    if(session.current===s)session.current=null;
    if(!alive.current)return;
    setLiveStream(null);
    if(!s.send||s.bytes>LIMIT||s.bytes===0){setPhase('idle');return;}
    const extension=mimeType.includes('mp4')?'mp4':mimeType.includes('ogg')?'ogg':'webm';
    ready.current={file:new File(s.chunks,`${s.kind}.${extension}`,{type:mimeType}),kind:s.kind,duration:s.duration};
    void upload();
   };
   recorder.start(250);setLiveStream(stream);setPhase('recording');
   s.clock=setInterval(()=>{if(alive.current)setSeconds(Math.floor((performance.now()-s.started)/1000));},200);
   if(mode==='round')s.limit=setTimeout(()=>finish(true),60000);
   stream.getTracks().forEach(track=>{track.onended=()=>{if(!s.finishing)finish(false);};});
  } catch(e) {
   stream?.getTracks().forEach(track=>track.stop());
   if(alive.current&&generation.current===token){setError(e.name==='NotAllowedError'?t('chatRich.recordPermission'):e.name==='NotFoundError'?t('chatRich.recordDevice'):e.message||t('chatRich.recordFailed'));setPhase('idle');}
  }
 }
 function cancel() {
  generation.current++;clearTimeout(hold.current);
  if(gesture.current)gesture.current.held=false;
  ready.current=null;
  if(session.current)finish(false);else setPhase('idle');
 }
 useEffect(()=>{
  const hidden=()=>{if(document.hidden){generation.current++;if(gesture.current)gesture.current.held=false;const s=session.current;if(s&&!s.finishing){s.send=false;s.finishing=true;clearInterval(s.clock);clearTimeout(s.limit);s.recorder.stop();s.stream.getTracks().forEach(track=>track.stop());}if(alive.current)setPhase(current=>current==='sending'||current==='ready'?current:'idle');}};
  document.addEventListener('visibilitychange',hidden);
  return()=>document.removeEventListener('visibilitychange',hidden);
 },[]);
 function down(e) {
  if(e.button!==0||phase!=='idle'||disabled)return;
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  gesture.current={y:e.clientY,held:true,started:false,locked:false};
  hold.current=setTimeout(()=>void start(),220);
 }
 function move(e) {
  const g=gesture.current;
  if(!g?.held||!g.started||!session.current)return;
  if(g.y-e.clientY>=70){g.locked=true;setLocked(true);}
 }
 function up() {
  clearTimeout(hold.current);
  const g=gesture.current;if(!g?.held)return;
  g.held=false;
  if(g.started){ignoreClick.current=true;if(!g.locked)finish(true);}
 }
 const active=phase!=='idle';
 const canSend=phase==='recording'||phase==='ready';
 const sendWithKeyboard=useEffectEvent(()=>{
  if(phase==='ready')void upload();
  else if(phase==='recording')finish(true);
 });
 useEffect(()=>{
  if(!canSend)return;
  const keydown=e=>{
   if(e.defaultPrevented||e.key!=='Enter'||e.isComposing||e.keyCode===229||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||document.querySelector('dialog[open]'))return;
   e.preventDefault();e.stopPropagation();
   if(!e.repeat)sendWithKeyboard();
  };
  document.addEventListener('keydown',keydown,true);
  return()=>document.removeEventListener('keydown',keydown,true);
 },[canSend]);
 return <div className={styles.root}>
  {active&&createPortal(<div className={styles.stage} aria-label={t('chatRich.recording')}>
   {mode==='round'&&phase==='recording'&&<div className={styles.previewCenter}><div className={styles.previewMask}><LivePreview stream={liveStream} className={styles.preview}/></div><span className={styles.previewTimer} role="timer">{mediaTime(Math.min(seconds,60))} / 1:00</span><span className={styles.centerHint}>{t(locked?'chatRich.recordLocked':'chatRich.recordSlide')}</span></div>}
   {phase==='permission'&&<p className={styles.permission} role="status">{t('chatRich.recordAllow')}</p>}
   {error&&<p className={styles.stageError} role="alert">{error}</p>}
   <div className={styles.recordBar}>
    <span className={styles.recordDot}/><span className={styles.status} role="timer">{phase==='sending'?t('chatRich.sending'):`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}${mode==='round'?' / 1:00':''}`}</span>
    {mode==='voice'&&<div className={styles.liveWave}><Waveform levels={liveLevels} live/></div>}
    <button type="button" disabled={phase==='sending'} onClick={cancel}>{t('common.cancel')}</button>
   </div>
  </div>,document.getElementById('chat-recording-stage')||document.body)}
  {!active&&error&&<p className={styles.error} role="alert">{error}</p>}
  {phase==='recording'&&!locked&&<div className={styles.lock}><Icon name="lock" size={21}/><Icon name="upload" size={17}/></div>}
  <button type="button" className={styles.trigger} disabled={disabled||phase==='sending'||phase==='stopping'}
   aria-label={t(active?'chats.send':mode==='round'?'chatRich.round':'chatRich.voice')}
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
   onContextMenu={e=>e.preventDefault()}
   onClick={e=>{if(ignoreClick.current){ignoreClick.current=false;return;}if(canSend){if(phase==='ready')void upload();else finish(true);}else if(phase==='idle'){if(e.detail===0)void start(true);else setMode(mode==='round'?'voice':'round');}}}>
   <Icon name={active?'send':mode==='round'?'video':'microphone'} size={22} className={active?styles.sendIcon:undefined}/>
  </button>
 </div>;
}
