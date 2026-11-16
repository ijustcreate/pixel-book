'use strict';
function playLineKind(text,cast=false){
  if(cast)return 'cast';
  if(/^\[[^\]]+\]\s+\S/.test(text))return 'verse';
  if(/^(?:\[|\(?\b(?:Enter|Exit|Exeunt|Re-enter|Reenter|They fight|Fight|Within|Flourish|Alarum|Music)\b)/i.test(text))return 'direction';
  if(/^[A-Z][A-Z ’'\-]+\.$/.test(text))return 'speaker';
  if(/^THE END\.?$/.test(text))return 'end';return 'verse';
}
function playSourceRecords(data,n){
  const records=[];let offset=0;
  for(const [index,line] of String(data.body||'').split('\n').entries()){
    const text=line.trim(),count=text.split(/\s+/).filter(Boolean).length;if(text)records.push({text,semanticText:text,source:n,start:offset,end:offset+count,lineId:n+':'+index});offset+=count;
  }
  // Rejoin a PDF's separately extracted drop capital for display. Its exact
  // semantic text and source words remain intact for edits and comparisons.
  for(let i=0;i<records.length-1;i++)if(i===1&&/^Dramatis Person/i.test(records[0].text)&&records[i].text==='E'&&/^SCALUS,/.test(records[i+1].text)){
    const a=records[i],b=records[i+1];b.text=a.text+b.text;b.semanticText=a.semanticText+'\n'+b.semanticText;b.start=a.start;b.lineId=a.lineId;records.splice(i,1);
  }
  return records;
}
function buildPlayEdition(book){
  const source=book.readingSource,base=starterLibrary.get(source?.starterId);if(!base)return null;
  const {profile,font,ratio,key}=readingLayoutSpec(book),id='reading-'+book.id,scale=ratio/ORIGINAL_PAGE_RATIO,family=bookFontFamilyFor(book);
  const logical={...book,starterId:id,format:{widthPt:ratio*648,heightPt:648},pageFormat:{mode:'source'}};
  const p=document.createElement('canvas').getContext('2d');p.fontKerning='none';
  const size=profile.bodySize,leading=size*profile.leading,pages={},ranges=[],first={},pinPages={},pins=source.flowPins||[],inserted=new Set();
  let current=null,lastSpeaker='',cast=false,directionActive=false;
  function add(data,span){const n=ranges.length;data.sourceRanges=span;pages[n]=data;ranges.push(span);for(const r of span)if(first[r.page]===undefined)first[r.page]=n;return n;}
  function begin(record=null,heading=null){
    const draft=heading?{...heading,body:heading.text,chapterOpening:heading.text,sourcePage:heading.source+1}:null;
    const top=draft?chapterHeadingLayout(draft,logical)?.bodyTop||profile.top:profile.top;
    current={runs:[],blocks:[],heading:draft,top,y:top,source:record?.source,continuation:record?.kind==='verse'?lastSpeaker:''};
    if(heading)current.blocks.push({...heading,kind:'heading'});
  }
  function flush(boundary='continuation'){
    if(!current)return;
    if(!current.blocks.length){current=null;return;}
    const span=[];for(const r of current.blocks){const last=span.at(-1);if(last&&last.page===r.source&&last.end===r.start)last.end=r.end;else span.push({page:r.source,start:r.start,end:r.end});}
    const body=current.blocks.map(r=>r.semanticText).filter(Boolean).join('\n'),heading=current.heading;
    add({novel:true,preserveLines:true,font:'serif',role:heading?'section':'body',tocLabel:heading?.tocLabel||heading?.chapterOpening||'',title:'',body,playBody:body,
      chapterOpening:heading?.chapterOpening||'',sourcePage:(current.blocks[0]?.source??0)+1,playLayout:current.runs,playBlocks:current.blocks,playHeading:!!heading,playTop:current.top,playBottom:current.y,playSize:size,playLeading:leading,playContinuation:current.continuation,flowBoundary:boundary},span);
    current=null;
  }
  function insertPin(pin){if(inserted.has(pin.anchor))return;flush('scene end');const data=structuredClone(pin.page);data.flowPinned=true;pinPages[pin.anchor]=add(data,structuredClone(pin.ranges));inserted.add(pin.anchor);}
  function wrap(record){
    const kind=record.kind,rowSize=kind==='direction'?size-1:size,indent=kind==='verse'?8:kind==='direction'?6:0;
    p.font=rowSize+'px '+family;
    const width=(profile.width-indent)*scale,words=record.text.split(/\s+/),rows=[];let line='',start=0,used=0;
    for(let i=0;i<words.length;i++){
      const next=line?line+' '+words[i]:words[i];
      if(line&&p.measureText(next).width>width-(rows.length?12*scale:0)){rows.push({text:line,start,end:i});line=words[i];start=i;}else line=next;
      used=i+1;
    }
    if(line)rows.push({text:line,start,end:used});
    return {rows,rowSize,indent,lineHeight:kind==='direction'?rowSize*1.38:leading,gap:kind==='speaker'?4:kind==='direction'?3:kind==='end'?8:0};
  }
  function append(record,next){
    if(!current)begin(record);
    const layout=wrap(record),height=layout.gap+layout.rows.length*layout.lineHeight;
    // A speaker must have dialogue beneath the name on the same page.
    const keep=record.kind==='speaker'&&next?wrap(next).lineHeight*wrap(next).rows.length:0;
    if(current.y+height+keep>profile.bottom&&current.runs.length){flush();begin(record);}
    let row=0;
    while(row<layout.rows.length){
      const available=Math.max(1,Math.floor((profile.bottom-current.y-layout.gap)/layout.lineHeight)),take=Math.min(available,layout.rows.length-row);
      const fragment=layout.rows.slice(row,row+take),whole=row===0&&take===layout.rows.length;
      const semanticText=whole?record.semanticText:fragment.map(r=>r.text).join(' ');
      const start=whole?record.start:record.start+fragment[0].start,end=whole?record.end:record.start+fragment.at(-1).end;
      current.blocks.push({...record,semanticText,start,end});current.y+=layout.gap;
      for(const [i,r] of fragment.entries()){
        const continuation=row+i>0,x=36+layout.indent+(continuation?12:0),center=record.kind==='end'||record.kind==='direction'&&layout.rows.length===1;
        current.runs.push({text:r.text,x:center?200:x,y:current.y,size:layout.rowSize,kind:record.kind,center,lineId:record.lineId,continuation});current.y+=layout.lineHeight;
      }
      row+=take;if(row<layout.rows.length){flush();begin(record);}
    }
    if(record.kind==='speaker')lastSpeaker=record.text;
  }
  const count=source.sourcePageCount||base.sourcePageCount||source.pageCount;
  for(let n=0;n<count;n++){
    const data=structuredClone(source.pages?.[n]||base.pages[n]||{}),records=playSourceRecords(data,n),words=String(data.body||'').trim().split(/\s+/).filter(Boolean).length;
    const expected=[data.chapterOpening,data.tocLabel].filter(Boolean).map(headingKey);let headingText='';
    for(let count=1;count<=Math.min(4,records.length);count++){
      headingText+=(count>1?' ':'')+records[count-1].text;
      if(expected.includes(headingKey(headingText))){if(count>1){const joined={...records[0],text:headingText,semanticText:records.slice(0,count).map(r=>r.semanticText).join('\n'),end:records[count-1].end};records.splice(0,count,joined);}break;}
    }
    const authored=source.pages?.[n]||[...(source.edgeBookmarks||[]),...(source.insertMounts||[])].some(m=>m.state?.pageNumber===n);
    const fixed=authored||data.titlePage||data.tocRows||data.sourceFigures?.length||data.images?.length||data.art||!records.length;
    if(fixed){flush('scene end');const pin=pins.find(pin=>pin.ranges[0]?.page===n);if(pin){insertPin(pin);continue;}add({...data,...(authored?{flowPinned:true}:{})},[{page:n,start:0,end:words}]);continue;}
    if(records.length===1&&/^Act\s+[IVXLCDM]+$/i.test(records[0].text)){
      flush('scene end');cast=false;lastSpeaker='';directionActive=false;add({...data,playAct:records[0].text,role:'section',tocLabel:records[0].text},[{page:n,start:0,end:words}]);continue;
    }
    for(let i=0;i<records.length;i++){
      const record=records[i],pin=pins.find(pin=>pin.ranges.some(r=>r.page===n&&record.start>=r.start&&record.start<r.end));if(pin){insertPin(pin);continue;}
      const heading=record.start===0&&[data.chapterOpening,data.tocLabel].some(label=>label&&headingKey(label)===headingKey(record.text));
      if(heading){flush('scene end');cast=/Dramatis/i.test(record.text);lastSpeaker='';directionActive=false;begin(record,{...record,chapterOpening:record.text,tocLabel:data.tocLabel||record.text});continue;}
      record.kind=playLineKind(record.text,cast);
      if(directionActive&&record.kind==='verse')record.kind='direction';
      directionActive=record.kind==='direction'&&!/\]|[.?!]$/.test(record.text);
      const nextRecord=records[i+1]||(n+1<count?playSourceRecords(source.pages?.[n+1]||base.pages[n+1]||{},n+1)[0]:null);
      const next=nextRecord?{...nextRecord,kind:playLineKind(nextRecord.text,cast)}:null;
      append(record,next);
    }
  }
  flush('scene end');
  function destination(n){return first[n]??0;}
  for(const data of Object.values(pages))if(data.tocRows)for(const row of data.tocRows){row.target=destination(row.target);row.folio=String(row.target+1);}
  const readingCount=ranges.length;if(readingCount%2)pages[readingCount]={novel:true,body:'',padding:true};
  const edition={...base,starterId:id,readingEdition:true,layoutVersion:BOOK_LAYOUT_VERSION,layoutKey:key,bodySize:size,profile,font,format:logical.format,pages,ranges,pinPages,firstSourcePage:first,pageCount:Math.ceil(readingCount/2)*2,sourcePageCount:readingCount,contents:base.contents?.map(c=>({...c,page:destination(c.page)}))};
  starterLibrary.set(id,edition);return edition;
}
function playBodyLayout(data){
  return {lines:data.playLayout.map(r=>r.text),runs:data.playLayout,size:data.playSize,lineHeight:data.playLeading,top:data.playTop,x:36,family:bookFontFamily(),usedHeight:data.playBottom-data.playTop};
}
function drawPlayAct(p,data){
  p.save();p.textAlign='center';p.textBaseline='top';p.fillStyle='#302019';p.font='30px '+bookFontFamily();p.fillText(data.playAct,200,119);printBookOrnament(p,174);p.restore();
}
