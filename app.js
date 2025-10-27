(()=>{const $=id=>document.getElementById(id);
const els={stageList:$("stageList"),addStageBtn:$("addStageBtn"),resetPresetBtn:$("resetPresetBtn"),importBtn:$("importBtn"),exportBtn:$("exportBtn"),settingsBtn:$("settingsBtn"),currentStageName:$("currentStageName"),progressBar:$("progressBar"),timeDisplay:$("timeDisplay"),overtimeHint:$("overtimeHint"),prewarnInfo:$("prewarnInfo"),prevBtn:$("prevBtn"),toggleBtn:$("toggleBtn"),nextBtn:$("nextBtn"),minusBtn:$("minusBtn"),resetBtn:$("resetBtn"),plusBtn:$("plusBtn"),muteBtn:$("muteBtn"),fsBtn:$("fsBtn"),editDialog:$("editDialog"),editName:$("editName"),editSeconds:$("editSeconds"),editSaveBtn:$("editSaveBtn"),settingsDialog:$("settingsDialog"),warnSecondsInput:$("warnSecondsInput"),autoAdvanceInput:$("autoAdvanceInput"),settingsSaveBtn:$("settingsSaveBtn"),importFile:$("importFile")};
const SKEY="debateTimer.v1";const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const defaults=()=>[{id:uid(),name:"正方立论",seconds:180},{id:uid(),name:"反方立论",seconds:180},{id:uid(),name:"正方质询",seconds:120},{id:uid(),name:"反方质询",seconds:120},{id:uid(),name:"自由辩论",seconds:480},{id:uid(),name:"正方总结",seconds:180},{id:uid(),name:"反方总结",seconds:180}];
const st={stages:[],idx:0,running:false,remain:0,total:0,warnSecs:[60],warnedSet:new Set(),beeped:false,beep:true,raf:0,last:0,editing:null,autoNext:false,autoDone:false};
function load(){try{const raw=localStorage.getItem(SKEY);if(raw){const d=JSON.parse(raw);st.stages=Array.isArray(d.stages)&&d.stages.length?d.stages:defaults();st.idx=Number.isInteger(d.currentIndex)?Math.min(Math.max(0,d.currentIndex),st.stages.length-1):0;st.beep=typeof d.beepEnabled==="boolean"?d.beepEnabled:true; if(Array.isArray(d.warnSeconds)&&d.warnSeconds.length){st.warnSecs=d.warnSeconds.filter(n=>Number.isInteger(n)&&n>0).slice(0,8);}else{const p=Number.isInteger(d.preWarnSec)?d.preWarnSec:60;st.warnSecs=p>0?[p]:[];} st.autoNext=!!d.autoAdvance;}else{st.stages=defaults();st.idx=0;}}catch(e){st.stages=defaults();st.idx=0;}apply();}
function save(){try{localStorage.setItem(SKEY,JSON.stringify({stages:st.stages,currentIndex:st.idx,beepEnabled:st.beep,warnSeconds:st.warnSecs,autoAdvance:st.autoNext}))}catch(e){}
}
function apply(){const s=st.stages[st.idx];st.total=s? s.seconds*1000:0;st.remain=st.total;st.warnedSet=new Set();st.beeped=false;st.autoDone=false;renderAll();}
const fmt=t=>{const n=t<0;const x=Math.abs(t);const sec=Math.floor(x/1000);const m=Math.floor(sec/60);const s=sec%60;return(n?"-":"")+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")};
function iconBtn(text){const b=document.createElement('button');b.className='px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs';b.textContent=text;return b;}
function renderStages(){els.stageList.innerHTML='';st.stages.forEach((it,i)=>{const li=document.createElement('li');li.className=`flex items-center gap-2 py-2 px-2 ${i===st.idx? 'bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-300 dark:ring-emerald-800 rounded':''}`;
const num=document.createElement('div');num.className='w-6 shrink-0 text-slate-500';num.textContent=String(i+1);
const body=document.createElement('div');body.className='flex-1 cursor-pointer';
const name=document.createElement('div');name.className='font-medium';name.textContent=it.name;
const sub=document.createElement('div');sub.className='text-xs opacity-70';sub.textContent=`时长 ${Math.floor(it.seconds/60)}:${String(it.seconds%60).padStart(2,'0')}`;
body.appendChild(name);body.appendChild(sub);
body.addEventListener('click',()=>{if(st.running) toggle(false);st.idx=i;apply();save();});
const ctr=document.createElement('div');ctr.className='flex items-center gap-1';
const up=iconBtn('上');up.title='上移';up.addEventListener('click',e=>{e.stopPropagation();if(i>0){const t=st.stages[i];st.stages.splice(i,1);st.stages.splice(i-1,0,t);if(st.idx===i)st.idx=i-1;else if(st.idx===i-1)st.idx=i;renderStages();save();}});
const down=iconBtn('下');down.title='下移';down.addEventListener('click',e=>{e.stopPropagation();if(i<st.stages.length-1){const t=st.stages[i];st.stages.splice(i,1);st.stages.splice(i+1,0,t);if(st.idx===i)st.idx=i+1;else if(st.idx===i+1)st.idx=i;renderStages();save();}});
const edit=iconBtn('改');edit.title='编辑';edit.addEventListener('click',e=>{e.stopPropagation();openEdit(it.id)});
const del=iconBtn('删');del.title='删除';del.addEventListener('click',e=>{e.stopPropagation();if(!confirm('确认删除该阶段？'))return;const was=st.idx===i;st.stages.splice(i,1);if(!st.stages.length){st.stages=defaults();st.idx=0;}else if(was){st.idx=Math.max(0,i-1);}else if(i<st.idx){st.idx-=1;}apply();save();});
ctr.appendChild(up);ctr.appendChild(down);ctr.appendChild(edit);ctr.appendChild(del);
li.appendChild(num);li.appendChild(body);li.appendChild(ctr);els.stageList.appendChild(li);
});}
function renderTimer(){const s=st.stages[st.idx];els.currentStageName.textContent=s? s.name:'未定义阶段';els.timeDisplay.textContent=fmt(st.remain);
const overtime=st.remain<0;els.overtimeHint.classList.toggle('hidden',!overtime);
const total=Math.max(1,st.total);const r=Math.max(0,Math.min(total,st.remain));const ratio=1-r/total;els.progressBar.style.width=`${(ratio*100).toFixed(2)}%`;
const maxWarn=st.warnSecs.length? Math.max(...st.warnSecs):null;const warnMs=maxWarn!=null? maxWarn*1000: -1;const pb=els.progressBar;pb.classList.remove('bg-emerald-500','bg-amber-500','bg-rose-500');if(overtime)pb.classList.add('bg-rose-500');else if(warnMs>=0 && st.remain<=warnMs)pb.classList.add('bg-amber-500');else pb.classList.add('bg-emerald-500');
els.toggleBtn.textContent=st.running? '暂停 (空格)':'开始 (空格)';els.muteBtn.textContent=`提示音: ${st.beep? '开':'关'}`; if(els.prewarnInfo){els.prewarnInfo.textContent = st.warnSecs.length? `预警: ${st.warnSecs.join(',')}秒`:'预警: 无';}}
function renderAll(){renderStages();renderTimer();}
// audio
let actx=null;function ensureAudio(){if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}}
function tone(freq=880,dur=0.15,type='sine',vol=0.08){if(!st.beep)return;ensureAudio();if(!actx)return;const t0=actx.currentTime;const o=actx.createOscillator();const g=actx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=vol;o.connect(g).connect(actx.destination);o.start(t0);o.stop(t0+dur);} 
function beepWarn(){tone(880,0.12);setTimeout(()=>tone(660,0.12),180);}function beepEnd(){tone(520,0.25,'square');}
// loop
function loop(ts){if(!st.running)return; if(!st.last)st.last=ts;const d=ts-st.last;const prev=st.remain;st.last=ts;st.remain-=d; if(st.warnSecs&&st.warnSecs.length){for(const ws of st.warnSecs){const wm=ws*1000;if(!st.warnedSet.has(ws) && prev>wm && st.remain<=wm && st.remain>0){st.warnedSet.add(ws);beepWarn();break;}}}
if(!st.beeped&&st.remain<=0){st.beeped=true;beepEnd();els.timeDisplay.classList.add('animate-pulse');setTimeout(()=>els.timeDisplay.classList.remove('animate-pulse'),800); if(st.autoNext && !st.autoDone){st.autoDone=true; if(st.idx<st.stages.length-1){toggle(false);st.idx++;apply();save();}}} renderTimer(); st.raf=requestAnimationFrame(loop);} 
function toggle(on){if(on===undefined)on=!st.running; if(on){st.running=true;st.last=0;st.raf=requestAnimationFrame(loop);}else{st.running=false;st.last=0;cancelAnimationFrame(st.raf);} renderTimer();}
// edit dialog
function openEdit(id){const it=st.stages.find(x=>x.id===id);if(!it)return;st.editing=id;els.editName.value=it.name;els.editSeconds.value=it.seconds;try{els.editDialog.showModal();}catch(e){els.editDialog.setAttribute('open','');}}
function closeEdit(){st.editing=null;try{els.editDialog.close();}catch(e){els.editDialog.removeAttribute('open');}}
els.editSaveBtn.addEventListener('click',e=>{e.preventDefault();if(!st.editing)return;const idx=st.stages.findIndex(x=>x.id===st.editing);if(idx<0)return;const it=st.stages[idx];const name=els.editName.value.trim()||'未命名';let sec=parseInt(els.editSeconds.value,10);if(!(sec>0))sec=60;const editingCurrent=idx===st.idx;const oldSec=it.seconds;it.name=name;it.seconds=sec;if(editingCurrent){const oldTotal=st.total;const newTotal=sec*1000;if(oldTotal>0){const ratio=st.remain/oldTotal;st.total=newTotal;st.remain=Math.round(ratio*newTotal);}else{st.total=newTotal;st.remain=newTotal;}renderTimer();}renderStages();save();closeEdit();});
// controls
els.addStageBtn.addEventListener('click',()=>{const n={id:uid(),name:'新阶段',seconds:60};st.stages.push(n);st.idx=st.stages.length-1;apply();save();});
els.resetPresetBtn.addEventListener('click',()=>{if(!confirm('重置为预设议程？'))return;st.stages=defaults();st.idx=0;apply();save();});
els.prevBtn.addEventListener('click',()=>{if(st.idx>0){if(st.running)toggle(false);st.idx--;apply();save();}});
els.nextBtn.addEventListener('click',()=>{if(st.idx<st.stages.length-1){if(st.running)toggle(false);st.idx++;apply();save();}});
els.toggleBtn.addEventListener('click',()=>toggle());
els.resetBtn.addEventListener('click',()=>{toggle(false);st.remain=st.total;st.warnedSet=new Set();st.beeped=false;st.autoDone=false;renderTimer();});
els.plusBtn.addEventListener('click',()=>{st.remain+=10000;renderTimer();});
els.minusBtn.addEventListener('click',()=>{st.remain-=10000;renderTimer();});
els.muteBtn.addEventListener('click',()=>{st.beep=!st.beep;save();renderTimer();});
els.fsBtn.addEventListener('click',()=>{if(document.fullscreenElement){document.exitFullscreen?.();}else{document.documentElement.requestFullscreen?.();}});
// settings
function openSettings(){els.warnSecondsInput.value=st.warnSecs.join(',');els.autoAdvanceInput.checked=!!st.autoNext;try{els.settingsDialog.showModal();}catch(e){els.settingsDialog.setAttribute('open','');}}
function closeSettings(){try{els.settingsDialog.close();}catch(e){els.settingsDialog.removeAttribute('open');}}
function parseWarnSeconds(str){return (str||'').split(',').map(s=>parseInt(s.trim(),10)).filter(n=>Number.isInteger(n)&&n>0&&n<36000).slice(0,8);}
els.settingsBtn?.addEventListener('click',()=>openSettings());
els.settingsSaveBtn?.addEventListener('click',e=>{e.preventDefault();st.warnSecs=parseWarnSeconds(els.warnSecondsInput.value);st.autoNext=!!els.autoAdvanceInput.checked;save();renderTimer();closeSettings();});
// import / export
els.exportBtn?.addEventListener('click',()=>{const payload={schema:'debate-timer/v1',stages:st.stages.map(x=>({id:x.id,name:x.name,seconds:x.seconds})),settings:{beepEnabled:st.beep,warnSeconds:st.warnSecs,autoAdvance:st.autoNext}};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');const t=new Date();const pad=n=>String(n).padStart(2,'0');a.download=`debate-timer-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.json`;a.href=URL.createObjectURL(blob);document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);});
els.importBtn?.addEventListener('click',()=>{if(els.importFile){els.importFile.value='';els.importFile.click();}});
els.importFile?.addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return; if(!confirm('导入将覆盖当前议程与设置，是否继续？')){e.target.value='';return;} let text='';try{text=await file.text();}catch{alert('读取文件失败');return;} let data=null;try{data=JSON.parse(text);}catch{alert('JSON 解析失败');return;} if(!data||!Array.isArray(data.stages)){alert('无效的文件：缺少 stages');return;} const stages=data.stages.map(s=>({id:s.id||uid(),name:String(s.name||'阶段'),seconds:Math.max(5,parseInt(s.seconds,10)||60)})); st.stages=stages; st.idx=0; if(data.settings){if(typeof data.settings.beepEnabled==='boolean')st.beep=data.settings.beepEnabled; if(Array.isArray(data.settings.warnSeconds))st.warnSecs=data.settings.warnSeconds.filter(n=>Number.isInteger(n)&&n>0); if(typeof data.settings.autoAdvance==='boolean')st.autoNext=data.settings.autoAdvance;} apply(); save();});
window.addEventListener('keydown',e=>{const tag=(e.target&&e.target.tagName)||'';if(/INPUT|TEXTAREA|SELECT/.test(tag))return; if(e.key===' '){e.preventDefault();toggle();}
else if(e.key==='ArrowLeft'){e.preventDefault();els.prevBtn.click();}
else if(e.key==='ArrowRight'){e.preventDefault();els.nextBtn.click();}
else if(e.key==='+'){e.preventDefault();els.plusBtn.click();}
else if(e.key==='-'){e.preventDefault();els.minusBtn.click();}
else if(e.key==='r'||e.key==='R'){e.preventDefault();els.resetBtn.click();}
else if(e.key==='f'||e.key==='F'){e.preventDefault();els.fsBtn.click();}
else if(e.key==='m'||e.key==='M'){e.preventDefault();els.muteBtn.click();}
});
window.addEventListener('pointerdown',()=>{ensureAudio();},{once:true});
load();})();
