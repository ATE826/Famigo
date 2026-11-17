import {localizeRecipeAmount} from '../../utils/recipeAmount';
import {t} from '../../i18n';
import {useEffect,useState} from 'react';
import {api,errorText} from '../../api/client';
import Card from '../../components/Card/Card';
import Icon from '../../components/Icon/Icon';
import RecipeActions from './RecipeActions';
import styles from './Recipes.module.css';
export default function Favorites(){
 const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;const load=()=>api('/me/recipes').then(r=>{if(active){setItems(r.items);setError('');}}).catch(e=>{if(active)setError(errorText(e));}).finally(()=>{if(active)setLoading(false);});load();window.addEventListener('famigo-favorites',load);return()=>{active=false;window.removeEventListener('famigo-favorites',load);};},[]);
 return <section className={styles.favorites} aria-label={t("recipeSaved.title")}><h2 className={styles.section}>{t("recipeSaved.title")}</h2>{loading&&<p role="status">{t("recipeSaved.loading")}</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!items.length&&<div className={styles.favoriteEmpty}><Icon name="star" size={24}/><p>{t("recipeSaved.empty")}</p></div>}{items.map(row=><Card key={row.id} className={styles.dish}><div className={styles.dishHead}><h3 className={styles.dishTitle}>{row.recipe.title}</h3><span className={styles.time}>{t("recipes.minutes",{count:row.recipe.minutes})}</span></div><div className={styles.badges}><span className={`${styles.badge} ${styles.badgeOk}`}>{t("recipes.ai.portions",{count:row.recipe.servings})}</span></div><ul className={styles.ingredients}>{row.recipe.ingredients.map((i,n)=><li className={styles.favoriteIngredient} key={n}>{i.name}<span className={styles.amount}>{localizeRecipeAmount(i.amount)}</span></li>)}</ul><details className={styles.steps}><summary>{t("recipes.steps")}</summary><ol>{row.recipe.steps.map((step,n)=><li key={n}>{step}</li>)}</ol></details><RecipeActions dish={row.recipe} favoriteId={row.id}/></Card>)}</section>;
}
