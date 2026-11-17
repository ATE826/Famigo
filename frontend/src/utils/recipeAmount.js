import {t} from '../i18n';

// Saved recipes retain the model's original amount text. Translate recognized
// measurement tokens for display without changing quantities or stored recipes.
const aliases = {
  kg: ['кг','килограмм','килограмма','килограммов','kg','kilograms','kilogram','千克','公斤'],
  g: ['г','гр','грамм','грамма','граммов','g','grams','gram','Gramm','gramos','gramo','克'],
  ml: ['мл','миллилитр','миллилитра','миллилитров','ml','milliliters','milliliter','Milliliter','mililitros','mililitro','毫升'],
  l: ['л','литр','литра','литров','l','liters','liter','Liter','litros','litro','升'],
  pcs: ['шт.','шт','штук','штука','штуки','pcs','pc','pieces','piece','Stk.','Stück','ud.','uds.','unidades','unidad','個','个'],
  tsp: ['ч. л.','ч.л.','ч. л','ч.л','чайная ложка','чайные ложки','чайных ложек','tsp','tsp.','teaspoons','teaspoon','TL','cdta.','cdita.','茶匙','小さじ'],
  tbsp: ['ст. л.','ст.л.','ст. л','ст.л','столовая ложка','столовые ложки','столовых ложек','tbsp','tbsp.','tablespoons','tablespoon','EL','cda.','汤匙','大さじ'],
  pinch: ['щепотка','щепотки','щепоток','pinch','pinches','Prise','Prisen','pizca','pizcas','一小撮','ひとつまみ'],
  handful: ['горсть','горсти','горстей','handful','handfuls','Handvoll','puñado','puñados','一把','ひとつかみ'],
  cup: ['стакан','стакана','стаканов','cup','cups','Tasse','Tassen','taza','tazas','杯','カップ'],
};
const unitByAlias = new Map(Object.entries(aliases).flatMap(([unit, names]) => names.map(name => [name.toLowerCase(), unit])));
const tokens = [...unitByAlias.keys()].sort((a,b)=>b.length-a.length).map(token=>token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
const pattern = new RegExp(`(?<![\\p{L}])(?:${tokens.join('|')})(?![\\p{L}])`, 'giu');

export function localizeRecipeAmount(value) {
  return String(value ?? '').replace(pattern, token => t(`recipeSaved.units.${unitByAlias.get(token.toLowerCase())}`));
}
