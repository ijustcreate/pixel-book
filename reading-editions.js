'use strict';
// Reading editions are derived, in memory. Original text and all edition-local
// edits remain intact; only overrides and the original-edition snapshot persist.
const READING_SIZE=12,READING_LEADING=16.6;
const editionFields=['starterId','pageCount','sourcePageCount','pages','edgeBookmarks','insertMounts','pageFormat','readingLayoutKey'];
function editionSnapshot(book){return Object.fromEntries(editionFields.map(k=>[k,structuredClone(book[k])]))}
function isReadingEdition(book=bookContent){return !!starterLibrary.get(book.starterId)?.readingEdition;}
function canReadablyCompose(book){const base=starterLibrary.get(book.starterId);return !!base&&!base.legacy&&(bookLayoutProfile(book).strategy==='play'||!Object.values(base.pages).some(p=>p.preserveLines));}
function buildLegacyReadingEdition(book,{store=true}={}){
  const source=book.readingSource,base=starterLibrary.get(source?.starterId);if(!base)return null;
  // Copies keep their immutable derived-base identity even if the original
  // shelf entry is removed; each copy still owns its own editable overrides.
  const id=book.starterId?.startsWith('reading-')?book.starterId:book.readableState?.starterId||'reading-'+book.id;
  const ratio=clamp(bookFormat({...book,...source}).ratio,.72,.85),scale=ratio/ORIGINAL_PAGE_RATIO;
  const p=document.createElement('canvas').getContext('2d');p.font=READING_SIZE+'px Georgia';p.fontKerning='none';
  const width=328*scale,space=p.measureText(' ').width,widths=new Map();
  const wordWidth=w=>{if(!widths.has(w))widths.set(w,p.measureText(w).width);return widths.get(w);};
  const pages={},first={},ranges=[],sourceCount=source.sourcePageCount||base.sourcePageCount||source.pageCount;
  let tokens=[],header=null;
  function emitRun(){
    let cursor=0,firstLeaf=true;
    while(cursor<tokens.length){
      const pageIndex=ranges.length,top=firstLeaf&&header?.chapterOpening?66:28,maxLines=Math.floor((320-top)/READING_LEADING),lines=[],indents=[],selected=[];
      while(cursor<tokens.length&&lines.length<maxLines){
        const indent=tokens[cursor].paragraph&&cursor>0?READING_SIZE*1.1:0;let used=indent,line=[];
        while(cursor<tokens.length){const t=tokens[cursor],w=wordWidth(t.word);if(line.length&&(t.paragraph||used+space+w>width))break;used+=(line.length?space:0)+w;line.push(t.word);selected.push(t);cursor++;}
        lines.push(line.join(' '));indents.push(indent/scale);
      }
      const span=[];for(const t of selected){let r=span.at(-1);if(!r||r.page!==t.source){r={page:t.source,start:t.offset,end:t.offset+1};span.push(r);}else r.end=t.offset+1;if(first[t.source]===undefined)first[t.source]=pageIndex;}
      const opening=firstLeaf?header?.chapterOpening:'';
      pages[pageIndex]={novel:true,font:'serif',role:firstLeaf&&header?.role==='section'?'section':'body',tocLabel:firstLeaf?header?.tocLabel:'',title:'',body:(opening?opening+'\n':'')+selected.filter(t=>!t.continuation).map(t=>t.original||t.word).join(' '),chapterOpening:opening,readingLines:lines,readingIndents:indents,readingTop:top,readingSize:READING_SIZE,readingLineHeight:READING_LEADING,sourceRanges:span,sourcePage:(span[0]?.page??0)+1};
      pages[pageIndex].paragraphStarts=selected.filter(t=>!t.continuation).map((t,i)=>t.paragraph?i+(opening?opening.trim().split(/\s+/).length:0):-1).filter(i=>i>0);pages[pageIndex].readingBody=pages[pageIndex].body;ranges.push(span);firstLeaf=false;
    }
    tokens=[];header=null;
  }
  for(let n=0;n<sourceCount;n++){
    const data=structuredClone(source.pages?.[n]||base.pages[n]||{});
    // Authored artwork and marked pages stay together. Reflow only plain prose.
    const marked=[...(source.edgeBookmarks||[]),...(source.insertMounts||[])].some(m=>m.state?.pageNumber===n);
    const fixed=source.pages?.[n]||data.titlePage||data.tocRows||data.sourceFigures?.length||data.images?.length||data.art||data.drawing||marked||!data.novel||!data.body?.trim()||data.body.trim()===data.chapterOpening;
    if(fixed){emitRun();first[n]=ranges.length;data.sourceRanges=[{page:n,start:0,end:String(data.body||'').trim().split(/\s+/).filter(Boolean).length}];pages[ranges.length]=data;ranges.push(data.sourceRanges);continue;}
    if(data.chapterOpening||data.role==='section'){emitRun();header=data;}
    const words=data.body.trim().split(/\s+/),heading=data.chapterOpening&&data.body.startsWith(data.chapterOpening)?data.chapterOpening.trim().split(/\s+/).length:0;
    const starts=new Set(data.paragraphStarts||[]);
    if(!data.paragraphStarts){let offset=0;for(const paragraph of data.body.trim().split(/\n\s*\n/)){if(offset)starts.add(offset);offset+=paragraph.trim().split(/\s+/).length;}}
    for(let i=heading;i<words.length;i++){
      const original=words[i];let remaining=original,continuation=false;
      while(wordWidth(remaining)>width-READING_SIZE*1.1){let chunk='';for(const char of remaining){if(chunk&&wordWidth(chunk+char+'‐')>width-READING_SIZE*1.1)break;chunk+=char;}tokens.push({word:chunk+'‐',original,continuation,source:n,offset:i,paragraph:!continuation&&starts.has(i)});remaining=remaining.slice(chunk.length);continuation=true;}
      tokens.push({word:remaining,original,continuation,source:n,offset:i,paragraph:!continuation&&starts.has(i)});
    }
  }
  emitRun();
  function chapterTarget(target,label){
    const expected=headingKey(label);
    for(const offset of [0,1,-1,2,-2]){const n=target+offset,d=source.pages?.[n]||base.pages[n];if(!d||d.tocRows)continue;
      if([d.chapterOpening,d.tocLabel,d.body?.trim().split('\n')[0]].some(text=>text&&headingKey(text)===expected))return first[n]??0;
    }
    return first[target]??0;
  }
  for(const data of Object.values(pages))if(data.tocRows)for(const row of data.tocRows){row.target=chapterTarget(row.target,row.label);row.folio=String(row.target+1);}
  const count=ranges.length;if(count%2)pages[count]={novel:true,body:'',padding:true};
  const edition={...base,starterId:id,readingEdition:true,format:{widthPt:ratio*648,heightPt:648},pages,pageCount:Math.ceil(count/2)*2,sourcePageCount:count,contents:base.contents?.map(c=>({...c,page:chapterTarget(c.page,c.sourceLabel||c.label)})),firstSourcePage:first,ranges};
  if(store)starterLibrary.set(id,edition);return edition;
}
function prepareReadingBook(book){
  if(book.readingSource){ensureReadingEdition(book);return;}
  if(book.paginationChoice==='source'||!canReadablyCompose(book))return;
  const original=book.id===activeBookId&&bookContent.starterId===book.starterId?bookContent:book;
  book.readingSource=editionSnapshot(original);const edition=buildReadingEdition(book);if(!edition)return;
  const mapMarks=marks=>(marks||[]).map(m=>({...structuredClone(m),state:{...m.state,pageNumber:edition.firstSourcePage[m.state?.pageNumber]??m.state?.pageNumber}}));
  Object.assign(book,{starterId:edition.starterId,pageCount:edition.pageCount,sourcePageCount:edition.sourcePageCount,pages:{},pageFormat:{mode:'source'},edgeBookmarks:mapMarks(original.edgeBookmarks),insertMounts:mapMarks(original.insertMounts)});
  book.paginationChoice='reading';book.readingLayoutKey=edition.layoutKey;
}
function restoreReadingEditions(){let changed=false;for(const book of savedBooks)if(book.readingSource){if(book.id===activeBookId&&bookContent.starterId===book.starterId){for(const k of editionFields)book[k]=structuredClone(bookContent[k]);}changed=ensureReadingEdition(book)||changed;if(book.id===activeBookId){for(const k of editionFields)bookContent[k]=structuredClone(book[k]);bookContent.readingSource=structuredClone(book.readingSource);bookContent.readableState=structuredClone(book.readableState);}}if(changed){localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));persistBookContent();}}
function sourceLocation(number){const data=bookPage(number);return isReadingEdition()?data.sourceRanges?.[0]||{page:Math.max(0,(data.sourcePage||1)-1),start:0}:{page:number,start:0};}
function readingDestination(location,edition){const found=edition.ranges.findIndex(rs=>rs.some(r=>r.page===location.page&&r.start<=location.start&&r.end>location.start));return found>=0?found:edition.firstSourcePage[location.page]??0;}
function changePagination(mode){
  if(motion||coverMotion)return;const book=savedBooks.find(b=>b.id===activeBookId);if(!book)return;
  let location=sourceLocation(visibleReaderPage());saveBook(false);
  if(mode==='source'&&isReadingEdition()){
    book.readingReturn=location;book.readableState=editionSnapshot(bookContent);Object.assign(book,structuredClone(book.originalState||book.readingSource));book.paginationChoice='source';
  }else if(mode==='reading'&&!isReadingEdition()){
    if(book.readingReturn?.page===location.page)location=book.readingReturn;
    if(book.readingSource){book.originalState=editionSnapshot(bookContent);const edition=starterLibrary.get('reading-'+book.id)||buildReadingEdition(book);Object.assign(book,book.readableState||{starterId:edition.starterId,pageCount:edition.pageCount,sourcePageCount:edition.sourcePageCount,pages:{},pageFormat:{mode:'source'},edgeBookmarks:[],insertMounts:[]});book.paginationChoice='reading';}
    else{delete book.paginationChoice;prepareReadingBook(book);}
  }
  localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));openSavedBook(book.id);
  const target=isReadingEdition()?readingDestination(location,starterLibrary.get(bookContent.starterId)):location.page;
  spread=Math.floor((target+1)/2);preferredReaderPage=target;updateControls();draw();
}
const paginationControl=document.createElement('label');paginationControl.innerHTML='Pagination <select id="reading-pagination"><option value="reading">Reading edition · larger text</option><option value="source">Original pages</option></select><small>The font selector styles both the text and headings. Edits stay separate in each edition. Z enlarges one page.</small>';
$('#reader-type-slot').prepend(paginationControl);$('#reading-pagination').onchange=e=>changePagination(e.target.value);
function syncPaginationControl(){paginationControl.hidden=!isReadingEdition()&&!canReadablyCompose(bookContent);$('#reading-pagination').value=isReadingEdition()?'reading':'source';}
function rememberReadingPosition(){
  if(!loaded||motion||coverMotion||closedEdge||bookTableMode||bookShelfMode||!activeBookId)return;
  localStorage.setItem('book-reading-position-'+activeBookId,JSON.stringify(sourceLocation(visibleReaderPage())));
}
function restoreReadingPosition(){
  let location=null;try{location=JSON.parse(localStorage.getItem('book-reading-position-'+activeBookId));}catch{}
  const number=location?(isReadingEdition()?readingDestination(location,starterLibrary.get(bookContent.starterId)):location.page):0;
  preferredReaderPage=clamp(number,0,readingPageCount()-1);spread=Math.floor((preferredReaderPage+1)/2);
  let focus=null;try{focus=JSON.parse(localStorage.getItem('book-focus-'+activeBookId));}catch{}
  bookFocusSide=focus===1||focus===-1?focus:null;bookFocusId=activeBookId;focusControls.hidden=bookFocusSide===null;
}
