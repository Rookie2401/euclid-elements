const $ = (id) => document.getElementById(id);
const ROMANS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII'];
const STORAGE = { position:'ecclesia.euclid.position', size:'ecclesia.euclid.size', focus:'ecclesia.euclid.focus', theme:'ecclesia.euclid.theme' };
let books = [], flatUnits = [], currentUnitIndex = 0, currentBookIndex = 0, saveTimer;
const content = $('reader-content'), status = $('status');

function safeText(node, value) { node.textContent = value ?? ''; return node; }
function unitHref(book, unit) { return `#book-${book.number}/${encodeURIComponent(unit.id)}`; }
function sectionKey(unit){return unit.kind==='proposition'?'propositions':unit.kind;}
function unitCount(unit){return (unit.entries||[]).length;}
function propNumber(unit){return unit.id.match(/(?:prop|proposition)[-:]?(\d+)$/i)?.[1]||unit.title?.match(/\d+/)?.[0]||'';}
function unitCountLabel(unit){const n=unitCount(unit),title=displayTitle(unit).toLowerCase();return `${n} ${title==='definitions'?'definitions':title==='postulates'?'postulates':title==='common notions'?'notions':'items'}`;}
function navigationTitle(unit){return sectionKey(unit)==='propositions'?`Proposition ${propNumber(unit)}`:displayTitle(unit);}
function contentsRow(label, meta, href, current=false){
  const a=document.createElement('a');a.className=`contents-link${current?' is-current':''}`;a.href=href;a.textContent=label;
  if(current)a.setAttribute('aria-current','page');
  const count=document.createElement('span');count.className='contents-meta';count.textContent=meta;a.append(count);return a;
}
function buildBookNav() {
  flatUnits=[];const tree=$('contents-tree');tree.replaceChildren();
  books.forEach((book,index)=>{
    const units=book.units||[];units.forEach(unit=>flatUnits.push({book,unit,bookIndex:index}));
    const bookDetails=document.createElement('details');bookDetails.className='contents-group contents-book';bookDetails.dataset.book=String(index);
    const propositionCount=units.filter(u=>sectionKey(u)==='propositions').length;
    const summary=document.createElement('summary');summary.innerHTML=`<span class="tree-chevron" aria-hidden="true"></span><span class="tree-title">Book ${book.roman||ROMANS[index]}</span><span class="contents-meta">${propositionCount} propositions</span>`;bookDetails.append(summary);
    const children=document.createElement('div');children.className='contents-children';
    const prelim=units.filter(u=>sectionKey(u)!=='propositions');
    prelim.forEach(unit=>children.append(contentsRow(displayTitle(unit),unitCountLabel(unit),unitHref(book,unit))));
    const props=units.filter(u=>sectionKey(u)==='propositions');
    if(props.length){
      const group=document.createElement('details');group.className='contents-group contents-propositions';
      const head=document.createElement('summary');head.innerHTML=`<span class="tree-chevron" aria-hidden="true"></span><span class="tree-title">Propositions</span><span class="contents-meta">${props.length}</span>`;group.append(head);
      const list=document.createElement('div');list.className='contents-children contents-proposition-list';
      props.forEach(unit=>list.append(contentsRow(`Proposition ${propNumber(unit)}`,``,unitHref(book,unit))));group.append(list);children.append(group);
    }
    bookDetails.append(children);tree.append(bookDetails);
  });
}
function syncNavigation(bookIndex, unit) {
  const book=books[bookIndex],title=navigationTitle(unit);$('contents-current').textContent=`Book ${book.roman||ROMANS[bookIndex]} · ${title}`;
  const disclosure=$('contents-disclosure');
  document.querySelectorAll('.contents-link').forEach(a=>{const active=a.getAttribute('href')===unitHref(book,unit);a.classList.toggle('is-current',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.querySelectorAll('.contents-book').forEach(d=>{d.classList.toggle('is-current',Number(d.dataset.book)===bookIndex);});
  const activeBook=document.querySelector(`.contents-book[data-book="${bookIndex}"]`);if(activeBook)activeBook.open=true;
  const propGroup=activeBook?.querySelector('.contents-propositions');if(propGroup)propGroup.open=sectionKey(unit)==='propositions';
  disclosure.setAttribute('aria-label',`Contents, current location Book ${book.roman||ROMANS[bookIndex]}, ${title}`);
}
function activateWordMarkup(paragraph, text, unitTitle) {
  // Keep the transcription as text nodes. Greek words become small buttons for dictionary hooks.
  const source = String(text ?? '');
  const chunks = source.match(/[\p{Script=Greek}\p{M}]+(?:[’'ʼ][\p{Script=Greek}\p{M}]+)?[’'ʼ]?|[^\p{Script=Greek}\p{M}]+/gu) || [source];
  let sourceOffset = 0;
  for (const chunk of chunks) {
    if (/\p{Script=Greek}/u.test(chunk)) {
      const button=document.createElement('button'); button.className='greek-word'; button.type='button'; button.dataset.word=chunk;
      button.textContent=chunk; button.setAttribute('aria-label',`Look up ${chunk}`);
      const start=source.indexOf(chunk,sourceOffset); sourceOffset=Math.max(sourceOffset,start)+chunk.length;
      button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('euclid:word',{detail:{word:chunk,context:{sentence:source,start,end:start+chunk.length,reference:unitTitle},element:button}})));
      paragraph.append(button);
    } else { paragraph.append(document.createTextNode(chunk)); sourceOffset+=chunk.length; }
  }
}
function displayTitle(unit) { return unit.title || (unit.kind === 'definitions' ? 'Definitions' : unit.kind === 'postulates' ? 'Postulates' : unit.kind === 'common-notions' ? 'Common Notions' : 'Propositions'); }
function renderUnit(index, {updateHash=true, scroll=true}={}) {
  if (!flatUnits.length) return;
  index = Math.max(0, Math.min(flatUnits.length - 1, index)); currentUnitIndex=index;
  const {book,unit,bookIndex}=flatUnits[index]; currentBookIndex=bookIndex;
  $('crumb-book').textContent=`Book ${book.roman || ROMANS[bookIndex]}`;$('progress-bar').style.width=`${((index+1)/flatUnits.length*100).toFixed(2)}%`;
  syncNavigation(bookIndex,unit);
  content.replaceChildren();
  const firstOfBook=(book.units || [])[0]===unit;
  if(firstOfBook){
    const intro=document.createElement('header'); intro.className='book-intro';
    const kicker=document.createElement('div'); kicker.className='section-kicker'; safeText(kicker,'Euclid · Greek text');
    const h=document.createElement('h1'); safeText(h,`Book ${book.roman || ROMANS[bookIndex]}`);
    const sub=document.createElement('p'); sub.className='book-subtitle'; safeText(sub,book.title || 'The Elements'); intro.append(kicker,h,sub); content.append(intro);
  }
  const section=document.createElement('section'); section.className='units';
  const heading=document.createElement('h2'); heading.className='unit-heading';
  const headingText=document.createElement('span'); safeText(headingText,navigationTitle(unit)); heading.append(headingText);
  const editorial=document.createElement('span'); editorial.className='editorial-mark'; safeText(editorial,'ED.'); heading.append(editorial); section.append(heading);
  for (const diagram of unit.diagrams || []) {
    const wrap=document.createElement('div'); wrap.className='diagram-wrap'; wrap.setAttribute('role','button'); wrap.tabIndex=0; wrap.setAttribute('aria-label',`Enlarge diagram: ${diagram.alt || 'geometric diagram'}`);
    const img=document.createElement('img'); img.src=new URL(`./${diagram.src}`,document.baseURI).href; img.alt=diagram.alt || 'Geometric diagram from Heiberg’s edition'; img.loading='lazy';
    img.addEventListener('error',()=>{wrap.replaceChildren(); wrap.className='diagram-wrap diagram-missing'; wrap.removeAttribute('role'); wrap.removeAttribute('tabindex'); safeText(wrap,'Diagram image unavailable.');});
    const caption=document.createElement('p'); caption.className='diagram-caption'; safeText(caption,diagram.citation || diagram.alt || 'Heiberg, Elements'); wrap.append(img,caption);
    const enlarge=()=>{ $('large-diagram').src=img.src; $('large-diagram').alt=img.alt; $('diagram-caption').textContent=caption.textContent; $('diagram-dialog').showModal(); };
    wrap.addEventListener('click',enlarge); wrap.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enlarge();}}); section.append(wrap);
  }
  (unit.entries || []).forEach(entry=>{
    const article=document.createElement('article'); article.className='entry'; article.id=entry.id;
    const h=document.createElement('h3'); safeText(h,entry.title || ''); article.append(h);
    (entry.paragraphs || []).forEach(text=>{const p=document.createElement('p'); activateWordMarkup(p,text,`Book ${book.roman || ROMANS[bookIndex]} · ${displayTitle(unit)}`); article.append(p);});
    section.append(article);
  });
  content.append(section); content.hidden=false; status.hidden=true;
  const pager=$('page-nav'); pager.hidden=false; pager.replaceChildren();
  if(index>0){const prev=flatUnits[index-1],a=document.createElement('a');a.href=unitHref(prev.book,prev.unit);a.innerHTML=`<small>‹ Previous</small>${escapeHTML(navigationTitle(prev.unit))}`;a.className='previous';pager.append(a);}
  if(index<flatUnits.length-1){const next=flatUnits[index+1],a=document.createElement('a');a.href=unitHref(next.book,next.unit);a.innerHTML=`<small>Next ›</small>${escapeHTML(navigationTitle(next.unit))}`;a.className='next';pager.append(a);}
  if(updateHash){const hash=unitHref(book,unit); if(location.hash!==hash) history.replaceState(null,'',hash);}
  if(scroll) window.scrollTo({top:0,behavior:'smooth'});
  clearTimeout(saveTimer); saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE.position,JSON.stringify({book:book.number,unit:unit.id,title:`Book ${book.roman || ROMANS[bookIndex]} · ${displayTitle(unit)}`}));}catch{}},350);
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function route(){const hash=decodeURIComponent(location.hash.slice(1));const match=hash.match(/^book-(\d+)(?:\/(.+))?$/);if(!match){renderUnit(0,{updateHash:true,scroll:true});return;}const bookIndex=Math.max(0,books.findIndex(b=>String(b.number)===match[1]));let index=flatUnits.findIndex(x=>x.bookIndex===bookIndex && x.unit.id===match[2]);if(index<0)index=flatUnits.findIndex(x=>x.bookIndex===bookIndex);renderUnit(index<0?0:index,{updateHash:false,scroll:true});}
function openDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();}
function restorePreferences(){try{const size=Number(localStorage.getItem(STORAGE.size));if(size>=1.15&&size<=2.05)document.documentElement.style.setProperty('--greek-size',`${size}rem`);if(localStorage.getItem(STORAGE.focus)==='1')setFocus(true);}catch{}}
function setFocus(on){document.body.classList.toggle('focus-mode',on);$('focus-toggle').setAttribute('aria-pressed',String(on));try{localStorage.setItem(STORAGE.focus,on?'1':'0');}catch{}}
$('font-down').addEventListener('click',()=>changeFont(-.1)); $('font-up').addEventListener('click',()=>changeFont(.1));
function changeFont(delta){const current=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--greek-size'))||1.28;const size=Math.min(2.05,Math.max(1.15,Math.round((current+delta)*100)/100));document.documentElement.style.setProperty('--greek-size',`${size}rem`);try{localStorage.setItem(STORAGE.size,String(size));}catch{}}
$('focus-toggle').addEventListener('click',()=>setFocus(!$('focus-toggle').matches('[aria-pressed="true"]')));
$('about-open').addEventListener('click',()=>openDialog('about-dialog'));
function setTheme(dark){document.documentElement.classList.toggle('dark',dark);const b=$('theme-toggle');b.setAttribute('aria-pressed',String(dark));b.setAttribute('aria-label',dark?'Light reading':'Dark reading');document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#211e1a':'#f1e8d7');try{localStorage.setItem(STORAGE.theme,dark?'dark':'light');}catch{}}
setTheme(document.documentElement.classList.contains('dark'));
$('theme-toggle').addEventListener('click',()=>setTheme(!document.documentElement.classList.contains('dark')));
$('contents-tree').addEventListener('click',e=>{const a=e.target.closest('a.contents-link');if(!a)return;e.preventDefault();$('contents-disclosure').open=false;location.hash=a.getAttribute('href').slice(1);});
$('contents-disclosure').addEventListener('keydown',e=>{if(e.key==='Escape'&&$('contents-disclosure').open){e.preventDefault();$('contents-disclosure').open=false;$('contents-summary').focus();}});
$('page-nav').addEventListener('click',e=>{const a=e.target.closest('a');if(a){e.preventDefault();location.hash=a.getAttribute('href').slice(1);}});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||$('contents-disclosure').open||e.altKey||e.ctrlKey||e.metaKey||e.target.matches('input,textarea,select,button'))return;if(e.key==='ArrowLeft'&&currentUnitIndex>0)location.hash=unitHref(flatUnits[currentUnitIndex-1].book,flatUnits[currentUnitIndex-1].unit).slice(1);if(e.key==='ArrowRight'&&currentUnitIndex<flatUnits.length-1)location.hash=unitHref(flatUnits[currentUnitIndex+1].book,flatUnits[currentUnitIndex+1].unit).slice(1);});
window.addEventListener('hashchange',route);
restorePreferences();
try{const module=await import('./golearn.js?v=biblia-golearn-3');if(module.initGoLearn)await module.initGoLearn({wordEvent:'euclid:word',accountButton:$('account-open'),savedButton:$('saved-open')});}catch(error){console.info('GoLearn account and word tools are not available yet.',error);}
try{
  const response=await fetch('./data/elements.json'); if(!response.ok)throw new Error(`The text file returned ${response.status}.`);
  const data=await response.json(); books=data.books||[];if(!books.length)throw new Error('No books were found in the text file.');buildBookNav();restorePreferences();
  if(location.hash)route();else{let previous;try{previous=JSON.parse(localStorage.getItem(STORAGE.position)||'null');}catch{}const idx=previous?flatUnits.findIndex(x=>String(x.book.number)===String(previous.book)&&x.unit.id===previous.unit):-1;renderUnit(idx>=0?idx:0,{updateHash:true,scroll:false});}
}catch(error){status.classList.add('error');status.textContent='The Greek text could not be opened. Please refresh the page, or check that the Elements data file is available.';console.error(error);}
