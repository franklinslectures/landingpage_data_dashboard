document.addEventListener("DOMContentLoaded", async ()=>{

const db = window.db;

let pages = [];
let currentPage = 0;
let lastTimestamp = null;
let hasMore = true;

const perPage = 10;

// restore session
let saved = JSON.parse(localStorage.getItem("sb"));
if(!saved){
window.location.href="index.html";
return;
}
await db.auth.setSession(saved);



// logout
logoutBtn.onclick = async ()=>{
localStorage.removeItem("sb");
await db.auth.signOut();
window.location.href="index.html";
};

// glow trigger
[searchInput, searchField, fromDate, toDate].forEach(el=>{
el.oninput = ()=> applyFilter.classList.add("glow");
});

dateFilter.onchange = ()=>{
fromDate.hidden = toDate.hidden = dateFilter.value !== "custom";
applyFilter.classList.add("glow");
};

// IST helpers
function getISTRange(type){

let now = new Date(); // already IST

let start, end;

if(type==="today"){
start = new Date();
start.setHours(0,0,0,0);

end = new Date();
end.setHours(23,59,59,999);
}

if(type==="yesterday"){
let y = new Date();
y.setDate(y.getDate()-1);

start = new Date(y);
start.setHours(0,0,0,0);

end = new Date(y);
end.setHours(23,59,59,999);
}

if(type==="last7"){
let s = new Date();
s.setDate(s.getDate()-6);
s.setHours(0,0,0,0);

let e = new Date();
e.setHours(23,59,59,999);

start = s;
end = e;
}

if(type==="custom"){
if(!fromDate.value || !toDate.value) return null;

let s = new Date(fromDate.value);
let e = new Date(toDate.value);

s.setHours(0,0,0,0);
e.setHours(23,59,59,999);

start = s;
end = e;
}

if(start && end){
return {
start: start.toISOString(),  // convert to UTC here
end: end.toISOString()
};
}

return null;
}

function toIST(date){
return new Date(date);
}

// GROUP FIX
function groupByDate(data){
let groups={};
data.forEach(l=>{
let ist=toIST(l.created_at);
let key=`${ist.getFullYear()}-${ist.getMonth()}-${ist.getDate()}`;
if(!groups[key]) groups[key]=[];
groups[key].push(l);
});
return groups;
}

// SOURCE COLOR (AUTO)
function getSourceColor(str){

let hash = 0;

for(let i = 0; i < str.length; i++){
hash = str.charCodeAt(i) + ((hash << 5) - hash);
}

// generate HSL color
let hue = Math.abs(hash) % 320;

return `hsl(${hue}, 100%, 45%)`;

}

// FORMAT SOURCE
function formatSource(url){
if(!url) return "-";
try{
let u=new URL(url);
return u.pathname.replace(/\//g,'') || u.hostname;
}catch{
return url.slice(0,20);
}
}

// RENDER
function render(data){

let groups=groupByDate(data);
tableBody.innerHTML="";

Object.keys(groups).forEach(key=>{

let date=new Date(key);

let header=document.createElement("tr");
header.className="dateHeader";
header.innerHTML=`<td colspan="7">${date.toDateString()}</td>`;
tableBody.appendChild(header);

groups[key].forEach(r=>{

let ist = toIST(r.created_at);

// FULL URL (for color)
let fullSource = r.source || "";

// DISPLAY TEXT (short)
let displaySource = formatSource(fullSource);

// 🔥 USE FULL URL FOR COLOR
let color = getSourceColor(fullSource);

let row = document.createElement("tr");

row.innerHTML = `
<td>${r.fullname}</td>
<td>${r.mobile}</td>
<td>${r.college}</td>
<td>${r.semester}</td>
<td>${r.department}</td>
<td>
<span class="source" 
style="background:${color}" 
title="${fullSource}">
${displaySource}
</span>
</td>
<td>${ist.toLocaleString('en-IN', {
hour: '2-digit',
minute: '2-digit',
second: '2-digit',
hour12: true
})}</td>
`;

tableBody.appendChild(row);

});

});

updateButtons();
pageInfo.innerText=`Page ${currentPage+1}`;
}

// BUTTON STATE
function updateButtons(){
prevBtn.disabled=currentPage===0;
if(currentPage<pages.length-1){
nextBtn.disabled=false;
}else{
nextBtn.disabled=!hasMore;
}
}

// FETCH
async function fetchNext(){

let query=db.from("leads")
.select("*")
.order("created_at",{ascending:false})
.limit(perPage);

if(lastTimestamp){
query=query.lt("created_at",lastTimestamp);
}

let range=getISTRange(dateFilter.value);

if(range){
query=query.gte("created_at",range.start)
.lte("created_at",range.end);
}

if(searchInput.value){
query=query.ilike(searchField.value,`%${searchInput.value}%`);
}

const {data}=await query;

if(data.length>0){
lastTimestamp=data[data.length-1].created_at;
}

pages.push(data);
currentPage=pages.length-1;
hasMore=data.length===perPage;

render(data);
}

// NAV
nextBtn.onclick=()=>{
if(currentPage<pages.length-1){
currentPage++;
render(pages[currentPage]);
return;
}
if(hasMore) fetchNext();
};

prevBtn.onclick=()=>{
if(currentPage>0){
currentPage--;
render(pages[currentPage]);
}
};

// APPLY
applyFilter.onclick=async ()=>{
applyFilter.classList.remove("glow");
pages=[];
currentPage=0;
lastTimestamp=null;
hasMore=true;
await fetchNext();
};

// INIT
fetchNext();

// EXPORT
exportBtn.onclick=()=>{
let all=pages.flat();
let ws=XLSX.utils.json_to_sheet(all);
let wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,ws,"Leads");
XLSX.writeFile(wb,"leads.xlsx");
};

});