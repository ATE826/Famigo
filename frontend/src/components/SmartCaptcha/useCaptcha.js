import {useCallback,useEffect,useState} from 'react';
import {api} from '../../api/client';

export default function useCaptcha(registration=false){
 const [config,setConfig]=useState(null),[token,setToken]=useState(''),[revision,setRevision]=useState(0),[failed,setFailed]=useState(false);
 const reload=useCallback(async()=>{
  try{const value=await api('/auth/captcha');setConfig(value);setFailed(false);return value;}
  catch(error){setFailed(true);throw error;}
 },[]);
 useEffect(()=>{let active=true;api('/auth/captcha').then(value=>{if(active){setConfig(value);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[]);
 const required=config?.enabled&&(registration||config.required);
 const reset=useCallback(()=>{setToken('');setRevision(n=>n+1);},[]);
 return {config,token,setToken,revision,required,failed,reload,reset,blocked:!config||failed||(required&&!token)};
}
