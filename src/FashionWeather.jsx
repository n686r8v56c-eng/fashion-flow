import React,{useEffect,useState} from 'react';
import{Sun,Cloud,CloudRain,CloudSnow,CloudLightning,CloudSun}from'lucide-react';
const SEOUL=[37.5665,126.9780];
export default function FashionWeather(){
 const[w,setW]=useState(null),[state,setState]=useState('loading');
 useEffect(()=>{let alive=true;const ctrl=new AbortController();
 const fetchWeather=async(lat,lon,place)=>{try{const u='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,weather_code&timezone=auto';const r=await fetch(u,{signal:ctrl.signal});if(!r.ok)throw Error('Weather request failed');const j=await r.json();if(!Number.isFinite(j?.current?.temperature_2m))throw Error('Weather data missing');if(alive){setW({temp:Math.round(j.current.temperature_2m),code:j.current.weather_code,place});setState('ok')}}catch(e){if(alive&&e.name!=='AbortError')setState('error')}};
 const fallback=()=>fetchWeather(...SEOUL,'서울 기준');
 try{if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>fetchWeather(p.coords.latitude,p.coords.longitude,'현재 위치'),fallback,{timeout:4500,maximumAge:900000});else fallback()}catch{fallback()}
 return()=>{alive=false;ctrl.abort()}},[]);
 if(!w)return <span className="fashion-weather" title={state==='error'?'날씨 정보를 불러오지 못했어.':'날씨 확인 중'}><Cloud size={16}/><span>{state==='error'?'--°':'…'}</span></span>;
 const Icon=w.code===0?Sun:[1,2].includes(w.code)?CloudSun:[3,45,48].includes(w.code)?Cloud:[51,53,55,56,57,61,63,65,80,81,82].includes(w.code)?CloudRain:[71,73,75,77,85,86].includes(w.code)?CloudSnow:[95,96,99].includes(w.code)?CloudLightning:CloudSun;
 return <span className="fashion-weather" title={w.place+' 현재 날씨'}><Icon size={16}/>{w.temp}°</span>;
}
