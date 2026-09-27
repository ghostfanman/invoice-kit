/* Signierte Offline-Lizenzen. Kein Netzwerk und kein Zugriff auf Rechnungsdaten. */
const algorithm = {name:'ECDSA',namedCurve:'P-256'};
const signatureAlgorithm = {name:'ECDSA',hash:'SHA-256'};
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode = text => {
  if(!/^[A-Za-z0-9_-]+$/.test(text))throw new Error('Ungültige Lizenzdatei.');
  return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
};
const bytes = text => new TextEncoder().encode(text);
function validateClaims(claims, now=Date.now()) {
  if(!claims || claims.version!==1 || claims.product!=='invoice-kit-pro' || !['admin','gift'].includes(claims.role) ||
    typeof claims.id!=='string' || !/^[a-f0-9-]{36}$/.test(claims.id) || typeof claims.recipient!=='string' ||
    !claims.recipient.trim() || claims.recipient.length>120 || /[\x00-\x1f]/.test(claims.recipient) ||
    !Number.isSafeInteger(claims.issuedAt) || claims.issuedAt>now+300000 || claims.issuedAt<0 ||
    !(claims.expiresAt===null || Number.isSafeInteger(claims.expiresAt) && claims.expiresAt>claims.issuedAt))throw new Error('Lizenzinhalt ungültig.');
  if(claims.expiresAt!==null && now>=claims.expiresAt)throw new Error('Diese Pro-Lizenz ist abgelaufen.');
  return claims;
}
export async function verifyLicense(token, publicJwk, now=Date.now()) {
  try {
    if(typeof token!=='string' || token.length>8000)throw new Error();
    const [prefix,payload,signature,...rest]=token.trim().split('.');
    if(prefix!=='IKPRO1' || rest.length || !payload || !signature)throw new Error();
    const key=await crypto.subtle.importKey('jwk',publicJwk,algorithm,false,['verify']);
    if(!await crypto.subtle.verify(signatureAlgorithm,key,decode(signature),bytes(prefix+'.'+payload)))throw new Error();
    return validateClaims(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(payload))),now);
  } catch(error) {
    if(error.message==='Diese Pro-Lizenz ist abgelaufen.')throw error;
    throw new Error('Die Lizenz ist ungültig oder stammt nicht von diesem Herausgeber.');
  }
}
export async function importIssuer(privateJwk, publicJwk) {
  const key=await crypto.subtle.importKey('jwk',privateJwk,algorithm,false,['sign']);
  const verifier=await crypto.subtle.importKey('jwk',publicJwk,algorithm,false,['verify']);
  const challenge=crypto.getRandomValues(new Uint8Array(32));
  const proof=await crypto.subtle.sign(signatureAlgorithm,key,challenge);
  if(!await crypto.subtle.verify(signatureAlgorithm,verifier,proof,challenge))throw new Error('Dieser Admin-Schlüssel gehört nicht zu Invoice Kit.');
  return key;
}
export async function issueLicense(key,{recipient,role='gift',expiresAt=null},now=Date.now()) {
  const claims=validateClaims({version:1,product:'invoice-kit-pro',id:crypto.randomUUID(),recipient:String(recipient).trim(),role,issuedAt:now,expiresAt},now);
  const payload=encode(bytes(JSON.stringify(claims))),message='IKPRO1.'+payload;
  const signature=await crypto.subtle.sign(signatureAlgorithm,key,bytes(message));
  return message+'.'+encode(signature);
}
