'use strict';
// Edition decisions live together, rather than deriving typography from page
// count or making an entire volume fit its most crowded imported source page.
const BOOK_LAYOUT_VERSION=2;
const bookLayoutProfiles=Object.freeze({
  dracula:{kind:'journal novel',bodySize:11.5,chapter:'journal subtitle'},
  frankenstein:{kind:'novel in volumes',bodySize:11.5,chapter:'volume and chapter'},
  'dorian-gray':{kind:'novel',bodySize:11.5,chapter:'numbered chapter'},
  'peter-pan':{kind:'illustrated children’s novel',bodySize:11.5,chapter:'number and title',shelfLength:390,shelfWidth:344,shelfThicknessScale:1.16},
  'time-machine':{kind:'novella',bodySize:11.5,chapter:'number and title'},
  'common-sense':{kind:'essay',bodySize:11.5,chapter:'section title',frontMatter:{prefix:'THOMAS PAINE COMMON SENSE (1776)',title:'Common Sense',subtitle:'Thomas Paine · 1776'}},
  'secret-garden':{kind:'children’s novel',bodySize:11.5,chapter:'number and title'},
  'romeo-juliet':{kind:'verse drama',strategy:'play',preserveLines:true,bodySize:11.5,leading:1.32,chapter:'act and scene'},
  'divine-comedy':{kind:'verse',preserveLines:true,chapter:'part and canto',backMatterFrom:408},
  'inferno-dore':{kind:'illustrated verse',preserveLines:true,chapter:'canto and plate'}
});
function bookLayoutProfile(book){
  const id=book.readingSource?.starterId||book.starterId;
  return {top:28,bottom:320,width:328,leading:1.38,bodySize:11.5,...bookLayoutProfiles[id]};
}
function classifyBookPage(data,book=bookContent){
  if(data.padding)return 'binding padding';if(data.titlePage)return 'title';if(data.tocRows)return 'contents';
  if(data.sourceFigures?.length)return data.body?.trim()?'illustration and text':'illustration';
  if(data.flowPinned||data.art||data.images?.length)return 'authored';
  if(data.playLayout)return data.playHeading?'scene opening':'play dialogue';if(data.preserveLines)return 'verse';if((data.sourcePage||0)-1>=bookLayoutProfile(book).backMatterFrom)return 'back matter';if(data.chapterOpening||data.role==='section')return 'chapter opening';
  return data.body?.trim()?'prose':'blank';
}
function closedBookDimensions(book){
  const profile=bookLayoutProfile(book),length=profile.shelfLength||450;
  return {length,width:profile.shelfWidth||length*bookFormatRatio(book),...(profile.shelfThicknessScale?{height:ClosedBooks3D.thickness(physicalPageCount(book))*profile.shelfThicknessScale}:{})};
}
function readingLayoutSpec(book){
  const source=book.readingSource,profile=bookLayoutProfile(book),font=book.bookFont||DEFAULT_BOOK_FONT;
  const ratio=clamp(bookFormat({...book,...source}).ratio,.72,.85);
  return {profile,font,ratio,key:JSON.stringify([BOOK_LAYOUT_VERSION,source?.starterId,font,ratio,profile])};
}
function buildReadingEdition(book){
  if(bookLayoutProfile(book).strategy==='play')return buildPlayEdition(book);
  const source=book.readingSource,base=starterLibrary.get(source?.starterId);if(!base)return null;
  const {profile,font,ratio,key}=readingLayoutSpec(book),size=profile.bodySize,scale=ratio/ORIGINAL_PAGE_RATIO;
  const id='reading-'+book.id,family=bookFontFamilyFor(book),logicalBook={...book,starterId:id,format:{widthPt:ratio*648,heightPt:648},pageFormat:{mode:'source'}};
  const p=document.createElement('canvas').getContext('2d');p.font=size+'px '+family;p.fontKerning='none';
  const metrics=p.measureText('Agjy'),leading=Math.max(size*profile.leading,metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent+.8);
  const width=profile.width*scale,widths=new Map(),measure=word=>{if(!widths.has(word))widths.set(word,p.measureText(word).width);return widths.get(word);},space=measure(' ');
  const pages={},first={},ranges=[],pinPages={},pins=source.flowPins||[],inserted=new Set();let tokens=[],header=null;
  const headingOffsets=new Map(),headingPages=[];
  function registerHeading(n,offset,label){if(!headingOffsets.has(n))headingOffsets.set(n,new Map());headingOffsets.get(n).set(offset,label);}
  // A PDF destination can point at a page where the section begins halfway
  // down the sheet. Locate its actual heading, not merely that page's start.
  for(const chapter of base.contents||[]){
    const label=chapter.sourceLabel||chapter.label,expected=headingKey(label);let found=false;
    for(const delta of [0,1,-1,2,-2]){
      const n=chapter.page+delta,data=source.pages?.[n]||base.pages[n];if(!data?.body||data.tocRows||data.titlePage)continue;
      const lines=data.body.split('\n');let offset=0;
      for(let i=0;i<lines.length;i++){
        let candidate='';for(let j=i;j<Math.min(lines.length,i+3);j++){candidate+=' '+lines[j];if(headingKey(candidate)===expected){registerHeading(n,offset,label);found=true;break;}}
        if(found)break;offset+=lines[i].trim().split(/\s+/).filter(Boolean).length;
      }
      if(found)break;
    }
  }
  function addPage(data,span){const n=ranges.length;pages[n]=data;data.sourceRanges=span;ranges.push(span);for(const r of span)if(first[r.page]===undefined)first[r.page]=n;return n;}
  function insertPin(pin){
    if(inserted.has(pin.anchor))return;flush();const data=structuredClone(pin.page);data.flowPinned=true;
    pinPages[pin.anchor]=addPage(data,structuredClone(pin.ranges));inserted.add(pin.anchor);
  }
  function flush(){
    let cursor=0,openingLeaf=true;
    while(cursor<tokens.length){
      const opening=openingLeaf?header?.chapterOpening||'':'',prefixWords=opening?opening.trim().split(/\s+/).length:0;
      const draft={...header,body:(opening?opening+'\n':'')+tokens.slice(cursor,cursor+100).filter(t=>!t.continuation).map(t=>t.original||t.word).join(' '),sourcePage:tokens[cursor].source+1};
      const heading=openingLeaf?chapterHeadingLayout(draft,logicalBook):null;
      const top=heading?.bodyTop||profile.top,maxLines=Math.max(1,Math.floor((profile.bottom-top)/leading));
      const lines=[],indents=[],selected=[];
      // Chapter lettering occupies its own region and is never counted as body
      // lines. Keep its original words in the semantic text and source map.
      const headingWords=Math.max(0,(heading?.design.removed||0)-prefixWords);
      for(let n=0;n<headingWords&&cursor<tokens.length;n++)selected.push(tokens[cursor++]);
      while(cursor<tokens.length&&lines.length<maxLines){
        const indent=lines.length&&tokens[cursor].paragraph?size*1.15:0;let used=indent,line=[];
        while(cursor<tokens.length){const t=tokens[cursor],w=measure(t.word);if(line.length&&(t.paragraph||used+space+w>width))break;used+=(line.length?space:0)+w;line.push(t.word);selected.push(t);cursor++;}
        lines.push(line.join(' '));indents.push(indent/scale);
      }
      const span=[];for(const t of selected){let r=span.at(-1);if(!r||r.page!==t.source){r={page:t.source,start:t.offset,end:t.offset+1};span.push(r);}else r.end=t.offset+1;}
      const body=(opening?opening+'\n':'')+selected.filter(t=>!t.continuation).map(t=>t.original||t.word).join(' ');
      const data={novel:true,font:'serif',role:openingLeaf&&header?.role==='section'?'section':'body',tocLabel:openingLeaf?header?.tocLabel:'',title:'',body,readingBody:body,chapterOpening:opening,
        readingLines:lines,readingIndents:indents,readingTop:top,readingSize:size,readingLineHeight:leading,readingFont:font,sourcePage:(span[0]?.page??0)+1,
        paragraphStarts:selected.filter(t=>!t.continuation).map((t,i)=>t.paragraph?i+prefixWords:-1).filter(i=>i>0),flowBoundary:cursor===tokens.length?'section end':heading?'chapter opening':'continuation'};
      addPage(data,span);openingLeaf=false;
    }
    tokens=[];header=null;
  }
  const sourceCount=source.sourcePageCount||base.sourcePageCount||source.pageCount;
  for(let n=0;n<sourceCount;n++){
    const data=structuredClone(source.pages?.[n]||base.pages[n]||{}),kind=classifyBookPage(data,logicalBook);
    const marked=[...(source.edgeBookmarks||[]),...(source.insertMounts||[])].some(m=>m.state?.pageNumber===n);
    const fixed=source.pages?.[n]||['title','contents','illustration','illustration and text','authored','verse','blank','binding padding'].includes(kind)||marked||!data.novel||data.body.trim()===data.chapterOpening;
    if(fixed){
      const pin=pins.find(pin=>pin.ranges[0]?.page===n);if(pin){insertPin(pin);continue;}
      flush();addPage(data,[{page:n,start:0,end:String(data.body||'').trim().split(/\s+/).filter(Boolean).length}]);continue;
    }
    if(chapterOpeningDesign(data,logicalBook)&&!headingOffsets.get(n)?.has(0))registerHeading(n,0,data.chapterOpening||data.tocLabel);
    const words=data.body.trim().split(/\s+/),starts=new Set(data.paragraphStarts||[]);
    if(!data.paragraphStarts){let count=0;for(const paragraph of data.body.trim().split(/\n\s*\n/)){if(count)starts.add(count);count+=paragraph.trim().split(/\s+/).length;}}
    for(let i=0;i<words.length;i++){
      const heading=headingOffsets.get(n)?.get(i);if(heading){flush();header={...data,role:'section',chapterOpening:undefined,tocLabel:heading};headingPages.push({source:n,label:heading,page:ranges.length});}
      const pin=pins.find(pin=>pin.ranges.some(r=>r.page===n&&i>=r.start&&i<r.end));
      if(pin){insertPin(pin);continue;}
      const original=words[i];let remaining=original,continuation=false;
      while(measure(remaining)>width-size*1.15){let chunk='';for(const char of remaining){if(chunk&&measure(chunk+char+'‐')>width-size*1.15)break;chunk+=char;}tokens.push({word:chunk+'‐',original,continuation,source:n,offset:i,paragraph:!continuation&&starts.has(i)});remaining=remaining.slice(chunk.length);continuation=true;}
      tokens.push({word:remaining,original,continuation,source:n,offset:i,paragraph:!continuation&&starts.has(i)});
    }
  }
  flush();
  function destination(target,label){const headings=headingPages.filter(h=>headingKey(h.label)===headingKey(label)).sort((a,b)=>Math.abs(a.source-target)-Math.abs(b.source-target));if(headings.length&&Math.abs(headings[0].source-target)<=2)return headings[0].page;return first[target]??0;}
  for(const data of Object.values(pages))if(data.tocRows)for(const row of data.tocRows){row.target=destination(row.target,row.label);row.folio=String(row.target+1);}
  const count=ranges.length;if(count%2)pages[count]={novel:true,body:'',padding:true};
  const edition={...base,starterId:id,readingEdition:true,layoutVersion:BOOK_LAYOUT_VERSION,layoutKey:key,bodySize:size,profile,font,format:logicalBook.format,pages,ranges,pinPages,firstSourcePage:first,pageCount:Math.ceil(count/2)*2,sourcePageCount:count,
    contents:base.contents?.map(c=>({...c,page:destination(c.page,c.sourceLabel||c.label)}))};
  starterLibrary.set(id,edition);return edition;
}
function rangeAnchor(span){return JSON.stringify(span.map(r=>[r.page,r.start,r.end]));}
function captureFlowPins(source,state,previous){
  const protectedPages=new Set([...Object.keys(state.pages||{}).map(Number),...[...(state.edgeBookmarks||[]),...(state.insertMounts||[])].map(m=>m.state?.pageNumber).filter(n=>Number.isInteger(n)&&n>=0)]);
  const pins=new Map((source.flowPins||[]).map(p=>[p.anchor,p]));
  for(const n of protectedPages){
    const original=previous.pages[n]||{},data={...structuredClone(original),...structuredClone(state.pages?.[n]||{})},span=structuredClone(data.sourceRanges||previous.ranges[n]);if(!span?.length)continue;
    // Legacy maps excluded a prepended chapter heading even though that heading
    // belongs to the protected page's semantic text. Protect its source words too.
    if(original.chapterOpening&&original.body?.startsWith(original.chapterOpening))span[0].start=Math.max(0,span[0].start-original.chapterOpening.trim().split(/\s+/).length);
    const anchor=rangeAnchor(span);pins.set(anchor,{anchor,ranges:span,page:data});
  }
  source.flowPins=[...pins.values()];
}
function ensureReadingEdition(book){
  const key=readingLayoutSpec(book).key,id='reading-'+book.id,current=starterLibrary.get(book.starterId),reading=book.starterId?.startsWith('reading-');
  const state=reading?book:book.readableState;
  if((state?.readingLayoutKey||book.readingLayoutKey)===key){if(!starterLibrary.has(id))buildReadingEdition(book);return false;}
  if(state){
    const previous=starterLibrary.get(state.starterId)?.readingEdition?starterLibrary.get(state.starterId):state.readingLayoutKey?buildReadingEdition({...book,bookFont:JSON.parse(state.readingLayoutKey)[2]}):buildLegacyReadingEdition(book,{store:false});
    captureFlowPins(book.readingSource,state,previous);
    const edition=buildReadingEdition(book);
    const remap=marks=>(marks||[]).map(mark=>{const data=previous.pages[mark.state?.pageNumber],span=data?.sourceRanges||previous.ranges[mark.state?.pageNumber],pin=span&&edition.pinPages[rangeAnchor(span)],target=pin??(span?readingDestination(span[0],edition):mark.state?.pageNumber);return {...structuredClone(mark),state:{...mark.state,pageNumber:target}};});
    const migrated={starterId:edition.starterId,pageCount:edition.pageCount,sourcePageCount:edition.sourcePageCount,pages:{},pageFormat:{mode:'source'},edgeBookmarks:remap(state.edgeBookmarks),insertMounts:remap(state.insertMounts),readingLayoutKey:key};
    if(reading)Object.assign(book,migrated);else book.readableState=migrated;
  }else buildReadingEdition(book);
  book.readingLayoutKey=key;return true;
}
function reflowSelectedReadingFont(){
  const location=sourceLocation(visibleReaderPage());rememberReadingPosition();saveBook(false);const book=savedBooks.find(b=>b.id===activeBookId);if(!book)return;
  ensureReadingEdition(book);localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));openSavedBook(book.id);
  preferredReaderPage=readingDestination(location,starterLibrary.get(bookContent.starterId));spread=Math.floor((preferredReaderPage+1)/2);updateControls();draw();
}
function auditBookLayout(){
  const base=starterLibrary.get(bookContent.starterId),p=document.createElement('canvas').getContext('2d'),report=[];
  for(let n=0;n<readingPageCount();n++){
    const data=bookPage(n),kind=classifyBookPage(data);if(!data.body?.trim()||data.titlePage||data.tocRows){report.push({page:n,kind,intentionalWhitespace:true});continue;}
    const layout=layoutBookBody(data,p),top=layout.top,bottom=data.readingLines||data.playLayout?320:316,fill=(layout.usedHeight??layout.lines.length*layout.lineHeight)/(bottom-top),intentional=!['prose','play dialogue'].includes(kind)||['section end','scene end'].includes(data.flowBoundary);
    report.push({page:n,kind,fill,intentionalWhitespace:intentional,overflow:top+(layout.usedHeight??layout.lines.length*layout.lineHeight)>bottom+.1,underfilled:!intentional&&fill<(base?.profile?.strategy==='play'?.75:.85)});
  }
  return {book:bookName,profile:bookLayoutProfile(bookContent),layoutVersion:base?.layoutVersion,pages:report};
}
