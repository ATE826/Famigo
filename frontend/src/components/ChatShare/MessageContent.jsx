import {useEffect,useRef,useState} from 'react';
import {t} from '../../i18n';
import {localizeRecipeAmount} from '../../utils/recipeAmount';
import {mediaBlob} from '../../api/client';
import {useData} from '../../store/DataContext';
import VoicePlayer from './VoicePlayer';
import {mediaTime} from '../../utils/mediaTime';
import Icon from '../Icon/Icon';
import styles from './MessageContent.module.css';

function RoundVideo({url,duration=0}) {
 const ref=useRef(null);
 const [playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[total,setTotal]=useState(duration),[failed,setFailed]=useState(false);
 return <div className={styles.round}>
  <video ref={ref} src={url} playsInline preload="metadata"
   onLoadedMetadata={e=>{const value=e.currentTarget.duration;if(Number.isFinite(value)&&value>0)setTotal(value);}}
   onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)}
   onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
   onEnded={()=>{setPlaying(false);setPosition(0);}} onError={()=>setFailed(true)}/>
  <button type="button" disabled={failed} aria-label={t(playing?'chatRich.pause':'chatRich.play')} onClick={()=>{
   if(playing)ref.current.pause();
   else {if(ref.current.ended){ref.current.currentTime=0;setPosition(0);}ref.current.play().catch(()=>setFailed(true));}
  }}><Icon name={playing?'pause':'play'} size={28}/></button>
  <span className={styles.roundTime}>{failed?t('chatRich.loadFailed'):mediaTime(playing?position:total)}</span>
 </div>;
}
function Media({media,chatId,tile=false,onOpenMedia}) {
 const {familyId}=useData();const [state,setState]=useState({});
 useEffect(()=>{let active=true,url;mediaBlob(`/families/${familyId}/chats/${chatId}/media/${media.id}`).then(blob=>{url=URL.createObjectURL(blob);if(active)setState({url,blob});else URL.revokeObjectURL(url);}).catch(()=>{if(active)setState({error:true});});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[familyId,chatId,media.id]);
 if(state.error)return <p role="alert">{t("chatRich.loadFailed")}</p>;
 if(!state.url)return <p role="status">{t("chatRich.loading")}</p>;
 return <div className={`${styles.media} ${tile?styles.tile:''}`}>{media.kind==='round'?<RoundVideo url={state.url} duration={media.duration}/>:media.mime.startsWith('audio/')||media.mime==='application/ogg'?<VoicePlayer url={state.url} blob={state.blob} duration={media.duration}/>:media.mime.startsWith('video/')?<div className={styles.videoPreview}><video src={state.url} controls playsInline preload="metadata"/><button type="button" className={styles.openVideo} onClick={e=>{e.currentTarget.parentElement.querySelector('video')?.pause();onOpenMedia?.(media,state.url);}} aria-label={t('chatRich.openVideo')}><Icon name="expand" size={20}/></button></div>:<button type="button" className={styles.imageButton} onClick={()=>onOpenMedia?.(media,state.url)} aria-label={t("chatRich.openImage")}><img src={state.url} alt={t("chatRich.image")} loading="lazy" draggable={false}/></button>}</div>;
}
export default function MessageContent({message,chatId,onJumpToMessage,onOpenMedia}) {
 if(message.deleted)return <i>{t("chatRich.deleted")}</i>;
 const d=message.details??{};
 const mediaItems=d.mediaItems?.length?d.mediaItems:d.media?[d.media]:[];
 return <>
  {d.forwarded&&<small className={styles.forwarded}>{t("chatRich.forwarded")}</small>}
  {d.reply&&<button type="button" className={styles.quote} onClick={()=>onJumpToMessage?.(d.reply.id)} aria-label={t("chatRich.jump",{text:d.reply.text})}>{d.reply.text}</button>}
  {mediaItems.length>0?<>
   {mediaItems.length===1?<Media media={mediaItems[0]} chatId={chatId} onOpenMedia={onOpenMedia}/>:<div className={styles.album} data-count={mediaItems.length}>
    {mediaItems.map(media=><Media key={media.id} media={media} chatId={chatId} tile onOpenMedia={onOpenMedia}/>)}
   </div>}
   {d.caption&&<p className={styles.caption}>{d.caption}</p>}
  </>:d.recipe?<div className={styles.recipe}><b className={styles.recipeTitle}>{d.recipe.title}</b><span className={styles.recipeMeta}>{t("recipes.ai.portions",{count:d.recipe.servings})} · {t("recipes.minutes",{count:d.recipe.minutes})}</span><ul>{d.recipe.ingredients.map((i,n)=><li key={n}><span>{i.name}</span><span className={styles.amount}>{localizeRecipeAmount(i.amount)}</span></li>)}</ul><details><summary>{t("chatRich.steps")}</summary><ol>{d.recipe.steps.map((s,n)=><li key={n}>{s}</li>)}</ol></details></div>:message.text}
 </>;
}
