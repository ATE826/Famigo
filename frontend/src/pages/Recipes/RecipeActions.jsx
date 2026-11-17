import {t} from '../../i18n';
import {useEffect, useState} from 'react';
import {api,errorText} from '../../api/client';
import ChatShare from '../../components/ChatShare/ChatShare';
import Icon from '../../components/Icon/Icon';
import styles from './Recipes.module.css';

export default function RecipeActions({dish, favoriteId, onRemove}) {
 const [saved,setSaved]=useState(favoriteId??null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [share,setShare]=useState(false);
 useEffect(()=>{let active=true;if(!favoriteId)api('/me/recipes').then(({items})=>{const row=items.find(r=>r.recipe.title===dish.title && r.recipe.servings===dish.servings && JSON.stringify(r.recipe.steps)===JSON.stringify(dish.steps));if(active&&row)setSaved(row.id);}).catch(()=>{});return()=>{active=false;};},[dish,favoriteId]);
 async function toggle(){setBusy(true);setError('');try{if(saved){await api(`/me/recipes/${saved}`,{method:'DELETE'});setSaved(null);onRemove?.(saved);}else{const row=await api('/me/recipes',{method:'POST',body:dish});setSaved(row.id);}window.dispatchEvent(new Event('famigo-favorites'));}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <><div className={styles.recipeActions}><button type="button" onClick={toggle} disabled={busy} aria-pressed={!!saved}><Icon name="star" size={18}/>{busy?t('recipeSaved.saving'):saved?t('recipeSaved.saved'):t('recipeSaved.save')}</button><button type="button" onClick={()=>setShare(true)}><Icon name="send" size={18}/>{t('recipeSaved.share')}</button></div>{error&&<p className={styles.aiError} role="alert">{error}</p>}{share&&<ChatShare payload={{recipe:dish}} onClose={()=>setShare(false)}/>}</>;
}
