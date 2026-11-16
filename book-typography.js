'use strict';
const chapterDesigns=new Map();
const headingKey=text=>String(text||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function chapterOpeningDesign(data,book=bookContent){
  if(data.titlePage||data.tocRows||!data.body)return null;
  const front=typeof bookLayoutProfile==='function'&&(data.sourcePage||1)===1?bookLayoutProfile(book).frontMatter:null;
  const label=front?.prefix||data.chapterOpening||data.tocLabel;if(!label)return null;
  const words=data.body.trim().split(/\s+/);let count=0,prefix='';
  for(let i=0;i<Math.min(words.length,30);i++){prefix+=(i?' ':'')+words[i];if(headingKey(prefix)===headingKey(label)){count=i+1;break;}if(headingKey(prefix).length>headingKey(label).length+4)break;}
  if(!count)return null;
  let kicker='',title=front?.title||label,subtitle=front?.subtitle||'';
  const numbered=label.match(/^(?:Chapter\s+)?(\d+)\.\s+(.+)$/i);
  if(numbered){kicker='Chapter '+numbered[1];title=numbered[2];}
  const scene=label.match(/^(Scene\s+[IVXLCDM]+)\.\s*(.+)$/i);if(scene){kicker=scene[1];title=scene[2];}
  // The source retains small-cap journal headings that text extraction split
  // into separate tokens. Only classify a confirmed original subtitle.
  const sourceId=book.readingSource?.starterId||book.starterId;
  const source=starterLibrary.get(sourceId)?.pages[(data.sourcePage||1)-1];
  const second=source?.body?.trim().split('\n').map(s=>s.trim()).filter(Boolean)[1];
  if(sourceId==='dracula'&&second&&/JOURNAL|J OURNAL|DIARY|D IARY|LETTER|L ETTER/.test(second)){
    const pieces=second.split(/\s+/);if(words.slice(count,count+pieces.length).join(' ')===pieces.join(' ')){
      count+=pieces.length;subtitle=second.replace(/\b([A-Z])\s+([A-Z]{2,})/g,'$1$2').replace(/\s*([’'])\s*/g,'$1').replace(/\s+/g,' ');
    }
  }
  const matches=[...data.body.matchAll(/\S+/g)],last=matches[count-1];
  let text=data.body.slice(last.index+last[0].length).trim();
  const joinedInitial=/\n[A-Z]\s*\n[a-z]/.test(source?.body||'')&&/^[A-Z]\s+[a-z]/.test(text);if(joinedInitial)text=text.replace(/^([A-Z])\s+([a-z])/,'$1$2');
  return {kicker,title,subtitle,removed:count+(joinedInitial?1:0),text};
}
function chapterHeadingLayout(data,book=bookContent){
  const design=chapterOpeningDesign(data,book);if(!design)return null;
  const key=JSON.stringify([design.kicker,design.title,design.subtitle,book.bookFont||DEFAULT_BOOK_FONT,bookFormatRatio(book),bookFonts.get(book.bookFont||DEFAULT_BOOK_FONT)?.face.status]);
  if(chapterDesigns.has(key))return {...chapterDesigns.get(key),design};
  const p=document.createElement('canvas').getContext('2d');adaptPageTextContext(p,bookFormatRatio(book)/ORIGINAL_PAGE_RATIO);const family=bookFontFamilyFor(book);
  function wrap(text,size,width){p.font=size+'px '+family;const lines=[];let line='';for(const word of text.split(/\s+/)){const next=line?line+' '+word:word;if(line&&p.measureText(next).width>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
  let size=22,lines=wrap(design.title,size,312);while(lines.length>2&&size>18){size--;lines=wrap(design.title,size,312);}
  const top=design.kicker?36:26,lineHeight=size*1.05,subtitleLines=design.subtitle?wrap(design.subtitle,10,300):[];
  const subtitleY=top+lines.length*lineHeight+5,ornamentY=subtitleY+(subtitleLines.length?subtitleLines.length*12+6:0),bodyTop=ornamentY+12;
  const layout={size,lines,top,lineHeight,subtitleLines,subtitleY,ornamentY,bodyTop};
  if(chapterDesigns.size>128)chapterDesigns.clear();chapterDesigns.set(key,layout);return {...layout,design};
}
function printBookOrnament(p,y){
  p.save();p.fillStyle='#8a613b';
  p.fillRect(132,y,48,1);p.fillRect(220,y,48,1);
  for(const [x,dy,w,h] of [[196,-4,8,8],[193,-1,14,2],[199,-7,2,14],[184,-1,3,3],[213,-1,3,3]])p.fillRect(x,y+dy,w,h);
  p.restore();
}
function drawChapterOpening(p,data){
  const layout=chapterHeadingLayout(data);if(!layout)return;
  p.save();p.fillStyle=data.ink||'#302019';p.textAlign='center';p.textBaseline='top';
  if(layout.design.kicker){p.font='11px '+bookFontFamily();p.fillText(layout.design.kicker,200,19);}
  p.font=layout.size+'px '+bookFontFamily();layout.lines.forEach((line,i)=>p.fillText(line,200,layout.top+i*layout.lineHeight));
  p.font='10px '+bookFontFamily();layout.subtitleLines.forEach((line,i)=>p.fillText(line,200,layout.subtitleY+i*12));
  printBookOrnament(p,layout.ornamentY);p.restore();
}
