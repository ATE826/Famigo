import styles from './Waveform.module.css';

export default function Waveform({levels=[],progress=0,live=false}) {
 const bars=Array.from({length:48},(_,i)=>levels[i]??0);
 return <div className={`${styles.wave} ${live?styles.live:''}`} aria-hidden="true">{bars.map((v,i)=><span key={i} className={i/48<progress?styles.played:''} style={{height:`${Math.max(8,Math.min(1,v)*100)}%`}}/>)}</div>;
}
