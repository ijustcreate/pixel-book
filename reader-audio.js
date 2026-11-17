'use strict';
// Kokoro is loaded on demand in a worker. Book text stays on this device.
(() => {
  const voices=[['af_heart','Heart · US'],['af_sarah','Sarah · US'],['af_bella','Bella · US'],['am_adam','Adam · US'],['am_michael','Michael · US'],['bf_emma','Emma · UK'],['bm_george','George · UK']];
  const article=$('#reading-text'),dialog=$('#reading-view');
  const controls=document.createElement('section');controls.className='reading-audio';controls.setAttribute('aria-label','Read aloud');
  controls.innerHTML='<div class="reading-audio-buttons"><button id="audio-play">Read aloud</button><button id="audio-pause" disabled>Pause</button><button id="audio-stop" disabled>Stop</button><label>Voice <select id="audio-voice" aria-label="Narrator voice"></select></label><label>Speed <select id="audio-speed" aria-label="Narration speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><label><input id="audio-continue" type="checkbox" checked> Continue to next page</label></div><p id="audio-status" role="status">Local AI voices · first use downloads the voice model; then it is cached on this device.</p>';
  article.before(controls);
  const voice=$('#audio-voice'),speed=$('#audio-speed'),status=$('#audio-status'),play=$('#audio-play'),pause=$('#audio-pause'),stop=$('#audio-stop');
  for(const [id,name] of voices)voice.add(new Option(name,id));
  voice.add(new Option('Device voice · no model download','device'));
  voice.value=localStorage.getItem('book-audio-voice')||'af_heart';if(!voice.value)voice.value='af_heart';
  speed.value=localStorage.getItem('book-audio-speed')||'1';if(!speed.value)speed.value='1';
  let engine=null,connecting=null,audioCtx=null,source=null,epoch=0,running=false,paused=false,frame=0,marked=null,internalPage=false,words=[],text='',utterance=null;
  const note=value=>{status.textContent=value;};
  function buttons(){play.disabled=running;pause.disabled=!running;stop.disabled=!running;pause.textContent=paused?'Resume':'Pause';voice.disabled=running;speed.disabled=running;}
  function mark(index){const next=words[index]?.node;if(marked===next)return;marked?.classList.remove('spoken-word');marked=next;if(next){next.classList.add('spoken-word');const r=next.getBoundingClientRect(),a=article.getBoundingClientRect();if(r.top<a.top+12||r.bottom>a.bottom-12)next.scrollIntoView({block:'center',behavior:'instant'});}}
  function tokenize(){
    words=[];text='';
    for(const block of article.querySelectorAll('h2,h3,p')){
      const value=block.textContent;if(!value.trim())continue;
      if(text)text+='\n\n';const offset=text.length;text+=value;
      const fragment=document.createDocumentFragment();let cursor=0;
      for(const m of value.matchAll(/\S+/g)){fragment.append(document.createTextNode(value.slice(cursor,m.index)));const span=document.createElement('span');span.className='narration-word';span.textContent=m[0];words.push({start:offset+m.index,end:offset+m.index+m[0].length,node:span});fragment.append(span);cursor=m.index+m[0].length;}
      fragment.append(document.createTextNode(value.slice(cursor)));block.replaceChildren(fragment);
    }
  }
  function reset(message='Stopped.'){
    epoch++;running=false;paused=false;cancelAnimationFrame(frame);frame=0;
    if(source){source.stop();source=null;}window.speechSynthesis?.cancel();utterance=null;
    engine?.clear();if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
    mark(-1);buttons();note(message);
  }
  function chunks(){
    // Bound work and prefetch to one short passage ahead, never a whole book.
    const result=[];let start=0;
    while(start<text.length){let end=Math.min(text.length,start+300);if(end<text.length){const slice=text.slice(start,end),sentence=Math.max(slice.lastIndexOf('. '),slice.lastIndexOf('! '),slice.lastIndexOf('? '),slice.lastIndexOf('\n'));const boundary=sentence>60?sentence+1:slice.lastIndexOf(' ');if(boundary>0)end=start+boundary;}
      if(text.slice(start,end).trim())result.push({text:text.slice(start,end),start,end});start=end;while(/\s/.test(text[start]||'')&&start<text.length)start++;
    }return result;
  }
  async function connect(ticket){
    if(engine?.isConnected)return engine;
    if(!connecting)connecting=(async()=>{
      const {HeadTTS}=await import('./assets/vendor/headtts/modules/headtts.mjs');
      const instance=new HeadTTS({audioCtx,endpoints:['webgpu','wasm'],languages:['en-us'],voices:[],defaultVoice:voice.value,splitSentences:false,splitLength:350,dtypeWebgpu:'fp32',dtypeWasm:'q4',dictionaryURL:new URL('./assets/vendor/headtts/dictionaries/',location.href).href});
      instance.onerror=()=>{};
      try{await instance.connect(null,event=>{if(ticket===epoch)note(event.lengthComputable?'Loading local voices · '+Math.round(event.loaded/event.total*100)+'%':'Loading local voices…');});engine=instance;return instance;}
      catch(error){instance.ww?.terminate();throw error;}
    })().finally(()=>{connecting=null;});
    return connecting;
  }
  function timedWords(data,chunk){
    let cursor=chunk.start;
    return (data.words||[]).map((word,i)=>{
      const value=String(word).trim();let at=text.indexOf(value,cursor);
      if(at<cursor||at>=chunk.end)at=cursor;
      const index=words.findIndex(w=>w.end>at&&w.start<chunk.end);cursor=at+value.length;
      return {index,time:Number(data.wtimes?.[i]||0)/1000,duration:Number(data.wdurations?.[i]||0)/1000};
    });
  }
  async function synthesize(tts,chunk){
    const messages=await tts.synthesize({input:chunk.text});
    const error=messages.find(m=>m.type==='error');if(error)throw Error(error.data?.error||'Voice generation failed.');
    const audio=messages.filter(m=>m.type==='audio'&&m.data?.audio);if(!audio.length)throw Error('The voice returned no audio.');return audio.map(m=>m.data);
  }
  function playback(data,chunk,ticket){
    return new Promise((resolve,reject)=>{
      if(ticket!==epoch)return resolve();
      const node=audioCtx.createBufferSource();node.buffer=data.audio;node.connect(audioCtx.destination);source=node;
      const start=audioCtx.currentTime,times=timedWords(data,chunk);let index=-1;
      node.onended=()=>{if(source===node)source=null;cancelAnimationFrame(frame);node.disconnect();resolve();};
      const tick=()=>{if(ticket!==epoch)return;const now=audioCtx.currentTime-start;while(index+1<times.length&&times[index+1].time<=now)index++;if(index>=0)mark(now<=times[index].time+times[index].duration?times[index].index:-1);frame=requestAnimationFrame(tick);};
      try{node.start();tick();}catch(error){reject(error);}
    });
  }
  async function neuralPage(ticket){
    const tts=await connect(ticket);if(ticket!==epoch)return;
    await tts.setup({voice:voice.value,language:'en-us',speed:Number(speed.value),audioEncoding:'wav'});if(ticket!==epoch)return;
    const passages=chunks();let pending=passages.length?synthesize(tts,passages[0]):null;
    for(let i=0;i<passages.length&&ticket===epoch;i++){
      note(paused?'Paused.':'Preparing voice…');const audio=await pending;if(ticket!==epoch)return;
      pending=i+1<passages.length?synthesize(tts,passages[i+1]):null;
      // Observe a prefetch rejection immediately; it is rethrown when awaited.
      pending?.catch(()=>{});note(paused?'Paused.':'Reading · '+voice.selectedOptions[0].textContent);
      for(const data of audio){if(ticket!==epoch)return;await playback(data,passages[i],ticket);}
    }
  }
  async function devicePage(ticket){
    if(!window.speechSynthesis)throw Error('Device speech is unavailable. Choose a local AI voice.');
    for(const chunk of chunks()){
      if(ticket!==epoch)return;
      await new Promise((resolve,reject)=>{
        const u=new SpeechSynthesisUtterance(chunk.text);utterance=u;u.rate=Number(speed.value);
        u.onboundary=event=>{if(ticket===epoch){const at=chunk.start+event.charIndex;mark(words.findIndex(w=>w.end>at));}};
        u.onend=resolve;u.onerror=event=>event.error==='canceled'||event.error==='interrupted'?resolve():reject(Error('Device voice: '+event.error));
        note('Reading · device voice');speechSynthesis.speak(u);
      });
    }
  }
  async function start(){
    reset('Preparing voice…');tokenize();if(!words.length){note('No readable text on this page.');return;}
    const ticket=epoch;running=true;buttons();
    try{
      if(voice.value!=='device'){audioCtx??=new AudioContext();await audioCtx.resume();}
      while(ticket===epoch){
        if(voice.value==='device')await devicePage(ticket);else await neuralPage(ticket);
        if(ticket!==epoch)return;
        if(!$('#audio-continue').checked||readerPage>=readingPageCount()-1){reset('Finished reading.');return;}
        internalPage=true;try{readerPage++;preferredReaderPage=readerPage;renderReadingPage();tokenize();}finally{internalPage=false;}
        if(!words.length){continue;}
      }
    }catch(error){if(ticket===epoch)reset('Could not load or play this voice. Try again or choose Device voice. '+(error.message||String(error)));}
  }
  play.onclick=start;stop.onclick=()=>reset();
  pause.onclick=async()=>{if(!running)return;paused=!paused;if(voice.value==='device'){paused?speechSynthesis.pause():speechSynthesis.resume();}else if(audioCtx){await (paused?audioCtx.suspend():audioCtx.resume());}buttons();note(paused?'Paused.':'Reading…');};
  voice.onchange=()=>localStorage.setItem('book-audio-voice',voice.value);speed.onchange=()=>localStorage.setItem('book-audio-speed',speed.value);
  document.addEventListener('book-reading-page-changing',()=>{if(!internalPage)reset('Ready to read this page.');});
  dialog.addEventListener('close',()=>reset());window.addEventListener('pagehide',()=>{reset();engine?.ww?.terminate();});
  const quick=document.createElement('button');quick.id='read-aloud-open';quick.textContent='Read aloud';quick.title='Read this page with a local voice';quick.onclick=()=>{$('#read-text').click();play.focus();};$('.reader-navigation nav').append(quick);
  // Expose state for UI verification without exposing model internals or text.
  window.bookNarration={stop:reset,get state(){return {running,paused,highlighted:marked?.textContent||null,voice:voice.value};}};
})();
