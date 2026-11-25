export const mediaTime=value=>`${Math.floor((Number.isFinite(value)?value:0)/60)}:${String(Math.floor((Number.isFinite(value)?value:0)%60)).padStart(2,'0')}`;
