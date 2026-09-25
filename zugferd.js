/* Invoice Kit – ZUGFeRD 2.3 / Factur-X 1.07 (Profil EN 16931) als PDF/A-3b
   Benötigt: vendor/pdf-lib.min.js, vendor/fontkit.umd.min.js, vendor/fonts.js
   Nutzt aus index.html: view(), buildXML(), state-Objekt s */
async function buildZugferd(s){
  const {PDFDocument,PDFName,PDFString,PDFHexString,AFRelationship,rgb}=PDFLib;
  const b64=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
  const v=view(s), xml=buildXML(s,"en16931");
  const now=new Date(Math.floor(Date.now()/1000)*1000);

  const doc=await PDFDocument.create({updateMetadata:false});
  doc.registerFontkit(fontkit);
  const reg=await doc.embedFont(b64(IK_ASSETS.regular),{subset:true});
  const bold=await doc.embedFont(b64(IK_ASSETS.bold),{subset:true});
  const known=new Set(reg.getCharacterSet());
  const safe=str=>Array.from(String(str??"")).map(ch=>ch==="\n"||known.has(ch.codePointAt(0))?ch:"?").join("");

  /* ---------- Layout ---------- */
  const W=595.28,H=841.89,M=50,CW=W-2*M,FOOT=70;
  const ink=rgb(0.07,0.07,0.07),grey=rgb(0.35,0.35,0.35),line=rgb(0.8,0.8,0.8);
  let page,y;
  const pages=[];
  const newPage=()=>{page=doc.addPage([W,H]);pages.push(page);y=H-M};
  const width=(t,f,sz)=>f.widthOfTextAtSize(safe(t),sz);
  const wrap=(t,f,sz,maxW)=>{const out=[];
    for(const para of safe(t).split("\n")){let cur="";
      for(const word of para.split(/\s+/).filter(Boolean)){
        let w=word;
        while(width(w,f,sz)>maxW){let i=w.length;while(i>1&&width(w.slice(0,i),f,sz)>maxW)i--;
          if(cur){out.push(cur);cur=""}out.push(w.slice(0,i));w=w.slice(i)}
        const cand=cur?cur+" "+w:w;
        if(width(cand,f,sz)<=maxW)cur=cand;else{out.push(cur);cur=w}}
      out.push(cur)}
    return out};
  const text=(t,x,yy,{f=reg,sz=9.5,c=ink,align="left",w=0}={})=>{
    const str=safe(t),tw=f.widthOfTextAtSize(str,sz);
    const xx=align==="right"?x+w-tw:align==="center"?x+(w-tw)/2:x;
    page.drawText(str,{x:xx,y:yy,size:sz,font:f,color:c})};
  const need=h=>{if(y-h<M+FOOT){newPage();return true}return false};
  const para=(t,{f=reg,sz=9.5,c=ink,w=CW,x=M,gap=4}={})=>{
    for(const l of wrap(t,f,sz,w)){need(sz*1.35);text(l,x,y-sz,{f,sz,c});y-=sz*1.35}y-=gap};

  newPage();
  /* Kopf: Titel + Metadaten links, Absender rechts */
  const topY=y;
  text(v.title,M,y-22,{f:bold,sz:22});y-=32;
  if(v.corrRef){text(v.corrRef,M,y-9.5);y-=14}
  for(const [k,x] of v.meta){text(`${k}: ${x}`,M,y-9.5);y-=13.5}
  let ry=topY;
  v.seller.forEach((l,i)=>{text(l,M,ry-9.5,{f:i?reg:bold,align:"right",w:CW});ry-=13.5});
  y=Math.min(y,ry)-22;
  /* Empfänger */
  v.buyer.forEach((l,i)=>{text(l,M,y-9.5,{f:i?reg:bold});y-=13.5});
  y-=18;

  /* Positionstabelle */
  const hasVat=v.head.length===5;
  const fixed=hasVat?[62,78,42,84]:[70,84,90];
  const descW=CW-fixed.reduce((a,b)=>a+b,0);
  const colW=[descW,...fixed], colX=colW.map((_,i)=>M+colW.slice(0,i).reduce((a,b)=>a+b,0));
  const header=()=>{v.head.forEach((h,i)=>text(h,colX[i]+(i?0:2),y-9.5,{f:bold,align:i?"right":"left",w:colW[i]-4}));
    y-=15;page.drawLine({start:{x:M,y},end:{x:M+CW,y},thickness:1.2,color:ink});y-=4};
  header();
  for(const r of v.rows){
    const dl=wrap(r[0],reg,9.5,descW-8),h=dl.length*13+6;
    if(need(h))header();
    dl.forEach((l,j)=>text(l,colX[0]+2,y-10.5-j*13));
    r.slice(1).forEach((c,i)=>text(c,colX[i+1],y-10.5,{align:"right",w:colW[i+1]-4}));
    y-=h;page.drawLine({start:{x:M,y},end:{x:M+CW,y},thickness:0.5,color:line})}
  y-=14;

  /* Summen */
  const TW=250,TX=M+CW-TW;
  need(15*(v.totalsRows.length+3));
  for(const [k,x] of v.totalsRows){text(k,TX,y-9.5);text(x,TX,y-9.5,{align:"right",w:TW});y-=14}
  page.drawLine({start:{x:TX,y:y-1},end:{x:M+CW,y:y-1},thickness:1.2,color:ink});y-=6;
  text(v.grand[0],TX,y-12,{f:bold,sz:12});text(v.grand[1],TX,y-12,{f:bold,sz:12,align:"right",w:TW});y-=20;
  if(v.fxRow){text(v.fxRow[0],TX,y-9.5,{c:grey});text(v.fxRow[1],TX,y-9.5,{c:grey,align:"right",w:TW});y-=14}
  y-=12;

  /* Pflichthinweise, Zahlung, QR-Code, Notiz */
  for(const l of v.legal)para(l,{f:bold});
  const QR=92;
  const m=v.qr?qrMatrix(v.qr):null;
  if(m){
    need(QR+24);const top=y,n=m.length,cell=QR/(n+2),x0=M+CW-QR;
    page.drawRectangle({x:x0,y:top-QR,width:QR,height:QR,color:rgb(1,1,1)});
    m.forEach((row,r)=>row.forEach((d,c)=>{if(d)page.drawRectangle({x:x0+(c+1)*cell,y:top-(r+2)*cell,width:cell,height:cell,color:rgb(0,0,0)})}));
    wrap(v.qrLabel,reg,7,QR).forEach((l,j)=>text(l,x0,top-QR-9-j*8.5,{sz:7,c:grey,align:"center",w:QR}));
    para(v.payText,{w:CW-QR-20});
    if(v.note)para(v.note,{w:CW-QR-20});
    y=Math.min(y,top-QR-30);
  }else{para(v.payText);if(v.note)para(v.note)}

  /* Fußzeile + Seitenzahl auf jeder Seite */
  pages.forEach((p,i)=>{page=p;let fy=M+FOOT-18;
    page.drawLine({start:{x:M,y:fy+10},end:{x:M+CW,y:fy+10},thickness:0.5,color:line});
    for(const f of v.foot)for(const l of wrap(f,reg,7.5,CW-40)){text(l,M,fy,{sz:7.5,c:grey});fy-=10}
    text(`${i+1} / ${pages.length}`,M,M+FOOT-18,{sz:7.5,c:grey,align:"right",w:CW})});

  /* ---------- PDF/A-3b + Factur-X ---------- */
  const title=`${v.title} ${s.num}`, author=s.from, subject=`${v.title} ${s.num} – ${s.to}`, producer="Invoice Kit (pdf-lib)", creator="Invoice Kit";
  doc.setTitle(title);doc.setAuthor(author);doc.setSubject(subject);doc.setProducer(producer);doc.setCreator(creator);
  doc.setCreationDate(now);doc.setModificationDate(now);doc.setLanguage(v.loc);

  const xmlBytes=new TextEncoder().encode(xml);
  await doc.attach(xmlBytes,"factur-x.xml",{mimeType:"text/xml",description:"Factur-X/ZUGFeRD invoice (EN 16931)",
    creationDate:now,modificationDate:now,afRelationship:AFRelationship.Alternative});

  const x=t=>String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
  const iso=now.toISOString().replace(/\.\d{3}Z$/,"Z");
  const prop=(n,d)=>`<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${n}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${d}</pdfaProperty:description></rdf:li>`;
  const xmp=`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>application/pdf</dc:format>
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${x(title)}</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>${x(author)}</rdf:li></rdf:Seq></dc:creator>
<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${x(subject)}</rdf:li></rdf:Alt></dc:description></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${x(producer)}</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>${x(creator)}</xmp:CreatorTool><xmp:CreateDate>${iso}</xmp:CreateDate><xmp:ModifyDate>${iso}</xmp:ModifyDate><xmp:MetadataDate>${iso}</xmp:MetadataDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>
${prop("DocumentFileName","The name of the embedded XML document")}
${prop("DocumentType","The type of the hybrid document in capital letters, e.g. INVOICE or ORDER")}
${prop("Version","The actual version of the standard applying to the embedded XML document")}
${prop("ConformanceLevel","The conformance level of the embedded XML document")}
</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const xmpBytes=new TextEncoder().encode(xmp);
  const ctx=doc.context;
  const metaRef=ctx.register(ctx.stream(xmpBytes,{Type:"Metadata",Subtype:"XML",Length:xmpBytes.length}));
  doc.catalog.set(PDFName.of("Metadata"),metaRef);

  const icc=b64(IK_ASSETS.icc);
  const iccRef=ctx.register(ctx.stream(icc,{N:3,Length:icc.length}));
  const oi=ctx.obj({Type:"OutputIntent",S:"GTS_PDFA1",OutputConditionIdentifier:PDFString.of("sRGB IEC61966-2.1"),
    RegistryName:PDFString.of("http://www.color.org"),Info:PDFString.of("sRGB IEC61966-2.1"),DestOutputProfile:iccRef});
  doc.catalog.set(PDFName.of("OutputIntents"),ctx.obj([ctx.register(oi)]));

  const rnd=crypto.getRandomValues(new Uint8Array(16));
  const hex=Array.from(rnd,b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
  ctx.trailerInfo.ID=ctx.obj([PDFHexString.of(hex),PDFHexString.of(hex)]);

  return await doc.save({useObjectStreams:false});
}
