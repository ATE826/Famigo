import {useEffect,useState} from 'react';
export function useLiveWaveform(stream) {
 const [levels,setLevels]=useState([]);
 useEffect(()=>{
  if(!stream)return;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return;
  let context,source,timer;
  try {
   context=new Audio();const analyser=context.createAnalyser();analyser.fftSize=512;
   source=context.createMediaStreamSource(stream);source.connect(analyser);
   void context.resume().catch(()=>{});
   const data=new Uint8Array(analyser.fftSize);
   timer=setInterval(()=>{analyser.getByteTimeDomainData(data);let sum=0;for(const x of data)sum+=((x-128)/128)**2;const level=Math.min(1,Math.sqrt(sum/data.length)*4);setLevels(old=>[...old.slice(-47),level]);},90);
  } catch { /* The recording can continue when audio analysis is unavailable. */ }
  return()=>{clearInterval(timer);source?.disconnect();void context?.close().catch(()=>{});};
 },[stream]);
 return levels;
}

export function useAudioPeaks(blob) {
 const [peaks,setPeaks]=useState([]);
 useEffect(()=>{
  if(!blob)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  let active=true,context;try {context=new Audio();} catch {return;}
  blob.arrayBuffer().then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{
   const data=buffer.getChannelData(0),values=[];
   for(let i=0;i<48;i++){
    const from=Math.floor(i*data.length/48),to=Math.floor((i+1)*data.length/48);let sum=0,n=0;
    const stride=Math.max(1,Math.floor((to-from)/1000));
    for(let j=from;j<to;j+=stride){sum+=data[j]*data[j];n++;}
    values.push(n?Math.sqrt(sum/n):0);
   }
   const max=Math.max(.01,...values);
   if(active)setPeaks(values.map(v=>v/max));
  }).catch(()=>{}).finally(()=>{void context.close().catch(()=>{});});
  return()=>{active=false;if(context.state!=='closed')void context.close().catch(()=>{});};
 },[blob]);
 return peaks;
}

