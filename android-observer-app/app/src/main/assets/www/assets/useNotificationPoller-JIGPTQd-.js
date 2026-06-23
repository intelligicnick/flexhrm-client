import{e as l}from"./index-joMuHSiS.js";import{e as r}from"./vendor-BE3vZIio.js";import{r as p,a as h,P as y,c as L}from"./notification-alerts-DypD_W4O.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]],M=l("log-out",k);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=[["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M18 5v16",key:"1ethyx"}],["path",{d:"m4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6",key:"zywc2d"}],["path",{d:"m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11",key:"1d4ql0"}],["path",{d:"M6 5v16",key:"1sn0nx"}],["circle",{cx:"12",cy:"9",r:"2",key:"1092wv"}]],R=l("school",E);function P({enabled:e,unreadCount:s,fetchUnreadCount:c,fetchNotifications:i,pollIntervalMs:a=y,lang:u}){const o=r.useRef(null),n=r.useRef(!1);r.useEffect(()=>{if(!e){o.current=null,n.current=!1;return}p();const t=()=>{L(),window.removeEventListener("click",t),window.removeEventListener("touchstart",t)};return window.addEventListener("click",t,{passive:!0}),window.addEventListener("touchstart",t,{passive:!0}),()=>{window.removeEventListener("click",t),window.removeEventListener("touchstart",t)}},[e]),r.useEffect(()=>{e&&(n.current||(o.current=s,n.current=!0))},[e,s]);const f=r.useCallback(async()=>{if(e)try{const t=await c(),d=o.current??t;if(t>d){let v=null;if(i){const w=await i();v=w.find(m=>!m.readAt)||w[0]||null}h(d,t,v,u)}o.current=t}catch{}},[e,c,i,u]);r.useEffect(()=>{if(!e)return;const t=window.setInterval(()=>{f()},a);return()=>window.clearInterval(t)},[e,f,a])}export{M as L,R as S,P as u};
