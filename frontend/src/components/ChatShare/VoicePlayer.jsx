import {useRef,useState} from 'react';
import {t} from '../../i18n';
import Icon from '../Icon/Icon';
import Waveform from './Waveform';
import {useAudioPeaks} from './useAudioWaveform';
import {mediaTime} from '../../utils/mediaTime';
import styles from './VoicePlayer.module.css';


export default function VoicePlayer({url,blob,duration:initialDuration=0}) {
 const ref=useRef(null);const [playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(initialDuration),[failed,setFailed]=useState(false);
 const peaks=useAudioPeaks(blob);
 return <div className={styles.player}>
  <audio ref={ref} src={url} preload="metadata" onLoadedMetadata={e=>{if(Number.isFinite(e.currentTarget.duration))setDuration(e.currentTarget.duration);}} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);setPosition(0);}} onError={()=>setFailed(true)}/>
  <button type="button" className={styles.play} disabled={failed} aria-label={t(playing?'chatRich.pause':'chatRich.play')} onClick={()=>{if(playing)ref.current.pause();else{if(ref.current.ended)ref.current.currentTime=0;ref.current.play().catch(()=>setFailed(true));}}}><Icon name={playing?'pause':'play'} size={23}/></button>
  <div className={styles.body}><div className={styles.track}><Waveform levels={peaks} progress={duration?position/duration:0}/><input type="range" min="0" max={duration||1} step="0.05" value={Math.min(position,duration||1)} disabled={!duration||failed} aria-label={t('chatRich.seek')} onChange={e=>{ref.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}}/></div><span className={styles.time}>{failed?t('chatRich.loadFailed'):mediaTime(playing||position?position:duration)}</span></div>
 </div>;
}
