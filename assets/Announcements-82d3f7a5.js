import{e as w,r as d,k as P,j as e}from"./index-32a9c516.js";import{S as A}from"./sweetalert2.esm.all-6ddcfacf.js";import{A as q}from"./AdminLayout-006dcf44.js";import{U as Y}from"./users-6f16be80.js";import{C as V}from"./check-circle-2-5a949cd6.js";import{A as G}from"./alert-triangle-da5d66cf.js";import{L as _}from"./loader-2-3194813d.js";import{S as J}from"./send-0f9978c2.js";import{B as K,I as Q,U as X}from"./underline-604e99d8.js";import{L as Z}from"./link-2-15de8a07.js";import"./mode-toggle-6a472d38.js";import"./AdminShell-b1bcd2c8.js";import"./logo-7654d5de.js";import"./x-3b65e87a.js";import"./user-circle-da2d485b.js";import"./layout-dashboard-97495fda.js";import"./menu-940fdfe0.js";import"./bell-b8407d01.js";const ee=w("Heading2",[["path",{d:"M4 12h8",key:"17cfdx"}],["path",{d:"M4 18V6",key:"1rz3zl"}],["path",{d:"M12 18V6",key:"zqpxq5"}],["path",{d:"M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1",key:"9jr5yi"}]]),te=w("ListOrdered",[["line",{x1:"10",x2:"21",y1:"6",y2:"6",key:"76qw6h"}],["line",{x1:"10",x2:"21",y1:"12",y2:"12",key:"16nom4"}],["line",{x1:"10",x2:"21",y1:"18",y2:"18",key:"u3jurt"}],["path",{d:"M4 6h1v4",key:"cnovpq"}],["path",{d:"M4 10h2",key:"16xx2s"}],["path",{d:"M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",key:"m9a95d"}]]),se=w("List",[["line",{x1:"8",x2:"21",y1:"6",y2:"6",key:"7ey8pc"}],["line",{x1:"8",x2:"21",y1:"12",y2:"12",key:"rjfblc"}],["line",{x1:"8",x2:"21",y1:"18",y2:"18",key:"c3b1m8"}],["line",{x1:"3",x2:"3.01",y1:"6",y2:"6",key:"1g7gq3"}],["line",{x1:"3",x2:"3.01",y1:"12",y2:"12",key:"1pjlvk"}],["line",{x1:"3",x2:"3.01",y1:"18",y2:"18",key:"28t2mc"}]]),oe=w("Mail",[["rect",{width:"20",height:"16",x:"2",y:"4",rx:"2",key:"18n3k1"}],["path",{d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7",key:"1ocrg3"}]]),re=w("RemoveFormatting",[["path",{d:"M4 7V4h16v3",key:"9msm58"}],["path",{d:"M5 20h6",key:"1h6pxn"}],["path",{d:"M13 4 8 20",key:"kqq6aj"}],["path",{d:"m15 15 5 5",key:"me55sn"}],["path",{d:"m20 15-5 5",key:"11p7ol"}]]),a="font-family:Arial,Helvetica,sans-serif;",b="#0a3d62",u=(t,s="16px 30px 4px 30px")=>`        <tr>
          <td style="padding:${s};font-size:14px;line-height:1.7;color:#1f2933;${a}">
${t}
          </td>
        </tr>`,y=t=>`<h2 style="margin:0 0 8px 0;font-size:17px;color:${b};${a}">${t}</h2>`,N=t=>`<ul style="margin:0;padding-left:20px;">
${t.map(s=>`<li style="margin-bottom:6px;">${s}</li>`).join(`
`)}
</ul>`,ne=(t,s)=>`              <tr>
                <td width="36" valign="top" style="padding:0 0 12px 0;">
                  <table cellpadding="0" cellspacing="0" border="0"><tr><td width="26" height="26" align="center" valign="middle" bgcolor="${b}" style="background:${b};color:#ffffff;font-size:13px;font-weight:bold;border-radius:13px;">${t}</td></tr></table>
                </td>
                <td valign="top" style="padding:3px 0 12px 0;font-size:14px;line-height:1.6;color:#1f2933;">${s}</td>
              </tr>`,$=(t,s)=>`        <tr>
          <td style="padding:16px 30px 4px 30px;${a}">
            ${y(t)}
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
${s.map((o,i)=>ne(i+1,o)).join(`
`)}
            </table>
          </td>
        </tr>`,D=(t,s,o="amber")=>{const i=o==="amber"?{bg:"#fff8e6",border:"#f3dca0",bar:"#f5a623",text:"#4a3b10"}:{bg:"#fdecec",border:"#f3b8b8",bar:"#d64545",text:"#5c1f1f"};return`        <tr>
          <td style="padding:4px 30px 8px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${i.bg}" style="background:${i.bg};border:1px solid ${i.border};border-left:4px solid ${i.bar};border-radius:6px;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;line-height:1.7;color:${i.text};${a}">
                  <b style="font-size:14px;">${t}</b><br>
${s.map(c=>`                  &bull; ${c}`).join(`<br>
`)}
                </td>
              </tr>
            </table>
          </td>
        </tr>`},ae=t=>`        <tr>
          <td style="padding:16px 30px 8px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f6fb" style="background:#f1f6fb;border:1px solid #d6e4f2;border-radius:8px;">
              <tr>
${t.map(([s,o])=>`                <td width="${Math.floor(100/t.length)}%" valign="top" style="padding:14px 18px;${a}">
                  <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5b7083;font-weight:bold;">${s}</div>
                  <div style="font-size:16px;color:${b};font-weight:bold;margin-top:4px;">${o}</div>
                </td>`).join(`
`)}
              </tr>
            </table>
          </td>
        </tr>`,C=t=>`        <tr>
          <td align="center" style="padding:22px 30px 8px 30px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${b}" style="background:${b};border-radius:6px;">
                  <a href="https://[your-dtms-link]" style="display:inline-block;padding:13px 34px;${a}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${t}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,M=u(`            <p style="margin:0 0 12px 0;">If you have any questions or run into any problems, just reply to this email or contact the DICT Region 10 DMS team.</p>
            <p style="margin:0;">Thank you!</p>`,"18px 30px 28px 30px"),F=t=>`<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef2f7;">${t.preheader}</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f7" style="background:#eef2f7;">
  <tr>
    <td align="center" style="padding:28px 12px;">

      <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"
             style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dde3ec;border-radius:10px;${a}">

        <tr>
          <td bgcolor="${b}" style="background:${b};padding:26px 30px;border-radius:10px 10px 0 0;${a}">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ec5e8;font-weight:bold;">${t.eyebrow}</div>
            <h1 style="margin:8px 0 4px 0;font-size:24px;line-height:1.25;color:#ffffff;${a}">${t.title}</h1>${t.subtitle?`
            <div style="font-size:13px;color:#cfe3f5;">${t.subtitle}</div>`:""}
          </td>
        </tr>

${t.rows.join(`

`)}

        <tr>
          <td bgcolor="#f6f8fb" style="background:#f6f8fb;padding:16px 30px;border-top:1px solid #dde3ec;border-radius:0 0 10px 10px;font-size:12px;line-height:1.6;color:#6b7280;${a}">
            <b style="color:#374151;">DICT Region 10 &ndash; Document Management System Team</b><br>
            dict10.dms@gmail.com
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`,z=t=>u(`            <p style="margin:0 0 12px 0;">Dear <b>{first_name}</b>,</p>
            <p style="margin:0;">${t}</p>`,"28px 30px 8px 30px"),B=t=>`<div style="font-size:12px;color:#5b7083;margin:0 0 6px 0;"><b>${t}</b></div>`,S=(t,s)=>`<td style="padding:0 6px 0 0;"><table cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${s?"#3b82f6":"#0b1220"}" style="background:${s?"#3b82f6":"#0b1220"};border:1px solid ${s?"#3b82f6":"#2a3750"};border-radius:6px;padding:5px 11px;font-size:12px;font-weight:bold;color:${s?"#ffffff":"#cbd5e1"};${a}">${t}</td></tr></table></td>`,ie=()=>u(`            ${B("1. Pick the file and tap the pages")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b1220" style="background:#0b1220;border:1px solid #1f2a3d;border-radius:12px;">
              <tr><td style="padding:16px 18px 12px 18px;${a}">
                <div style="font-size:15px;font-weight:bold;color:#ffffff;">What Juan Dela Cruz signs</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:3px;">Tick the files, then tap the pages. No pages picked = the whole file.</div>
              </td></tr>
              <tr><td style="padding:0 18px 14px 18px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f1a33" style="background:#0f1a33;border:1px solid #2b5fd9;border-radius:10px;">
                  <tr><td style="padding:12px 14px 8px 14px;${a}font-size:12px;color:#e2e8f0;">
                    <span style="display:inline-block;width:16px;height:16px;line-height:16px;text-align:center;background:#3b82f6;color:#ffffff;border-radius:3px;font-size:11px;font-weight:bold;">&#10003;</span>
                    &nbsp;<b style="color:#ffffff;">File 1</b>&nbsp; <span style="color:#94a3b8;">merged-document.pdf</span>
                    <span style="float:right;color:#94a3b8;font-size:11px;">3 pages</span>
                  </td></tr>
                  <tr><td style="padding:0 14px 12px 14px;">
                    <table cellpadding="0" cellspacing="0" border="0"><tr>${S("All pages",!1)}${S("1",!0)}${S("2",!0)}${S("3",!1)}</tr></table>
                  </td></tr>
                </table>
              </td></tr>
              <tr><td style="padding:12px 18px;border-top:1px solid #1f2a3d;${a}">
                <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="font-size:12px;color:#94a3b8;">File 1 &middot; p. 1&ndash;2</td>
                  <td align="right"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#3b82f6" style="background:#3b82f6;border-radius:8px;padding:7px 16px;font-size:12px;font-weight:bold;color:#ffffff;${a}">&#10003; Done</td></tr></table></td>
                </tr></table>
              </td></tr>
            </table>`,"8px 30px 12px 30px"),le=()=>u(`            ${B("2. What the signer sees: tap F1P2 or F1P3 to jump to that page")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dde3ec;border-radius:10px;">
              <tr><td bgcolor="#fff4e0" style="background:#fff4e0;border-bottom:1px solid #f3dca0;border-radius:10px 10px 0 0;padding:9px 14px;font-size:12px;color:#b45309;${a}">
                &#9888; Please sign File(s) # <b>1 (<u>pages 2&ndash;3</u>)</b> before submitting. Click <b>Place Signature</b> to add your signature.
              </td></tr>
              <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:9px 14px;font-size:12px;color:#5b7083;${a}">
                &lsaquo;&nbsp; Page 3 / 3 &nbsp;&rsaquo;&nbsp;&nbsp;
                <span style="display:inline-block;background:#e6f0ff;color:#2563eb;border-radius:10px;padding:2px 9px;font-size:11px;font-weight:bold;"><span style="color:#16a34a;">&#10003;</span> F1P2</span>
                <span style="display:inline-block;background:#2563eb;color:#ffffff;border-radius:10px;padding:2px 9px;font-size:11px;font-weight:bold;">F1P3</span>
                &nbsp;&nbsp;File: <span style="font-family:Consolas,monospace;color:#1f2933;">merged-document.pdf</span>
              </td></tr>
            </table>`,"4px 30px 12px 30px"),H=[{id:"dtr-update",name:"DTR update",subject:"DTMS Update: Changes to the Daily Time Record (DTR)",html:F({preheader:"There is an update on the Daily Time Record (DTR) in DTMS, effective [date]. See what changed and what you need to do.",eyebrow:"DTMS Update",title:"Changes to the Daily Time Record (DTR)",subtitle:'Effective <b style="color:#ffffff;">[date]</b>',rows:[z("Good day! We would like to let you know about an update to how the <b>Daily Time Record (DTR)</b> works in DTMS. Please take a minute to read the details below."),ae([["Effective date","[date]"],["Submission deadline","[deadline]"]]),u(`            ${y("What's new")}
${N(["[Describe the change, e.g. how DTRs are now submitted, routed or signed in DTMS]","[Second change, if any]"])}`),$("What you need to do",["Log in to DTMS.","[Step, e.g. Go to <b>Create</b> and select the DTR template.]","[Step, e.g. Submit before <b>[deadline]</b>.]"]),D("Reminders",["Check <b>My Documents</b> regularly for DTRs waiting for your signature.","Export your <b>Signature Settings</b> so you can restore them if they are ever lost.","[Any other reminder, e.g. DTRs submitted after the deadline]"]),C("Open DTMS"),M]})},{id:"signature-export",name:"Signature Settings export / import",subject:"DTMS Update: Back Up Your Signature Settings (Export / Import)",html:F({preheader:"You can now export your Signature Settings and import them back if they are ever lost.",eyebrow:"DTMS Update",title:"Back up your Signature Settings",subtitle:"New: Export &amp; Import",rows:[z("We've added a way to <b>back up and restore your signature settings</b> in DTMS. Save your signature profiles to a file, and load them back whenever you need to."),u(`            ${y("Why this matters")}
            <p style="margin:0 0 8px 0;">Your P12 certificate, signature image and stamp layout are stored in <b>your browser</b>, not on the server. They can disappear if you clear your browser data, switch to a new browser or computer, use a private window, or when your session expires.</p>
            <p style="margin:0;">With a backup, you can restore everything in seconds instead of setting it up again.</p>`),$("How to back up",["Log in to DTMS and open <b>Signature Settings</b>.","Click <b>Export</b>.","Save the downloaded file (<i>signature-settings-YYYY-MM-DD.json</i>) somewhere safe, like a flash drive."]),$("How to restore",["Open <b>Signature Settings</b> and click <b>Import</b>.","Choose your saved <i>signature-settings-&hellip;.json</i> file.","You'll see a message such as <i>Imported 1 profile</i>. Your signature is back."]),D("Important",["Keep the file private. It contains your P12 certificate and password. Do not email or share it.","Export again after you change your signature so your backup stays current.","Importing adds or updates profiles. It will not delete the ones you already have."],"red"),C("Open Signature Settings"),M]})},{id:"page-level-signing",name:"Choose which pages each signer signs",subject:"DTMS Update: Choose Which Files and Pages Each Signer Signs",html:F({preheader:"You can now pick exactly which files and pages each signer is responsible for signing.",eyebrow:"DTMS Update",title:"Choose which pages each signer signs",subtitle:"New: file and page selection per signer",rows:[z("When you send a document with several signers, you can now decide <b>which files and which pages</b> each person has to sign. No more guessing where your signature goes."),u(`            ${y("What's new")}
${N(["Pick the files <b>and the exact pages</b> each signer signs, for example <i>File 1, pages 1 and 3</i>.","It's visual: you see File 1, File 2&hellip; with their page counts and tap the pages you want. No codes to type.","Signers see right away what is theirs: a reminder such as <i>Please sign File 1 (pages 2&ndash;3)</i>, plus tappable shortcuts like <b>F1P2</b> and <b>F1P3</b> (file 1, page 2 and page 3) that jump straight to the page. A page gets a green check once it is signed.","Pages that aren't assigned to a signer can't be stamped by them, and they must sign every page assigned to them before submitting."])}`),$("How to set it up",["In <b>Create Document</b>, add your signers. (For a document you already sent, open it and click <b>Edit Routing</b>.)","Click the button on the signer's row. It says <b>All files</b> by default.","Tick the file(s) they should sign, then tap the page numbers. Leave the pages empty to mean the whole file.","Click <b>Done</b>. The button now shows what you chose, e.g. <i>File 1 &middot; p. 1, 3</i>."]),ie(),le(),D("Good to know",["Choosing pages works for <b>PDF</b> files. Other file types can only be assigned as a whole.","<b>Supporting documents</b> are not numbered and never need a signature, so they don't count as File 1, File 2&hellip;","Signers with a page limit can't use the <b>By Page</b> or <b>By File</b> batch buttons.","Leaving a signer on <b>All files</b> works exactly as before."]),u(`            ${y("Also new")}
${N(["Click a <b>follow-up document</b> in the signatories list to preview it in a pop-up window, without leaving the page. If you are also a signer there, an <b>Open document</b> button takes you to it.","A follow-up that is still being signed now shows its progress, such as <b>For Signing 2/6</b>, and the template name.","The signatories list now follows the real signing order and repeats the office name each time it changes.","Fixed: removing several signatories in <b>Edit Routing</b> could duplicate completed follow-up steps instead of removing them."])}`),C("Open DTMS"),M]})}],g=({title:t,onClick:s,children:o})=>e.jsx("button",{type:"button",title:t,onMouseDown:i=>{i.preventDefault(),s()},className:"p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",children:o}),de=({onChange:t,editorRef:s})=>{const o=(n,k)=>{var f,x;(f=s.current)==null||f.focus(),document.execCommand(n,!1,k),t(((x=s.current)==null?void 0:x.innerHTML)??"")},i=()=>{const n=window.prompt("Link address (https://…)");n&&o("createLink",/^(https?:|mailto:)/i.test(n)?n:`https://${n}`)},c=n=>o("insertText",n);return e.jsxs("div",{className:"rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary/50 transition",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border",children:[e.jsx(g,{title:"Bold",onClick:()=>o("bold"),children:e.jsx(K,{className:"w-4 h-4"})}),e.jsx(g,{title:"Italic",onClick:()=>o("italic"),children:e.jsx(Q,{className:"w-4 h-4"})}),e.jsx(g,{title:"Underline",onClick:()=>o("underline"),children:e.jsx(X,{className:"w-4 h-4"})}),e.jsx(g,{title:"Heading",onClick:()=>o("formatBlock","h2"),children:e.jsx(ee,{className:"w-4 h-4"})}),e.jsx("span",{className:"w-px h-5 bg-border mx-1"}),e.jsx(g,{title:"Bulleted list",onClick:()=>o("insertUnorderedList"),children:e.jsx(se,{className:"w-4 h-4"})}),e.jsx(g,{title:"Numbered list",onClick:()=>o("insertOrderedList"),children:e.jsx(te,{className:"w-4 h-4"})}),e.jsx(g,{title:"Add link",onClick:i,children:e.jsx(Z,{className:"w-4 h-4"})}),e.jsx(g,{title:"Clear formatting",onClick:()=>{o("removeFormat"),o("formatBlock","div")},children:e.jsx(re,{className:"w-4 h-4"})}),e.jsx("span",{className:"w-px h-5 bg-border mx-1"}),e.jsx("button",{type:"button",onMouseDown:n=>{n.preventDefault(),c("{first_name}")},title:"Insert the recipient's first name",className:"px-2 py-1 rounded-md text-xs font-mono text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",children:"{first_name}"})]}),e.jsx("div",{ref:s,contentEditable:!0,suppressContentEditableWarning:!0,onInput:n=>t(n.currentTarget.innerHTML),onPaste:n=>{n.preventDefault(),document.execCommand("insertText",!1,n.clipboardData.getData("text/plain"))},"data-placeholder":`Dear {first_name},

We've updated DTMS…`,className:"min-h-[220px] max-h-[460px] overflow-y-auto px-3 py-2.5 text-sm text-foreground focus:outline-none [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-1 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:whitespace-pre-line"})]})},pe=t=>(new DOMParser().parseFromString(t,"text/html").body.textContent??"").trim(),Ce=()=>{const[t,s]=d.useState(""),o=d.useRef(null),[i,c]=d.useState(""),[n,k]=d.useState("visual"),f=pe(i),x=f!=="";d.useEffect(()=>{n==="visual"&&o.current&&(o.current.innerHTML=i)},[n]);const[h,W]=d.useState(null),[T,L]=d.useState(null),[v,j]=d.useState(null);d.useEffect(()=>{const r=new AbortController;return P.broadcastRecipientCount(r.signal).then(W).catch(l=>{(l==null?void 0:l.code)!=="ERR_CANCELED"&&console.error(l)}),()=>r.abort()},[]);const[U,R]=d.useState(""),O=async r=>{R(r);const l=H.find(m=>m.id===r);if(l){if((t.trim()||x)&&!(await A.fire({icon:"warning",title:"Replace what you've written?",text:"Loading a template overwrites the current subject and message.",showCancelButton:!0,confirmButtonText:"Load template"})).isConfirmed){R("");return}s(l.subject),c(l.html),j(null),n==="visual"&&o.current&&(o.current.innerHTML=l.html),k("html")}},E=t.trim()!==""&&x&&!T,I=async r=>{var l,m;if(!(!r&&!(await A.fire({icon:"question",title:"Send to all users?",text:`This will email ${h??"all"} active user${h===1?"":"s"}. This can't be undone.`,showCancelButton:!0,confirmButtonText:"Yes, send"})).isConfirmed)){L(r?"test":"all"),j(null);try{const p=await P.broadcastEmail({subject:t.trim(),message:f,message_html:i,test:r});j({type:"success",text:r?"Test email is on its way to your own address.":`Sending to ${p.queued} users in the background — it may take a few minutes to finish.`}),r||(s(""),c(""),o.current&&(o.current.innerHTML=""))}catch(p){j({type:"error",text:((m=(l=p==null?void 0:p.response)==null?void 0:l.data)==null?void 0:m.detail)||(p==null?void 0:p.message)||"Failed to send."})}finally{L(null)}}};return e.jsx(q,{title:"Announcements",subtitle:"Email all users about system updates and news",children:e.jsx("div",{className:"max-w-2xl flex flex-col gap-4",children:e.jsxs("div",{className:"bg-card border border-border rounded-xl p-5 flex flex-col gap-4",children:[e.jsxs("div",{className:"flex items-center gap-2 text-sm text-muted-foreground",children:[e.jsx(Y,{className:"w-4 h-4"}),h===null?"Counting recipients…":e.jsxs(e.Fragment,{children:["Will be sent to ",e.jsx("span",{className:"font-semibold text-foreground",children:h})," active user",h===1?"":"s",", each as their own email."]})]}),e.jsxs("div",{className:"flex flex-col gap-1.5",children:[e.jsx("label",{className:"text-sm font-medium text-foreground",children:"Start from a template"}),e.jsxs("select",{value:U,onChange:r=>O(r.target.value),className:"w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition",children:[e.jsx("option",{value:"",children:"— Choose a template —"}),H.map(r=>e.jsx("option",{value:r.id,children:r.name},r.id))]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Fill in anything in [brackets], then send a test to yourself first."})]}),e.jsxs("div",{className:"flex flex-col gap-1.5",children:[e.jsx("label",{className:"text-sm font-medium text-foreground",children:"Subject"}),e.jsx("input",{value:t,maxLength:200,onChange:r=>s(r.target.value),placeholder:"e.g. DTMS system update — new features",className:"w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"})]}),e.jsxs("div",{className:"flex flex-col gap-1.5",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("label",{className:"text-sm font-medium text-foreground",children:"Message"}),e.jsx("div",{className:"inline-flex rounded-lg border border-border bg-accent/40 p-0.5 text-xs font-medium",children:["visual","html"].map(r=>e.jsx("button",{type:"button",onClick:()=>k(r),className:`px-3 py-1 rounded-md transition-colors ${n===r?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`,children:r==="visual"?"Visual":"HTML code"},r))})]}),n==="visual"?e.jsx(de,{editorRef:o,onChange:c}):e.jsx("textarea",{value:i,onChange:r=>c(r.target.value),spellCheck:!1,rows:14,placeholder:`<p>Dear {first_name},</p>
<p>We've updated DTMS…</p>`,className:"w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y transition"}),e.jsxs("p",{className:"text-xs text-muted-foreground",children:[n==="visual"?e.jsx(e.Fragment,{children:"Use the toolbar for bold, lists and links. "}):e.jsx(e.Fragment,{children:"Write the email as HTML (tables, inline styles and https images are kept; scripts are removed). "}),e.jsx("code",{className:"font-mono",children:"{first_name}"})," or ",e.jsx("code",{className:"font-mono",children:"{full_name}"})," personalize each email."]})]}),v&&e.jsxs("div",{className:`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${v.type==="success"?"border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400":"border-destructive/30 bg-destructive/10 text-destructive"}`,children:[v.type==="success"?e.jsx(V,{className:"w-4 h-4 shrink-0"}):e.jsx(G,{className:"w-4 h-4 shrink-0"}),e.jsx("span",{children:v.text})]}),e.jsxs("div",{className:"flex gap-3 sm:flex-col",children:[e.jsxs("button",{onClick:()=>I(!0),disabled:!E,className:"flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed",children:[T==="test"?e.jsx(_,{className:"w-4 h-4 animate-spin"}):e.jsx(oe,{className:"w-4 h-4"})," Send test to me"]}),e.jsxs("button",{onClick:()=>I(!1),disabled:!E,className:"flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed",children:[T==="all"?e.jsx(_,{className:"w-4 h-4 animate-spin"}):e.jsx(J,{className:"w-4 h-4"})," Send to all users"]})]})]})})})};export{Ce as default};
