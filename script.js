'use strict';
const KEY='studypulse_v1',PRI=
{
    Low:0,Medium:5,High:10,Critical:15
}
,PW=
{
    Low:0,Medium:10,High:20,Critical:35
}
,$=id=>document.getElementById(id);
const DEF=()=>(
{
    v:2,tasks:[],exams:[],sessions:[],assess:[],well:[],dismissed:[],xp:[],seen:null,set:
    {
        cap:3,collide:3,idle:3,target:75,water:8,sleep:8,goal:2,notify:true
    }
}
);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const pad=n=>String(n).padStart(2,'0'),dk=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>dk(new Date()),addDays=n=>
{
    const d=new Date();
    d.setDate(d.getDate()+n);
    return dk(d)
}
,ld=iso=>dk(new Date(iso));
const daysUntil=s=>Math.round((new Date(s+'T00:00')-new Date(today()+'T00:00'))/864e5);
const fmt=s=>new Date(s.length>10?s:s+'T00:00').toLocaleString([],s.length>10?
{
    dateStyle:'medium',timeStyle:'short'
}
:
{
    dateStyle:'medium'
}
);
const r1=n=>Math.round(n*10)/10,num=id=>parseFloat($(id).value);
const h=(t,a,...c)=>
{
    const e=document.createElement(t);
    for(const k in a||
    {
    }
    )
    {
        k==='class'?e.className=a[k]:k.startsWith('on')?e.addEventListener(k.slice(2),a[k]):e.setAttribute(k,a[k])
    }
    c.flat(9).filter(x=>x!=null&&x!==false).forEach(x=>e.append(x instanceof Node?x:document.createTextNode(x)));
    return e
}
;
const put=(el,...c)=>el.replaceChildren(...c.flat(9).filter(x=>x!=null&&x!==false));
const toast=(m,k)=>
{
    const t=h('div',
    {
        class:'toast '+(k||'')
    }
    ,m);
    $('toasts').append(t);
    setTimeout(()=>t.remove(),3400)
}
;
const empty=m=>h('div',
{
    class:'empty'
}
,m);
let S=DEF();
function migrate()
{
    S.tasks.forEach(t=>
    {
        t.cat=t.cat||'Study';
        t.time=t.time||'';
        t.notes=t.notes||'';
        if(!(t.pri in PRI))t.pri='Medium';
        if(t.status==='Completed'&&!t.doneAt)
        {
            t.doneAt=new Date(t.upd||Date.now()).toISOString();
            t.onTime=ld(t.doneAt)<=t.due;
            t.actual=null;
            if(!S.xp.some(x=>x.id==='task:'+t.id))S.xp.push(
            {
                id:'task:'+t.id,amt:t.onTime?10:3,why:'Migrated: '+t.title,at:t.doneAt
            }
            )
        }
    }
    );
    if(!S.exMig)
    {
        S.exams.forEach(x=>
        {
            if(!x.prep&&x.date)S.tasks.push(
            {
                id:'ex'+x.id,title:'Exam prep: '+x.name,subj:x.subj,due:x.date.slice(0,10),time:x.date.slice(11,16),est:x.hrs,done:0,pri:'High',status:'Pending',notes:x.notes||'',cat:'Exam',created:today(),upd:Date.now()
            }
            )
        }
        );
        S.exMig=true
    }
    S.v=2
}
function norm(r)
{
    const d=DEF();
    const s=
    {
        ...d,...r,set:
        {
            ...d.set,...(r.set||
            {
            }
            )
        }
    }
    ;
    ['tasks','exams','sessions','assess','well','dismissed','xp'].forEach(k=>
    {
        if(!Array.isArray(s[k]))s[k]=[]
    }
    );
    return s
}
function load()
{
    try
    {
        const r=JSON.parse(localStorage.getItem(KEY));
        if(r&&typeof r==='object')S=norm(r)
    } catch(e)
    {
        S=DEF();
        setTimeout(()=>toast('Saved data could not be read. Starting fresh; import a backup if you have one.','err'),300)
    }
    migrate()
}
function save()
{
    try
    {
        localStorage.setItem(KEY,JSON.stringify(S))
    } catch(e)
    {
        toast('Could not save (storage full or blocked). Export a backup.','err')
    }
}
const commit=()=>
{
    checkBadges();
    save();
    render()
}
;
const open=()=>S.tasks.filter(t=>t.status!=='Completed'&&!t.archived),rem=t=>Math.max(0,t.est-t.done);
const dueAt=t=>new Date(t.due+'T'+(t.time||'23:59')),isOver=t=>dueAt(t)<new Date();
function urgency(t)
{
    const d=daysUntil(t.due);
    return isOver(t)?'Overdue':d===0?'Due today':d<=2?'Urgent':'Upcoming'
}
function when(t)
{
    const d=daysUntil(t.due);
    return isOver(t)&&d>=0?'past due time':d<0?`overdue by ${-d} day${d<-1?'s':''}`:d===0?'due today':d===1?'due tomorrow':`due in ${d} days`
}
function score(t)
{
    const d=daysUntil(t.due),u=isOver(t)?100:d===0?80:d<=2?60:Math.max(0,20-d);
    return u+PW[t.pri]+(t.status==='In Progress'?5:0)+Math.min(rem(t),5)
}
const ranked=()=>open().sort((a,b)=>score(b)-score(a)||a.due.localeCompare(b.due));
function collisions()
{
    const m=
    {
    }
    ;
    open().forEach(t=>(m[t.due]=m[t.due]||[]).push(t));
    return Object.entries(m).filter(([,a])=>a.length>=S.set.collide)
}
function workload()
{
    const items=open().filter(t=>daysUntil(t.due)<=6&&rem(t)>0).map(t=>(
    {
        n:t.title,h:rem(t)
    }
    )),req=items.reduce((a,i)=>a+i.h,0),avail=S.set.cap*7;
    return {
        items,req,avail,pct:avail>0?req/avail*100:null
    }
}
function alerts()
{
    const a=[],T=today();
    open().forEach(t=>
    {
        const u=urgency(t);
        if(u==='Overdue')a.push(
        {
            id:'od:'+t.id,k:'bad',m:`Overdue: ${t.title} (${when(t)})`
        }
        ); else if(u==='Due today'||u==='Urgent')a.push(
        {
            id:'due:'+t.id+T,k:'warn',m:`${u}: ${t.title} (${when(t)})`
        }
        );
        const idle=(Date.now()-(t.upd||Date.now()))/864e5;
        if(idle>=S.set.idle)a.push(
        {
            id:'idle:'+t.id+T,k:'warn',m:`No update for ${Math.floor(idle)} days: ${t.title}`
        }
        )
    }
    );
    collisions().forEach(([d,l])=>a.push(
    {
        id:'col:'+d,k:'warn',m:`Deadline collision on ${fmt(d)}: ${l.map(t=>t.title).join(', ')}.`
    }
    ));
    return a.filter(x=>!S.dismissed.includes(x.id))
}
const xpT=()=>S.xp.reduce((a,x)=>a+x.amt,0),lvl=x=>Math.floor((1+Math.sqrt(1+x/12.5))/2),thr=n=>50*n*(n-1);
function award(id,amt,why)
{
    if(S.xp.some(x=>x.id===id))return false;
    S.xp.push(
    {
        id,amt,why,at:new Date().toISOString()
    }
    );
    if(S.set.notify!==false)toast(`+${amt} XP · ${why}`,'gold');
    return true
}
function streaks()
{
    const ds=[...new Set(S.tasks.filter(t=>t.doneAt).map(t=>ld(t.doneAt)))].sort();
    let best=0,run=0,prev=null;
    ds.forEach(d=>
    {
        run=prev&&daysUntil(d)-daysUntil(prev)===1?run+1:1;
        best=Math.max(best,run);
        prev=d
    }
    );
    let c=0,d=ds.includes(today())?0:-1;
    while(ds.includes(addDays(d)))
    {
        c++;
        d--
    }
    return {
        cur:c,best,ds
    }
}
function stats()
{
    const D=S.tasks.filter(t=>t.doneAt),on=D.filter(t=>t.onTime).length,xp=xpT(),L=lvl(xp),sk=streaks(),perDay=d=>D.filter(t=>ld(t.doneAt)===d).length;
    return {
        D,on,late:D.length-on,pct:D.length?Math.round(on/D.length*100):null,sk,xp,L,base:thr(L),next:thr(L+1),perDay,today:perDay(today()),od:open().filter(isOver).length
    }
}
const badges=st=>[['First step','Complete 1 task',st.D.length,1],['Getting going','Complete 10 tasks',st.D.length,10],['Habit','Reach a 3-day streak',st.sk.best,3],['Week strong','Reach a 7-day streak',st.sk.best,7],['Punctual','Finish 5 tasks on time',st.on,5],['Level 5','Reach level 5',st.L,5]].map(([n,d,c,t],i)=>(
{
    n,d,c,t,i:['🚀','📚','🔥','🏆','⏱️','💎'][i],ok:c>=t
}
));
function complete(t)
{
    if(t.status==='Completed')return;
    const L0=lvl(xpT()),now=new Date();
    t.status='Completed';
    t.done=t.est;
    t.upd=Date.now();
    if(!t.doneAt)
    {
        t.doneAt=now.toISOString();
        t.onTime=now<=dueAt(t);
        t.dueSnap=t.due+(t.time?' '+t.time:'');
        t.actual=t.startedAt?Math.max(1,Math.round((now-t.startedAt)/6e4)):null;
        award('task:'+t.id,t.onTime?10+PRI[t.pri]:3,t.onTime?'On time':'Finished late')
    } else toast('Marked complete. XP for this task was already earned.');
    if(S.tasks.filter(x=>x.doneAt&&ld(x.doneAt)===today()).length>=S.set.goal)award('goal:'+today(),20,'Daily goal met');
    const L1=lvl(xpT());
    if(L1>L0)
    {
        toast(`Level up! You reached level ${L1} 🎉`,'gold');
        confetti()
    }
    commit()
}
function confetti()
{
    if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    const cs=['#4893C6','#8DBEDC','#B7D7EA','#64A4CE','#fff'];
    for(let i=0;
    i<36;
    i++)
    {
        const s=h('span',
        {
            class:'cf',style:`left:${30+Math.random()*40}%;top:35%;background:${cs[i%5]};--x:${(Math.random()-.5)*500}px;--y:${160+Math.random()*320}px;--r:${Math.random()*720}deg`
        }
        );
        document.body.append(s);
        setTimeout(()=>s.remove(),1700)
    }
}
function checkBadges()
{
    const ok=badges(stats()).filter(b=>b.ok).map(b=>b.n);
    if(!S.seen)
    {
        S.seen=ok;
        return
    }
    ok.filter(n=>!S.seen.includes(n)).forEach(n=>
    {
        S.seen.push(n);
        toast('🏆 Achievement unlocked: '+n,'gold');
        confetti()
    }
    )
}
const PAGES=['dashboard','planner','history','progress','wellness'];
const last=n=>Array.from(
{
    length:n
}
,(_,i)=>addDays(i-n+1)),dl=s=>new Date(s+'T00:00').toLocaleDateString([],
{
    weekday:'short'
}
);
function bars(el,labels,vals,unit,max)
{
    put(el,vals.map((v,i)=>h('div',
    {
        class:'bar1'
    }
    ,h('span',
    {
    }
    ,v?r1(v)+unit:''),h('i',
    {
        style:`height:${Math.max(3,v/Math.max(max,1)*85)}%`
    }
    ),h('span',
    {
    }
    ,labels[i]))));
    el.setAttribute('role','img');
    el.setAttribute('aria-label',labels.map((l,i)=>`${l}: ${r1(vals[i])}${unit}`).join(', '))
}
let selDay=null,per=7;
const QUOTES=['Small steps every day add up to big results.','Focus on progress, not perfection.','Finish one thing, then the next.','Consistency beats intensity.','Future you will thank you for starting today.','Rest is part of the plan.','You only have to be present, not perfect.'];
const go=(hash,f)=>
{
    if(f!=null)
    {
        $('hf').value=f;
        renderHistory()
    }
    location.hash=hash
}
;
function renderDash()
{
    const st=stats(),hr=new Date().getHours(),A=alerts(),op=open(),T=new Date();
    $('hDate').textContent=T.toLocaleDateString([],
    {
        weekday:'long',month:'long',day:'numeric'
    }
    );
    $('greet').textContent=`${hr<12?'Good morning':hr<17?'Good afternoon':'Good evening'}!`;
    $('quote').textContent=QUOTES[(T.getDate()+T.getMonth())%QUOTES.length]+(op.length?` You have ${op.length} open task${op.length>1?'s':''}${st.od?`, $
    {
        st.od
    }
    overdue`:''}.`:' Nothing pending, so it is a good time to plan ahead.');
    requestAnimationFrame(()=>$('rf').style.strokeDashoffset=402*(1-(st.xp-st.base)/(st.next-st.base)));
    put($('lvText'),h('b',
    {
    }
    ,'Lv '+st.L),h('span',
    {
    }
    ,`${st.next-st.xp} XP to go`));
    $('xpChip').textContent=`⚡ ${st.xp} XP · Lv ${st.L}`;
    put($('streak'),h('div',
    {
        class:'flame'
    }
    ,'🔥 ',h('b',
    {
    }
    ,st.sk.cur),' day streak'),h('div',
    {
        class:'dots7'
    }
    ,last(7).map(d=>
    {
        const n=st.perDay(d);
        return h('button',
        {
            class:'sd'+(n?' on':''),'aria-label':`${dl(d)}: ${n} completed`,onclick:()=>toast(`${dl(d)}: ${n} task${n===1?'':'s'} completed`)
        }
        ,n?'✓':dl(d)[0])
    }
    )));
    const sx=(n,l,hash,f)=>h('button',
    {
        class:'sx',onclick:()=>go(hash,f)
    }
    ,h('b',
    {
    }
    ,n),h('span',
    {
    }
    ,l));
    put($('stats'),sx(st.xp,'Total XP','#progress'),sx(st.sk.best+' d','Longest streak','#progress'),sx(st.D.length,'Completed','#history','completed'),sx(op.length,'Pending','#history','pending'),sx(st.od,'Overdue','#history','overdue'),sx(st.pct==null?'–':st.pct+'%','On time','#history','ontime'));
    put($('prio'),ranked().slice(0,5).map(t=>h('div',
    {
        class:'task p-'+t.pri
    }
    ,h('details',
    {
    }
    ,h('summary',
    {
    }
    ,h('b',
    {
    }
    ,t.title),h('div',
    {
        class:'hint'
    }
    ,`${t.subj} · ${when(t)}`)),h('div',
    {
        class:'hint'
    }
    ,`${t.cat} · ${t.pri} priority · ${r1(rem(t))} h left`+(t.notes?' · '+t.notes:''))),h('button',
    {
        class:'chk','aria-label':'Complete '+t.title,onclick:ev=>
        {
            ev.currentTarget.closest('.task').classList.add('fin');
            setTimeout(()=>complete(t),420)
        }
    }
    ,'✓'))),op.length?null:empty('All clear. Add a task to plan your day.'));
    const cont=op.filter(t=>t.status==='In Progress'||t.done>0);
    put($('cont'),cont.length?cont.slice(0,3).map(t=>h('div',
    {
        class:'task p-'+t.pri
    }
    ,h('div',
    {
        class:'grow'
    }
    ,h('b',
    {
    }
    ,t.title),h('div',
    {
        class:'hint'
    }
    ,`${r1(t.done)} of ${r1(t.est)} h · ${when(t)}`),h('div',
    {
        class:'meter'
    }
    ,h('i',
    {
        style:`width:${Math.min(100,t.done/t.est*100)}%`
    }
    ))),h('button',
    {
        class:'btn ghost sm',onclick:()=>
        {
            t.done=Math.min(t.est,t.done+.5);
            t.upd=Date.now();
            toast('Logged 30 minutes.');
            commit()
        }
    }
    ,'+30 min'))):empty('Press Start on a task in Smart Planner and it will show up here.'));
    put($('upc'),[...op].sort((a,b)=>dueAt(a)-dueAt(b)).slice(0,6).map(t=>h('div',
    {
        class:'tli '+(isOver(t)?'bad':daysUntil(t.due)<=2?'warn':'')
    }
    ,h('b',
    {
    }
    ,t.title),h('span',
    {
        class:'hint'
    }
    ,fmt(t.due+(t.time?'T'+t.time:''))+' · '+when(t)))),op.length?null:empty('No upcoming deadlines.'));
    put($('alerts'),A.length?A.map(a=>h('div',
    {
        class:'row-i '+a.k
    }
    ,h('span',
    {
        class:'grow'
    }
    ,a.m),h('button',
    {
        class:'btn ghost sm',onclick:()=>
        {
            S.dismissed.push(a.id);
            commit()
        }
    }
    ,'Dismiss'))):empty('No alerts right now.'));
    const dN=last(per),vals=dN.map(st.perDay),mx=Math.max(S.set.goal,...vals);
    put($('weekBars'),dN.map((d,i)=>h('button',
    {
        class:'cb'+(selDay===d?' sel':''),'data-tip':`${fmt(d)}: ${vals[i]} done`,'aria-label':`${fmt(d)}: ${vals[i]} completed`,onclick:()=>
        {
            selDay=selDay===d?null:d;
            renderDash()
        }
    }
    ,h('i',
    {
        style:`height:${Math.max(4,vals[i]/mx*100)}%`
    }
    ),h('span',
    {
    }
    ,per>14?(i%5===0?d.slice(8):''):per>7?d.slice(8):dl(d)))));
    const dd=selDay&&S.tasks.filter(t=>t.doneAt&&ld(t.doneAt)===selDay);
    put($('dayList'),selDay?[h('b',
    {
    }
    ,fmt(selDay)),dd.length?dd.map(t=>h('div',
    {
        class:'hint'
    }
    ,'✓ '+t.title)):h('div',
    {
        class:'hint'
    }
    ,'Nothing completed that day.')]:h('p',
    {
        class:'hint'
    }
    ,'Select a bar to see what you finished that day.'));
    const wk=last(7).reduce((a,d)=>a+st.perDay(d),0),wg_=S.set.goal*7;
    $('wkTxt').textContent=`Weekly goal: ${wk} of ${wg_} tasks`;
    $('wkBar').style.width=Math.min(100,wk/wg_*100)+'%';
    $('goalTxt').textContent=`Today: ${st.today} of ${S.set.goal} tasks${st.today>=S.set.goal?' · goal met 🎉':''}`;
    $('goalBar').style.width=Math.min(100,st.today/S.set.goal*100)+'%';
    const bd=badges(st).filter(b=>b.ok);
    put($('recent'),bd.length?bd.slice(-3).reverse().map(b=>h('div',
    {
        class:'row-i ok'
    }
    ,h('span',
    {
        style:'font-size:1.5rem'
    }
    ,b.i),h('div',
    {
    }
    ,h('b',
    {
    }
    ,b.n),h('div',
    {
        class:'hint'
    }
    ,b.d)))):empty('Complete your first task to unlock “First step”.'),S.xp.slice(-3).reverse().map(x=>h('div',
    {
        class:'hint'
    }
    ,`+${x.amt} XP · ${x.why}`)));
    const gs=[[S.tasks.length>0,'Add a task','Use Quick add or the form in Smart Planner.'],[st.D.length>0,'Complete it','Tick it off here when you are done.'],[S.xp.length>0,'Earn XP','Every on-time task builds your level and streak.']];
    put($('guide'),!S.guideOff&&st.D.length<1?h('div',
    {
        class:'guide'
    }
    ,h('div',
    {
        class:'grow'
    }
    ,h('b',
    {
    }
    ,'Welcome to StudyPulse 👋'),h('div',
    {
        class:'hint'
    }
    ,'Three quick steps to get your streak started.'),h('div',
    {
        class:'steps'
    }
    ,gs.map(([ok,t,d],i)=>h('div',
    {
        class:'gstep'+(ok?' ok':'')
    }
    ,h('span',
    {
        class:'gn'
    }
    ,ok?'✓':i+1),h('div',
    {
    }
    ,h('b',
    {
    }
    ,t),h('div',
    {
        class:'hint'
    }
    ,d)))))),h('div',
    {
        class:'acts',style:'flex-direction:column'
    }
    ,h('a',
    {
        class:'btn sm',href:'#planner'
    }
    ,'Add a task'),h('button',
    {
        class:'btn ghost sm',onclick:()=>
        {
            S.guideOff=true;
            commit()
        }
    }
    ,'Dismiss'))):null);
    if(document.activeElement!==$('gIn'))$('gIn').value=S.set.goal;
    $('nbadge').hidden=!A.length;
    $('nbadge').textContent=A.length
}
let editId=null,rid=null,pday=null;
function taskRow(t)
{
    const u=urgency(t),k=u==='Overdue'?'bad':u==='Upcoming'?'':'warn',acts=[];
    if(t.status==='Pending')acts.push(h('button',
    {
        class:'btn ghost sm',onclick:()=>
        {
            t.status='In Progress';
            t.startedAt=t.startedAt||Date.now();
            t.upd=Date.now();
            commit()
        }
    }
    ,'Start'));
    acts.push(h('button',
    {
        class:'btn sm',onclick:()=>complete(t)
    }
    ,'Complete'),h('button',
    {
        class:'btn ghost sm',onclick:()=>
        {
            rid=rid===t.id?null:t.id;
            render()
        }
    }
    ,'Reschedule'),h('button',
    {
        class:'btn ghost sm',onclick:()=>editTask(t)
    }
    ,'Edit'),h('button',
    {
        class:'btn ghost sm',onclick:()=>
        {
            t.archived=true;
            toast('Archived. It stays in Task History.');
            commit()
        }
    }
    ,'Archive'));
    return h('div',
    {
        class:'row-i '+k
    }
    ,h('div',
    {
        class:'grow'
    }
    ,h('b',
    {
    }
    ,t.title),h('div',
    {
        class:'hint'
    }
    ,[t.subj,t.cat,t.pri,t.status].join(' · ')),h('div',
    {
        class:'hint'
    }
    ,`${fmt(t.due+(t.time?'T'+t.time:''))} (${when(t)}) · ${r1(t.done)}/${r1(t.est)} h`),t.notes&&h('div',
    {
        class:'hint'
    }
    ,t.notes),h('div',
    {
        class:'meter'
    }
    ,h('i',
    {
        style:`width:${Math.min(100,t.done/t.est*100)}%`
    }
    )),
    rid===t.id&&h('div',
    {
        class:'row'
    }
    ,h('input',
    {
        type:'date',id:'rd',value:t.due,'aria-label':'New due date'
    }
    ),h('button',
    {
        class:'btn sm',onclick:()=>
        {
            const v=$('rd').value;
            if(!v)return;
            t.due=v;
            t.upd=Date.now();
            rid=null;
            toast('Rescheduled.');
            commit()
        }
    }
    ,'Save date'))),h('div',
    {
        class:'acts'
    }
    ,acts))
}
function renderPlanner()
{
    const subs=[...new Set(S.tasks.map(x=>x.subj))].sort();
    put($('subjList'),subs.map(s=>h('option',
    {
        value:s
    }
    )));
    put($('wkStrip'),Array.from(
    {
        length:7
    }
    ,(_,i)=>addDays(i)).map(d=>
    {
        const L=open().filter(t=>t.due===d),hrs=L.reduce((a,t)=>a+rem(t),0),hot=S.set.cap>0&&hrs>S.set.cap;
        return h('button',
        {
            class:'dy'+(pday===d?' on':'')+(hot?' hot':''),'aria-pressed':String(pday===d),title:hot?'More work than your daily study hours':'',onclick:()=>
            {
                pday=pday===d?null:d;
                if(pday&&!editId)$('tDue').value=pday;
                renderPlanner()
            }
        }
        ,h('span',
        {
        }
        ,dl(d)),h('b',
        {
        }
        ,d.slice(8)),h('small',
        {
        }
        ,L.length?`${L.length} · ${r1(hrs)} h`:'free'))
    }
    ),pday&&h('button',
    {
        class:'chip',onclick:()=>
        {
            pday=null;
            renderPlanner()
        }
    }
    ,'Show all days'));
    const q=$('fq').value.toLowerCase(),v=$('pv').value;
    let L=open().filter(t=>(!q||(t.title+t.subj+t.notes).toLowerCase().includes(q))&&(!$('fst').value||t.status===$('fst').value)&&(!$('fpr').value||t.pri===$('fpr').value)&&(pday?t.due===pday:(v==='all'||(v==='today'?daysUntil(t.due)<=0:daysUntil(t.due)<=6))));
    const so=$('fso').value;
    L.sort((a,b)=>so==='pri'?PW[b.pri]-PW[a.pri]:so==='est'?rem(b)-rem(a):dueAt(a)-dueAt(b));
    put($('tasks'),L.length?L.map(taskRow):empty(open().length?'Nothing matches this view. Try “All open”.':'No tasks yet. Add your first one on the left.'));
    const w=workload(),W=[];
    if(w.pct>100)W.push(['bad',`Workload warning: ${r1(w.req)} h needed against ${r1(w.avail)} h available this week (${Math.round(w.pct)}%).`]); else if(w.pct>=70)W.push(['warn',`Busy week: ${Math.round(w.pct)}% of your capacity is planned.`]);
    collisions().forEach(([d,l])=>W.push(['warn',`${l.length} deadlines on ${fmt(d)}. Start early or spread the work.`]));
    put($('warn'),W.map(([k,m])=>h('div',
    {
        class:'row-i '+k
    }
    ,m)))
}
function editTask(t)
{
    editId=t.id;
    $('tFormTitle').textContent='Edit task';
    $('tCancel').hidden=false;
    $('tTitle').value=t.title;
    $('tSubj').value=t.subj;
    $('tNotes').value=t.notes;
    $('tPri').value=t.pri;
    $('tCat').value=t.cat;
    $('tDue').value=t.due;
    $('tTime').value=t.time;
    $('tEst').value=t.est;
    $('tTitle').focus();
    scrollTo(0,0)
}
function resetTForm()
{
    editId=null;
    $('tForm').reset();
    $('tFormTitle').textContent='Add task';
    $('tCancel').hidden=true;
    $('tErr').textContent=''
}
function statusOf(t)
{
    return t.doneAt?(t.status==='Completed'?(t.onTime?'Completed on time':'Completed late'):'Reopened'):t.archived?'Archived':isOver(t)?'Overdue':t.status
}
function renderHistory()
{
    put($('hchips'),[['','All'],['completed','Completed'],['ontime','On time'],['late','Late'],['overdue','Overdue'],['pending','Pending']].map(([v,t])=>h('button',
    {
        class:'chip'+($('hf').value===v?' on':''),'aria-pressed':String($('hf').value===v),onclick:()=>
        {
            $('hf').value=v;
            renderHistory()
        }
    }
    ,t)));
    const q=$('hq').value.toLowerCase(),f=$('hf').value,F=
    {
        completed:t=>t.doneAt,ontime:t=>t.doneAt&&t.onTime,late:t=>t.doneAt&&!t.onTime,overdue:t=>!t.doneAt&&!t.archived&&isOver(t),pending:t=>!t.doneAt&&!t.archived&&!isOver(t)
    }
    [f];
    const L=S.tasks.filter(t=>(!q||(t.title+t.subj).toLowerCase().includes(q))&&(!F||F(t))).sort((a,b)=>(b.doneAt||b.created||'').localeCompare(a.doneAt||a.created||''));
    put($('hist'),L.length?L.map(t=>
    {
        const xp=S.xp.filter(x=>x.id==='task:'+t.id).reduce((a,x)=>a+x.amt,0),s=statusOf(t);
        return h('div',
        {
            class:'row-i '+(t.doneAt&&t.onTime?'ok':s==='Overdue'?'bad':t.doneAt?'warn':'')
        }
        ,h('div',
        {
            class:'grow'
        }
        ,h('b',
        {
        }
        ,t.title),h('div',
        {
            class:'hint'
        }
        ,`${t.subj} · ${s}`),h('div',
        {
            class:'hint'
        }
        ,`Deadline ${fmt((t.dueSnap||t.due+(t.time?' '+t.time:'')).replace(' ','T'))}${t.doneAt?` · completed $
        {
            fmt(t.doneAt)
        }
        `:''}`),h('div',
        {
            class:'hint'
        }
        ,`Estimated ${r1(t.est)} h · actual ${t.actual?r1(t.actual/60)+' h':'not tracked'}`)),h('div',
        {
            class:'acts',style:'flex-direction:column;align-items:flex-end'
        }
        ,h('b',
        {
        }
        ,xp?`+${xp} XP`:'–'),t.archived&&h('button',
        {
            class:'btn ghost sm',onclick:()=>
            {
                t.archived=false;
                toast('Task restored to your planner.');
                commit()
            }
        }
        ,'Restore'),h('button',
        {
            class:'btn danger sm',onclick:()=>
            {
                if(confirm('Delete this task permanently? Its completion record and streak credit are removed. Earned XP is kept.'))
                {
                    S.tasks=S.tasks.filter(x=>x!==t);
                    toast('Task deleted.');
                    commit()
                }
            }
        }
        ,'Delete')))
    }
    ):empty('No activity matches. Complete a task to see it here.'))
}
function renderProgress()
{
    const st=stats(),span=st.next-st.base,wk=last(7).reduce((a,d)=>a+st.perDay(d),0);
    $('donut').style.setProperty('--p',(st.pct||0)+'%');
    $('donut').dataset.v=st.pct==null?'–':st.pct+'%';
    put($('pTop'),h('div',
    {
        class:'strip'
    }
    ,[[st.xp,'Total XP'],['Level '+st.L,`${st.next-st.xp} XP to level ${st.L+1}`],[st.sk.cur+' d','Current streak'],[st.sk.best+' d','Longest streak']].map(([a,b])=>h('div',
    {
        class:'sx'
    }
    ,h('b',
    {
    }
    ,a),h('span',
    {
    }
    ,b)))),h('div',
    {
        class:'meter','aria-label':'Level progress'
    }
    ,h('i',
    {
        style:`width:${(st.xp-st.base)/span*100}%`
    }
    )));
    const d14=last(14);
    bars($('trend'),d14.map(d=>d.slice(8)),d14.map(st.perDay),'',Math.max(3,...d14.map(st.perDay)));
    put($('pNums'),[`Tasks completed: ${st.D.length}`,`On-time rate: ${st.pct==null?'–':st.pct+'%'} (${st.on} on time, ${st.late} late)`,`Overdue right now: ${st.od}`,`Daily goal today: ${st.today}/${S.set.goal}`,`Weekly goal: ${wk}/${S.set.goal*7}`].map(x=>h('div',
    {
        class:'hint'
    }
    ,x)));
    put($('badges'),badges(st).map(b=>h('div',
    {
        class:'row-i'
    }
    ,h('div',
    {
        class:'badge-i '+(b.ok?'on':'')
    }
    ,h('span',
    {
        class:'dot'
    }
    ,b.i),h('div',
    {
    }
    ,h('b',
    {
    }
    ,b.n),h('div',
    {
        class:'hint'
    }
    ,`${b.d} (${Math.min(b.c,b.t)}/${b.t})`))))));
    put($('xpH'),S.xp.length?[...S.xp].reverse().slice(0,10).map(x=>h('div',
    {
        class:'row-i'
    }
    ,h('span',
    {
        class:'grow'
    }
    ,x.why+' · '+fmt(ld(x.at))),h('b',
    {
    }
    ,'+'+x.amt))):empty('No XP yet. Complete a task.'));
    put($('how'),h('p',
    {
    }
    ,'XP: 10 for an on-time task plus a priority bonus (Medium +5, High +10, Critical +15). Late tasks earn 3. Meeting your daily goal adds 20, once per day.'),h('p',
    {
    }
    ,'Each task earns XP once. Reopening or completing it again never pays twice.'),h('p',
    {
    }
    ,'Streak: consecutive calendar days (your local time) with at least one completion.'),h('p',
    {
    }
    ,'On time: finished at or before the deadline that applied at completion. Later deadline edits never change past results.'),h('p',
    {
    }
    ,'Levels: level N starts at 50×N×(N−1) XP.'))
}
const MOODS=[[1,'😞 Rough'],[2,'🙁 Low'],[3,'😐 Okay'],[4,'🙂 Good'],[5,'😄 Great']],TIPS=['Roll your shoulders back ten times.','Look at something 6 metres away for 20 seconds.','Stand up and stretch your arms overhead.','Walk to a window and take three slow breaths.','Refill your water bottle.','Gently stretch your neck side to side.'],CARE=['Drink water','Stretch','Step outside','Screen break','Wind down'];
const svg=s=>
{
    const d=document.createElement('div');
    d.innerHTML=s;
    return d.firstChild
}
;
const GLASS=p=>`<svg viewBox="0 0 60 80" width="58" height="78" role="img" aria-label="Water glass ${Math.round(p*100)}% full"><defs><clipPath id="gc"><path d="M8 6h44l-5 66a6 6 0 0 1-6 5H19a6 6 0 0 1-6-5z"/></clipPath></defs><rect x="0" y="${(6+(1-p)*70).toFixed(1)}" width="60" height="80" fill="var(--glass)" clip-path="url(#gc)"/><path d="M8 6h44l-5 66a6 6 0 0 1-6 5H19a6 6 0 0 1-6-5z" fill="none" stroke="var(--c)" stroke-width="3" stroke-linejoin="round"/></svg>`;
const MOON='<svg viewBox="0 0 80 80" width="72" height="72" role="img" aria-label="Moon and stars"><path d="M50 12a28 28 0 1 0 18 46A24 24 0 0 1 50 12z" fill="var(--glass)" stroke="var(--c)" stroke-width="3" stroke-linejoin="round"/><circle cx="64" cy="20" r="2.5" fill="var(--c)"/><circle cx="72" cy="36" r="2" fill="var(--c)"/><circle cx="58" cy="8" r="1.8" fill="var(--c)"/></svg>';
let tip=0;
const wg=()=>
{
    let e=S.well.find(x=>x.day===today());
    if(!e)
    {
        e=
        {
            day:today(),sleep:0,water:0,mood:0,brk:0,note:'',energy:0,stress:0,quality:0,care:[]
        }
        ;
        S.well.push(e);
        S.well.sort((a,b)=>a.day.localeCompare(b.day))
    }
    if(!e.care)e.care=[];
    return e
}
,wsave=()=>
{
    save();
    renderWell()
}
;
function renderWell()
{
    const e=S.well.find(x=>x.day===today())||
    {
    }
    ,set=S.set,care=e.care||[],n5=[[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5']];
    const ch=(lab,key,opts)=>h('div',
    {
        class:'wrow'
    }
    ,h('span',
    {
        class:'wl'
    }
    ,lab),h('div',
    {
        class:'chips',role:'group','aria-label':lab
    }
    ,opts.map(([v,t])=>h('button',
    {
        class:'chip'+(e[key]===v?' on':''),'aria-pressed':String(e[key]===v),onclick:()=>
        {
            wg()[key]=v;
            wsave()
        }
    }
    ,t))));
    $('wMsg').textContent=!e.mood?'Whenever you are ready, a check-in takes about 20 seconds. Skipping a day is fine.':e.mood<=2?'Tough days happen. A glass of water and a short pause can help. You are doing enough.':'Lovely. You are looking after yourself as well as your work.';
    put($('wMood'),ch('Mood','mood',MOODS));
    put($('wEn'),ch('Energy','energy',n5),ch('Stress','stress',n5));
    const w=e.water||0;
    put($('wWat'),h('div',
    {
        class:'illus'
    }
    ,svg(GLASS(Math.min(1,w/Math.max(1,set.water)))),svg(MOON)),h('div',
    {
        class:'wrow'
    }
    ,h('span',
    {
        class:'wl'
    }
    ,'Water'),h('button',
    {
        class:'btn ghost sm','aria-label':'Remove a glass',onclick:()=>
        {
            const x=wg();
            x.water=Math.max(0,x.water-1);
            wsave()
        }
    }
    ,'−'),h('div',
    {
        class:'dots'
    }
    ,Array.from(
    {
        length:Math.max(set.water,w)
    }
    ,(_,i)=>h('i',
    {
        class:i<w?'f':''
    }
    ))),h('button',
    {
        class:'btn sm','aria-label':'Add a glass',onclick:()=>
        {
            wg().water++;
            wsave()
        }
    }
    ,'+'),h('span',
    {
        class:'hint'
    }
    ,`${w}/`),h('input',
    {
        type:'number',min:1,max:20,value:set.water,'aria-label':'Water goal in glasses',style:'width:62px',onchange:ev=>
        {
            const v=Math.round(+ev.target.value);
            if(v>=1&&v<=20)
            {
                S.set.water=v;
                wsave()
            } else toast('Choose 1 to 20 glasses.','err')
        }
    }
    )),
    h('div',
    {
        class:'wrow'
    }
    ,h('span',
    {
        class:'wl'
    }
    ,'Sleep (h)'),h('input',
    {
        type:'number',min:0,max:16,step:.5,value:e.sleep||'','aria-label':'Sleep hours',style:'max-width:90px',onchange:ev=>
        {
            const v=parseFloat(ev.target.value);
            if(v>=0&&v<=16)
            {
                wg().sleep=v;
                wsave()
            } else toast('Enter sleep between 0 and 16 hours.','err')
        }
    }
    ),h('span',
    {
        class:'hint'
    }
    ,'Goal'),h('input',
    {
        type:'number',min:3,max:12,step:.5,value:set.sleep,'aria-label':'Sleep goal in hours',style:'width:70px',onchange:ev=>
        {
            const v=parseFloat(ev.target.value);
            if(v>=3&&v<=12)
            {
                S.set.sleep=v;
                wsave()
            } else toast('Choose 3 to 12 hours.','err')
        }
    }
    )),ch('Sleep quality','quality',[[1,'Poor'],[2,'Fair'],[3,'Okay'],[4,'Good'],[5,'Great']]));
    put($('care'),CARE.map(c=>h('label',
    {
        class:'wrow'
    }
    ,h('input',
    {
        type:'checkbox',style:'width:auto',...(care.includes(c)?
        {
            checked:''
        }
        :
        {
        }
        ),onchange:ev=>
        {
            const x=wg();
            x.care=ev.target.checked?[...x.care,c]:x.care.filter(y=>y!==c);
            wsave()
        }
    }
    ),c)),h('div',
    {
        class:'meter'
    }
    ,h('i',
    {
        style:`width:${care.length/CARE.length*100}%`
    }
    )),h('div',
    {
        class:'hint'
    }
    ,`${care.length}/${CARE.length} done today`));
    $('tip').textContent=TIPS[tip%TIPS.length];
    const d7=last(7),by=d=>S.well.find(x=>x.day===d)||
    {
    }
    ;
    bars($('moodBars'),d7.map(dl),d7.map(d=>by(d).mood||0),'',5);
    const sl=d7.map(d=>by(d).sleep).filter(Boolean),wt=d7.map(d=>by(d).water).filter(x=>x!=null);
    put($('wTrend'),h('div',
    {
        class:'hint'
    }
    ,'Bars show mood (1–5).'),h('div',
    {
        class:'hint'
    }
    ,sl.length?`Average sleep: ${r1(sl.reduce((a,b)=>a+b,0)/sl.length)} h`:'No sleep logged this week.'),h('div',
    {
        class:'hint'
    }
    ,`Check-ins this week: ${d7.filter(d=>by(d).mood).length}/7`))
}
let bt=null;
function breathe()
{
    const on=!bt;
    $('orb').classList.toggle('go',on);
    $('bBtn').textContent=on?'Stop':'Start 4-4-6 breathing';
    if(on)
    {
        const t0=Date.now();
        bt=setInterval(()=>
        {
            const s=(Date.now()-t0)/1000%14;
            $('bTxt').textContent=s<4?'Breathe in':s<8?'Hold':'Breathe out'
        }
        ,200)
    } else
    {
        clearInterval(bt);
        bt=null;
        $('bTxt').textContent='Ready'
    }
}
function render()
{
    renderDash();
    renderPlanner();
    renderHistory();
    renderProgress();
    renderWell();
}
function route()
{
    const p=PAGES.includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';
    PAGES.forEach(x=>$(x).classList.toggle('show',x===p));
    document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+p));
    $('title').textContent=document.querySelector(`#nav a[href="#${p}"]`).dataset.t;
    $('side').classList.remove('open')
}
function setTheme(t)
{
    document.documentElement.dataset.theme=t;
    $('theme').textContent=t==='dark'?'Light mode':'Dark mode';
    try
    {
        localStorage.setItem('sp_theme',t)
    } catch(e)
    {
    }
}
function init()
{
    load();
    let th='light';
    try
    {
        th=localStorage.getItem('sp_theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')
    } catch(e)
    {
    }
    setTheme(th);
    $('theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
    $('menu').onclick=()=>$('side').classList.toggle('open');
    addEventListener('hashchange',route);
    $('addBtn').onclick=()=>setTimeout(()=>$('tTitle').focus(),50);
    $('tForm').onsubmit=e=>
    {
        e.preventDefault();
        const t=
        {
            title:$('tTitle').value.trim(),subj:$('tSubj').value.trim(),notes:$('tNotes').value.trim(),pri:$('tPri').value,cat:$('tCat').value,due:$('tDue').value,time:$('tTime').value,est:num('tEst')
        }
        ,er=[];
        if(!t.title)er.push('Title is required.');
        if(!t.subj)er.push('Subject is required.');
        if(!t.due||isNaN(new Date(t.due)))er.push('Choose a due date.');
        if(!(t.est>0))er.push('Estimated hours must be above 0.');
        $('tErr').textContent=er.join(' ');
        if(er.length)return;
        t.upd=Date.now();
        if(editId)
        {
            const o=S.tasks.find(x=>x.id===editId);
            Object.assign(o,t);
            if(!o.doneAt&&o.status!=='Completed')o.done=Math.min(o.done,o.est)
        } else S.tasks.push(
        {
            id:uid(),created:today(),status:'Pending',done:0,...t
        }
        );
        toast(editId?'Task updated.':'Task added. Plan it, finish it, earn XP.');
        resetTForm();
        commit()
    }
    ;
    $('tCancel').onclick=resetTForm;
    ['fq','fst','fpr','fso','pv'].forEach(i=>$(i).addEventListener('input',renderPlanner));
    ['hq','hf'].forEach(i=>$(i).addEventListener('input',renderHistory));
    $('tipBtn').onclick=()=>
    {
        tip++;
        renderWell()
    }
    ;
    $('bBtn').onclick=breathe;
    $('per').onchange=()=>
    {
        per=+$('per').value;
        renderDash()
    }
    ;
    $('resume').onclick=()=>$('cont').scrollIntoView(
    {
        behavior:'smooth'
    }
    );
    $('qaF').onsubmit=e=>
    {
        e.preventDefault();
        let v=$('qa').value.trim();
        if(!v)return toast('Type a task first.','err');
        let d=pday||addDays(1);
        if(/\btoday\b/i.test(v))
        {
            d=today();
            v=v.replace(/\btoday\b/i,'')
        } else v=v.replace(/\btomorrow\b/i,'');
        S.tasks.push(
        {
            id:uid(),created:today(),status:'Pending',done:0,title:v.trim()||'Task',subj:'General',notes:'',pri:'Medium',cat:'Study',due:d,time:'',est:1,upd:Date.now()
        }
        );
        $('qa').value='';
        toast('Quick task added for '+fmt(d)+'.');
        commit()
    }
    ;
    $('gIn').onchange=()=>
    {
        const v=Math.round(+$('gIn').value);
        if(!(v>=1&&v<=20))
        {
            toast('Choose a goal between 1 and 20 tasks.','err');
            return renderDash()
        }
        S.set.goal=v;
        toast('Daily goal set to '+v+'.');
        commit()
    }
    ;
    $('exp').onclick=()=>
    {
        const a=h('a',
        {
            href:URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],
            {
                type:'application/json'
            }
            )),download:`studypulse-backup-${today()}.json`
        }
        );
        a.click();
        URL.revokeObjectURL(a.href);
        toast('Backup downloaded.')
    }
    ;
    $('imp').onchange=async e=>
    {
        const f=e.target.files[0];
        e.target.value='';
        if(!f)return;
        try
        {
            const d=JSON.parse(await f.text());
            if(!d||typeof d!=='object'||['tasks','exams','sessions','assess','well','xp'].some(k=>d[k]!==undefined&&!Array.isArray(d[k])))throw 0;
            if(confirm('Replace all current data with this backup?'))
            {
                S=norm(d);
                if(!d.v||d.v<2)S.exMig=false;
                migrate();
                S.seen=null;
                commit();
                toast('Backup restored.')
            }
        } catch(x)
        {
            toast('That file is not a valid StudyPulse backup.','err')
        }
    }
    ;
    route();
    commit()
}
init();
