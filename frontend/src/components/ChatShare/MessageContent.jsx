import {useEffect,useState} from 'react';
import {t} from '../../i18n';
import {localizeRecipeAmount} from '../../utils/recipeAmount';
import {mediaBlob} from '../../api/client';
import {useData} from '../../store/DataContext';
import MediaViewer from './MediaViewer';
import styles from './MessageContent.module.css';

function Media({media,chatId}) {
 const {familyId}=useData();const [state,setState]=useState({});const [expanded,setExpanded]=useState(false);
 useEffect(()=>{let active=true,url;mediaBlob(`/families/${familyId}/chats/${chatId}/media/${media.id}`).then(blob=>{url=URL.createObjectURL(blob);if(active)setState({url});else URL.revokeObjectURL(url);}).catch(()=>{if(active)setState({error:true});});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[familyId,chatId,media.id]);
 if(state.error)return <p role="alert">{t("chatRich.loadFailed")}</p>;
 if(!state.url)return <p role="status">{t("chatRich.loading")}</p>;
 return <div className={styles.media}>{media.mime.startsWith('video/')?<video src={state.url} controls playsInline preload="metadata"/>:<button type="button" className={styles.imageButton} onClick={()=>setExpanded(true)} aria-label={t("chatRich.openImage")}><img src={state.url} alt={t("chatRich.image")} loading="lazy" draggable={false}/></button>}{expanded&&<MediaViewer url={state.url} media={media} onClose={()=>setExpanded(false)}/>}</div>;
}
export default function MessageContent({message,chatId,onJumpToMessage}) {
 if(message.deleted)return <i>{t("chatRich.deleted")}</i>;
 const d=message.details??{};
 return <>{d.forwarded&&<small className={styles.forwarded}>{t("chatRich.forwarded")}</small>}{d.reply&&<button type="button" className={styles.quote} onClick={()=>onJumpToMessage?.(d.reply.id)} aria-label={t("chatRich.jump",{text:d.reply.text})}>{d.reply.text}</button>}{d.media?<Media media={d.media} chatId={chatId}/>:d.recipe?<div className={styles.recipe}><b className={styles.recipeTitle}>{d.recipe.title}</b><span className={styles.recipeMeta}>{t("recipes.ai.portions",{count:d.recipe.servings})} · {t("recipes.minutes",{count:d.recipe.minutes})}</span><ul>{d.recipe.ingredients.map((i,n)=><li key={n}><span>{i.name}</span><span className={styles.amount}>{localizeRecipeAmount(i.amount)}</span></li>)}</ul><details><summary>{t("chatRich.steps")}</summary><ol>{d.recipe.steps.map((s,n)=><li key={n}>{s}</li>)}</ol></details></div>:message.text}</>;
}
