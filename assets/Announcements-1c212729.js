import{c as h,r as l,k as C,j as e}from"./index-5cfdb126.js";import{S as L}from"./sweetalert2.esm.all-6ddcfacf.js";import{A as W}from"./AdminLayout-b9bcf585.js";import{U as q}from"./users-f9ca2420.js";import{C as O}from"./check-circle-2-4407b513.js";import{A as Y}from"./alert-triangle-c6822d1f.js";import{L as R}from"./loader-2-8b653ec2.js";import{S as P}from"./send-086117b6.js";import{B as V,I as G,U as K}from"./underline-6964574a.js";import{L as J}from"./link-2-71144458.js";import"./mode-toggle-0f80a5c2.js";import"./AdminShell-be6938e0.js";import"./logo-7654d5de.js";import"./x-41d2dcfc.js";import"./user-circle-99c7e08d.js";import"./layout-dashboard-d4ea5904.js";import"./menu-043e251b.js";import"./bell-3a694087.js";const Q=h("Heading2",[["path",{d:"M4 12h8",key:"17cfdx"}],["path",{d:"M4 18V6",key:"1rz3zl"}],["path",{d:"M12 18V6",key:"zqpxq5"}],["path",{d:"M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1",key:"9jr5yi"}]]),X=h("ListOrdered",[["line",{x1:"10",x2:"21",y1:"6",y2:"6",key:"76qw6h"}],["line",{x1:"10",x2:"21",y1:"12",y2:"12",key:"16nom4"}],["line",{x1:"10",x2:"21",y1:"18",y2:"18",key:"u3jurt"}],["path",{d:"M4 6h1v4",key:"cnovpq"}],["path",{d:"M4 10h2",key:"16xx2s"}],["path",{d:"M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",key:"m9a95d"}]]),Z=h("List",[["line",{x1:"8",x2:"21",y1:"6",y2:"6",key:"7ey8pc"}],["line",{x1:"8",x2:"21",y1:"12",y2:"12",key:"rjfblc"}],["line",{x1:"8",x2:"21",y1:"18",y2:"18",key:"c3b1m8"}],["line",{x1:"3",x2:"3.01",y1:"6",y2:"6",key:"1g7gq3"}],["line",{x1:"3",x2:"3.01",y1:"12",y2:"12",key:"1pjlvk"}],["line",{x1:"3",x2:"3.01",y1:"18",y2:"18",key:"28t2mc"}]]),ee=h("Mail",[["rect",{width:"20",height:"16",x:"2",y:"4",rx:"2",key:"18n3k1"}],["path",{d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7",key:"1ocrg3"}]]),te=h("RemoveFormatting",[["path",{d:"M4 7V4h16v3",key:"9msm58"}],["path",{d:"M5 20h6",key:"1h6pxn"}],["path",{d:"M13 4 8 20",key:"kqq6aj"}],["path",{d:"m15 15 5 5",key:"me55sn"}],["path",{d:"m20 15-5 5",key:"11p7ol"}]]),d="font-family:Arial,Helvetica,sans-serif;",m="#0a3d62",j=(t,s="16px 30px 4px 30px")=>`        <tr>
          <td style="padding:${s};font-size:14px;line-height:1.7;color:#1f2933;${d}">
${t}
          </td>
        </tr>`,T=t=>`<h2 style="margin:0 0 8px 0;font-size:17px;color:${m};${d}">${t}</h2>`,re=t=>`<ul style="margin:0;padding-left:20px;">
${t.map(s=>`<li style="margin-bottom:6px;">${s}</li>`).join(`
`)}
</ul>`,ne=(t,s)=>`              <tr>
                <td width="36" valign="top" style="padding:0 0 12px 0;">
                  <table cellpadding="0" cellspacing="0" border="0"><tr><td width="26" height="26" align="center" valign="middle" bgcolor="${m}" style="background:${m};color:#ffffff;font-size:13px;font-weight:bold;border-radius:13px;">${t}</td></tr></table>
                </td>
                <td valign="top" style="padding:3px 0 12px 0;font-size:14px;line-height:1.6;color:#1f2933;">${s}</td>
              </tr>`,S=(t,s)=>`        <tr>
          <td style="padding:16px 30px 4px 30px;${d}">
            ${T(t)}
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
${s.map((r,a)=>ne(a+1,r)).join(`
`)}
            </table>
          </td>
        </tr>`,E=(t,s,r="amber")=>{const a=r==="amber"?{bg:"#fff8e6",border:"#f3dca0",bar:"#f5a623",text:"#4a3b10"}:{bg:"#fdecec",border:"#f3b8b8",bar:"#d64545",text:"#5c1f1f"};return`        <tr>
          <td style="padding:4px 30px 8px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${a.bg}" style="background:${a.bg};border:1px solid ${a.border};border-left:4px solid ${a.bar};border-radius:6px;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;line-height:1.7;color:${a.text};${d}">
                  <b style="font-size:14px;">${t}</b><br>
${s.map(p=>`                  &bull; ${p}`).join(`<br>
`)}
                </td>
              </tr>
            </table>
          </td>
        </tr>`},oe=t=>`        <tr>
          <td style="padding:16px 30px 8px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f6fb" style="background:#f1f6fb;border:1px solid #d6e4f2;border-radius:8px;">
              <tr>
${t.map(([s,r])=>`                <td width="${Math.floor(100/t.length)}%" valign="top" style="padding:14px 18px;${d}">
                  <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5b7083;font-weight:bold;">${s}</div>
                  <div style="font-size:16px;color:${m};font-weight:bold;margin-top:4px;">${r}</div>
                </td>`).join(`
`)}
              </tr>
            </table>
          </td>
        </tr>`,I=t=>`        <tr>
          <td align="center" style="padding:22px 30px 8px 30px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${m}" style="background:${m};border-radius:6px;">
                  <a href="https://[your-dtms-link]" style="display:inline-block;padding:13px 34px;${d}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${t}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,_=j(`            <p style="margin:0 0 12px 0;">If you have any questions or run into any problems, just reply to this email or contact the DICT Region 10 DMS team.</p>
            <p style="margin:0;">Thank you!</p>`,"18px 30px 28px 30px"),z=t=>`<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef2f7;">${t.preheader}</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f7" style="background:#eef2f7;">
  <tr>
    <td align="center" style="padding:28px 12px;">

      <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"
             style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dde3ec;border-radius:10px;${d}">

        <tr>
          <td bgcolor="${m}" style="background:${m};padding:26px 30px;border-radius:10px 10px 0 0;${d}">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ec5e8;font-weight:bold;">${t.eyebrow}</div>
            <h1 style="margin:8px 0 4px 0;font-size:24px;line-height:1.25;color:#ffffff;${d}">${t.title}</h1>${t.subtitle?`
            <div style="font-size:13px;color:#cfe3f5;">${t.subtitle}</div>`:""}
          </td>
        </tr>

${t.rows.join(`

`)}

        <tr>
          <td bgcolor="#f6f8fb" style="background:#f6f8fb;padding:16px 30px;border-top:1px solid #dde3ec;border-radius:0 0 10px 10px;font-size:12px;line-height:1.6;color:#6b7280;${d}">
            <b style="color:#374151;">DICT Region 10 &ndash; Document Management System Team</b><br>
            dict10.dms@gmail.com
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`,H=t=>j(`            <p style="margin:0 0 12px 0;">Dear <b>{first_name}</b>,</p>
            <p style="margin:0;">${t}</p>`,"28px 30px 8px 30px"),A=[{id:"dtr-update",name:"DTR update",subject:"DTMS Update: Changes to the Daily Time Record (DTR)",html:z({preheader:"There is an update on the Daily Time Record (DTR) in DTMS, effective [date]. See what changed and what you need to do.",eyebrow:"DTMS Update",title:"Changes to the Daily Time Record (DTR)",subtitle:'Effective <b style="color:#ffffff;">[date]</b>',rows:[H("Good day! We would like to let you know about an update to how the <b>Daily Time Record (DTR)</b> works in DTMS. Please take a minute to read the details below."),oe([["Effective date","[date]"],["Submission deadline","[deadline]"]]),j(`            ${T("What's new")}
${re(["[Describe the change, e.g. how DTRs are now submitted, routed or signed in DTMS]","[Second change, if any]"])}`),S("What you need to do",["Log in to DTMS.","[Step, e.g. Go to <b>Create</b> and select the DTR template.]","[Step, e.g. Submit before <b>[deadline]</b>.]"]),E("Reminders",["Check <b>My Documents</b> regularly for DTRs waiting for your signature.","Export your <b>Signature Settings</b> so you can restore them if they are ever lost.","[Any other reminder, e.g. DTRs submitted after the deadline]"]),I("Open DTMS"),_]})},{id:"signature-export",name:"Signature Settings export / import",subject:"DTMS Update: Back Up Your Signature Settings (Export / Import)",html:z({preheader:"You can now export your Signature Settings and import them back if they are ever lost.",eyebrow:"DTMS Update",title:"Back up your Signature Settings",subtitle:"New: Export &amp; Import",rows:[H("We've added a way to <b>back up and restore your signature settings</b> in DTMS. Save your signature profiles to a file, and load them back whenever you need to."),j(`            ${T("Why this matters")}
            <p style="margin:0 0 8px 0;">Your P12 certificate, signature image and stamp layout are stored in <b>your browser</b>, not on the server. They can disappear if you clear your browser data, switch to a new browser or computer, use a private window, or when your session expires.</p>
            <p style="margin:0;">With a backup, you can restore everything in seconds instead of setting it up again.</p>`),S("How to back up",["Log in to DTMS and open <b>Signature Settings</b>.","Click <b>Export</b>.","Save the downloaded file (<i>signature-settings-YYYY-MM-DD.json</i>) somewhere safe, like a flash drive."]),S("How to restore",["Open <b>Signature Settings</b> and click <b>Import</b>.","Choose your saved <i>signature-settings-&hellip;.json</i> file.","You'll see a message such as <i>Imported 1 profile</i>. Your signature is back."]),E("Important",["Keep the file private. It contains your P12 certificate and password. Do not email or share it.","Export again after you change your signature so your backup stays current.","Importing adds or updates profiles. It will not delete the ones you already have."],"red"),I("Open Signature Settings"),_]})}],u=({title:t,onClick:s,children:r})=>e.jsx("button",{type:"button",title:t,onMouseDown:a=>{a.preventDefault(),s()},className:"p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",children:r}),se=({onChange:t,editorRef:s})=>{const r=(o,y)=>{var x,f;(x=s.current)==null||x.focus(),document.execCommand(o,!1,y),t(((f=s.current)==null?void 0:f.innerHTML)??"")},a=()=>{const o=window.prompt("Link address (https://…)");o&&r("createLink",/^(https?:|mailto:)/i.test(o)?o:`https://${o}`)},p=o=>r("insertText",o);return e.jsxs("div",{className:"rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary/50 transition",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border",children:[e.jsx(u,{title:"Bold",onClick:()=>r("bold"),children:e.jsx(V,{className:"w-4 h-4"})}),e.jsx(u,{title:"Italic",onClick:()=>r("italic"),children:e.jsx(G,{className:"w-4 h-4"})}),e.jsx(u,{title:"Underline",onClick:()=>r("underline"),children:e.jsx(K,{className:"w-4 h-4"})}),e.jsx(u,{title:"Heading",onClick:()=>r("formatBlock","h2"),children:e.jsx(Q,{className:"w-4 h-4"})}),e.jsx("span",{className:"w-px h-5 bg-border mx-1"}),e.jsx(u,{title:"Bulleted list",onClick:()=>r("insertUnorderedList"),children:e.jsx(Z,{className:"w-4 h-4"})}),e.jsx(u,{title:"Numbered list",onClick:()=>r("insertOrderedList"),children:e.jsx(X,{className:"w-4 h-4"})}),e.jsx(u,{title:"Add link",onClick:a,children:e.jsx(J,{className:"w-4 h-4"})}),e.jsx(u,{title:"Clear formatting",onClick:()=>{r("removeFormat"),r("formatBlock","div")},children:e.jsx(te,{className:"w-4 h-4"})}),e.jsx("span",{className:"w-px h-5 bg-border mx-1"}),e.jsx("button",{type:"button",onMouseDown:o=>{o.preventDefault(),p("{first_name}")},title:"Insert the recipient's first name",className:"px-2 py-1 rounded-md text-xs font-mono text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",children:"{first_name}"})]}),e.jsx("div",{ref:s,contentEditable:!0,suppressContentEditableWarning:!0,onInput:o=>t(o.currentTarget.innerHTML),onPaste:o=>{o.preventDefault(),document.execCommand("insertText",!1,o.clipboardData.getData("text/plain"))},"data-placeholder":`Dear {first_name},

We've updated DTMS…`,className:"min-h-[220px] max-h-[460px] overflow-y-auto px-3 py-2.5 text-sm text-foreground focus:outline-none [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-1 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:whitespace-pre-line"})]})},ae=t=>(new DOMParser().parseFromString(t,"text/html").body.textContent??"").trim(),Te=()=>{const[t,s]=l.useState(""),r=l.useRef(null),[a,p]=l.useState(""),[o,y]=l.useState("visual"),x=ae(a),f=x!=="";l.useEffect(()=>{o==="visual"&&r.current&&(r.current.innerHTML=a)},[o]);const[g,B]=l.useState(null),[k,N]=l.useState(null),[w,v]=l.useState(null);l.useEffect(()=>{const n=new AbortController;return C.broadcastRecipientCount(n.signal).then(B).catch(i=>{(i==null?void 0:i.code)!=="ERR_CANCELED"&&console.error(i)}),()=>n.abort()},[]);const[U,$]=l.useState(""),F=async n=>{$(n);const i=A.find(b=>b.id===n);if(i){if((t.trim()||f)&&!(await L.fire({icon:"warning",title:"Replace what you've written?",text:"Loading a template overwrites the current subject and message.",showCancelButton:!0,confirmButtonText:"Load template"})).isConfirmed){$("");return}s(i.subject),p(i.html),v(null),o==="visual"&&r.current&&(r.current.innerHTML=i.html),y("html")}},D=t.trim()!==""&&f&&!k,M=async n=>{var i,b;if(!(!n&&!(await L.fire({icon:"question",title:"Send to all users?",text:`This will email ${g??"all"} active user${g===1?"":"s"}. This can't be undone.`,showCancelButton:!0,confirmButtonText:"Yes, send"})).isConfirmed)){N(n?"test":"all"),v(null);try{const c=await C.broadcastEmail({subject:t.trim(),message:x,message_html:a,test:n});v({type:"success",text:n?"Test email is on its way to your own address.":`Sending to ${c.queued} users in the background — it may take a few minutes to finish.`}),n||(s(""),p(""),r.current&&(r.current.innerHTML=""))}catch(c){v({type:"error",text:((b=(i=c==null?void 0:c.response)==null?void 0:i.data)==null?void 0:b.detail)||(c==null?void 0:c.message)||"Failed to send."})}finally{N(null)}}};return e.jsx(W,{title:"Announcements",subtitle:"Email all users about system updates and news",children:e.jsx("div",{className:"max-w-2xl flex flex-col gap-4",children:e.jsxs("div",{className:"bg-card border border-border rounded-xl p-5 flex flex-col gap-4",children:[e.jsxs("div",{className:"flex items-center gap-2 text-sm text-muted-foreground",children:[e.jsx(q,{className:"w-4 h-4"}),g===null?"Counting recipients…":e.jsxs(e.Fragment,{children:["Will be sent to ",e.jsx("span",{className:"font-semibold text-foreground",children:g})," active user",g===1?"":"s",", each as their own email."]})]}),e.jsxs("div",{className:"flex flex-col gap-1.5",children:[e.jsx("label",{className:"text-sm font-medium text-foreground",children:"Start from a template"}),e.jsxs("select",{value:U,onChange:n=>F(n.target.value),className:"w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition",children:[e.jsx("option",{value:"",children:"— Choose a template —"}),A.map(n=>e.jsx("option",{value:n.id,children:n.name},n.id))]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Fill in anything in [brackets], then send a test to yourself first."})]}),e.jsxs("div",{className:"flex flex-col gap-1.5",children:[e.jsx("label",{className:"text-sm font-medium text-foreground",children:"Subject"}),e.jsx("input",{value:t,maxLength:200,onChange:n=>s(n.target.value),placeholder:"e.g. DTMS system update — new features",className:"w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"})]}),e.jsxs("div",{className:"flex flex-col gap-1.5",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("label",{className:"text-sm font-medium text-foreground",children:"Message"}),e.jsx("div",{className:"inline-flex rounded-lg border border-border bg-accent/40 p-0.5 text-xs font-medium",children:["visual","html"].map(n=>e.jsx("button",{type:"button",onClick:()=>y(n),className:`px-3 py-1 rounded-md transition-colors ${o===n?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`,children:n==="visual"?"Visual":"HTML code"},n))})]}),o==="visual"?e.jsx(se,{editorRef:r,onChange:p}):e.jsx("textarea",{value:a,onChange:n=>p(n.target.value),spellCheck:!1,rows:14,placeholder:`<p>Dear {first_name},</p>
<p>We've updated DTMS…</p>`,className:"w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y transition"}),e.jsxs("p",{className:"text-xs text-muted-foreground",children:[o==="visual"?e.jsx(e.Fragment,{children:"Use the toolbar for bold, lists and links. "}):e.jsx(e.Fragment,{children:"Write the email as HTML (tables, inline styles and https images are kept; scripts are removed). "}),e.jsx("code",{className:"font-mono",children:"{first_name}"})," or ",e.jsx("code",{className:"font-mono",children:"{full_name}"})," personalize each email."]})]}),w&&e.jsxs("div",{className:`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${w.type==="success"?"border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400":"border-destructive/30 bg-destructive/10 text-destructive"}`,children:[w.type==="success"?e.jsx(O,{className:"w-4 h-4 shrink-0"}):e.jsx(Y,{className:"w-4 h-4 shrink-0"}),e.jsx("span",{children:w.text})]}),e.jsxs("div",{className:"flex gap-3 sm:flex-col",children:[e.jsxs("button",{onClick:()=>M(!0),disabled:!D,className:"flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed",children:[k==="test"?e.jsx(R,{className:"w-4 h-4 animate-spin"}):e.jsx(ee,{className:"w-4 h-4"})," Send test to me"]}),e.jsxs("button",{onClick:()=>M(!1),disabled:!D,className:"flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed",children:[k==="all"?e.jsx(R,{className:"w-4 h-4 animate-spin"}):e.jsx(P,{className:"w-4 h-4"})," Send to all users"]})]})]})})})};export{Te as default};
