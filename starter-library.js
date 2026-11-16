'use strict';
// Read-only bundled text stays outside localStorage. Only user edits/copies are
// saved there, so full novels don't consume the browser's shelf quota.
const starterLibrary=new Map();
const bundledBodySizes=new Map();
const sourceIllustrations=new Map();
let sourceInkTreatments={};
function refineSourceFigure(figure){
  if(figure.recipe?.version===3)return figure;
  const upgrade=sourceInkTreatments[figure.originalSrc||figure.src];if(!upgrade)return figure;
  const useOriginal=!!figure.originalSrc&&figure.src===figure.originalSrc;
  Object.assign(figure,upgrade,{src:useOriginal?upgrade.originalSrc:upgrade.processedSrc});return figure;
}
async function loadStarterLibrary(){
  const urls=['assets/book-designs.json?v=2','assets/book-illustration-treatments.json?v=1','assets/book-composition.json?v=1','assets/starter-novels.json?v=2','assets/classic-library.json?v=1','assets/inferno-dore.json?v=1'];
  const [designs,treatments,compositions,...collections]=await Promise.all(urls.map(async url=>{const response=await fetch(url);if(!response.ok)throw Error('Library asset unavailable: '+url);return response.json();}));
  sourceInkTreatments=treatments;
  const novels=collections.flat(),p=document.createElement('canvas').getContext('2d');
  p.font='12px Georgia';
  for(const novel of novels){
    if(novel.design)designs[novel.id]=novel.design;
    // Legacy repagination measures every word in entire novels. Only build
    // it when an existing edited edition or bookmark actually needs it.
    const needsLegacy=[...savedBooks,bookContent].some(book=>book.starterId===novel.id+'-legacy'||book.starterId===novel.id&&book.edition!==2&&(Object.keys(book.pages||{}).length||(book.edgeBookmarks||[]).length));
    const leaves=[],chapters=[],pages={};let lastChapter='';
    for(const [index,text] of novel.textPages.entries()){
      const marker=novel.chapters?.find(chapter=>chapter.page===index);
      const heading=!novel.chapters&&text.match(/(?:^|\n)[ \t]*(?:CHAPTER|Chapter)[ \t]+([IVXLCDM]+|\d+)[ \t]*(?:\n|$)/);
      const section=heading&&heading[1]!==lastChapter;
      if(section){chapters.push({index:leaves.length,page:index,title:'Chapter '+heading[1]});lastChapter=heading[1];}
      pages[index]={role:marker||section?'section':'body',tocLabel:marker?.title||(section?'Chapter '+heading[1]:''),novel:true,preserveLines:!!novel.preserveLines,font:'serif',title:'',eyebrow:novel.name,body:text,sourcePage:index+1};
      if(novel.chapters||!needsLegacy)continue;
      if(!text)continue;
      let lines=[],line='';
      for(const word of text.split(/\s+/)){
        const next=line?line+' '+word:word;
        if(line&&p.measureText(next).width>304){lines.push(line);line=word;}else line=next;
      }
      if(line)lines.push(line);
      for(let i=0;i<lines.length;i+=18)leaves.push(lines.slice(i,i+18).join('\n'));
    }
    const common={name:novel.name,covers:{front:{title:novel.name,font:'serif'},back:{}},palette:{outside:novel.outside,inside:'#b59b62',metal:'gold'}};
    const pageCount=Math.ceil(novel.sourcePages/2)*2;
    if(pageCount>novel.sourcePages)pages[novel.sourcePages]={role:'body',novel:true,font:'serif',body:'',title:'',padding:true};
    starterLibrary.set(novel.id,{...common,id:'starter-'+novel.id,starterId:novel.id,edition:2,pageCount,sourcePageCount:novel.sourcePages,pages});
    const design=designs[novel.id];
    if(design){
      starterLibrary.get(novel.id).format=design.format;
      if(design.contents.length)starterLibrary.get(novel.id).contents=design.contents;
      for(const [number,data] of Object.entries(design.pages))Object.assign(pages[number],data);
    }
    for(const [number,data] of Object.entries(compositions[novel.id]?.pages||{}))if(pages[number])Object.assign(pages[number],data);
    for(const page of Object.values(pages))for(const figure of page.sourceFigures||[])refineSourceFigure(figure);
    if(novel.chapters||!needsLegacy)continue;
    // Preserve the former base text for any edits/bookmarks on old numbering.
    const old={},tocPages=Math.max(1,Math.ceil(chapters.length/9)),start=1+tocPages;
    old[0]={role:'title',title:novel.name+'\n'+novel.author,font:'serif',body:'',eyebrow:''};
    for(let i=1;i<=tocPages;i++)old[i]={role:'contents',font:'serif'};
    leaves.forEach((body,i)=>old[start+i]={role:'body',novel:true,font:'serif',title:'',eyebrow:novel.name,body});
    for(const chapter of chapters)Object.assign(old[start+chapter.index],{role:'section',tocLabel:chapter.title});
    let count=start+leaves.length;if(count%2)old[count++]={role:'body',novel:true,body:'',title:''};
    starterLibrary.set(novel.id+'-legacy',{...common,starterId:novel.id+'-legacy',edition:1,pageCount:count,pages:old,legacy:true});
  }
  // Illustrations decode when their page is requested, not before the shelf
  // can be shown. getSourceIllustration invalidates the viewport on arrival.
}
function getSourceIllustration(src){
  let image=sourceIllustrations.get(src);
  if(!image){image=new Image();sourceIllustrations.set(src,image);image.onload=()=>{const numbers=[spread*2-1,spread*2,...(motion?[turnDestination()*2-1,turnDestination()*2]:[])];if(!bookShelfMode&&numbers.some(n=>(bookPage(n).sourceFigures||[]).some(f=>f.src===src))){textures.clear();shadedTextures.clear();draw();if(typeof refreshWorkshopPreview==='function')refreshWorkshopPreview();}};image.src=src;}
  return image.complete&&image.naturalWidth?image:null;
}
function migrateStarterEditions(){
  let changed=false;
  for(const book of [...savedBooks]){
    const current=starterLibrary.get(book.starterId);if(!current||current.legacy||book.edition===2)continue;
    const active=activeBookId===book.id,edits=active?bookContent.pages:book.pages,marks=active?bookContent.edgeBookmarks:book.edgeBookmarks;
    if(active){book.palette=structuredClone(bookContent.palette);book.covers=structuredClone(bookContent.covers);book.name=bookContent.name;}
    if(Object.keys(edits||{}).length||(marks||[]).length)savedBooks.push({...structuredClone(book),id:crypto.randomUUID(),name:book.name+' (previous pagination)',starterId:book.starterId+'-legacy',pages:structuredClone(edits||{}),edgeBookmarks:structuredClone(marks||[])});
    Object.assign(book,{edition:2,pageCount:current.pageCount,sourcePageCount:current.sourcePageCount,pages:{},edgeBookmarks:[]});changed=true;
    if(active){Object.assign(bookContent,{edition:2,pageCount:current.pageCount,sourcePageCount:current.sourcePageCount,pages:{},edgeBookmarks:[]});pageCount=current.pageCount;}
  }
  if(changed){localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));persistBookContent();}
}
