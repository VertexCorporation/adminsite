// Pure, localized-client preflight. The authoritative sanitizer remains in Fulcrum.
// Validate before network preview so typing invalid content doesn't create a
// stream of avoidable HTTP 400 responses.
export function emailTemplateValidationReason(draft){
    const subject=draft?.subject,html=draft?.html;
    if(typeof subject!=='string'||!subject.trim()||subject.length>500||/[\r\n\u0000-\u001f\u007f]/.test(subject))return 'subject';
    if(typeof html!=='string'||!html.trim()||html.length>50000)return 'body';
    const valid=new Set(['recipientName','certificateName','contributionMonths','verificationUrl','formattedDate']);
    for(const value of [subject,html]){
        const remain=value.replace(/\{\{([a-zA-Z]+)\}\}/g,(_,key)=>valid.has(key)?'':'{invalid}');
        if(/[{}]/.test(remain))return 'placeholder';
    }
    for(const tag of html.matchAll(/<[^>]*>/g)){
        if(/\{\{/.test(tag[0].replace(/href\s*=\s*(["'])\{\{verificationUrl\}\}\1/gi,'')))return 'placeholder';
    }
    const tags=new Set(['div','span','p','br','strong','b','em','i','u','s','ul','ol','li','blockquote','h2','h3','a']);
    if(/<!--[\s\S]*?-->|<!|<\?|<%/.test(html))return 'format';
    const safe=html.replaceAll('{{verificationUrl}}','https://vertexishere.com/verify/__TEMPLATE_URL_PLACEHOLDER__');
    let residue=safe;
    for(const match of safe.matchAll(/<\s*(\/?)\s*([a-z][a-z0-9-]*)\b([^<>]*)>/gi)){
        const [,closing,name,raw]=match,tag=name.toLowerCase();
        if(!tags.has(tag))return 'format';
        if(closing){
            if(raw.trim())return 'format';
        }else if(tag==='a' && raw.trim()){
            const href=raw.trim().match(/^href\s*=\s*(["'])(.*?)\1\s*$/i);
            if(!href)return 'format';
            const url=href[2];
            if(!/^(https:\/\/|mailto:)/i.test(url)||/[\u0000-\u0020\u007f]/.test(url)){
                return 'link';
            }
            // The server also parses the URL; this light preflight avoids a network 400.
            if(/^https:\/\//i.test(url) && !/^https:\/\/[^\/?#\s]+\.[^\/?#\s]+/i.test(url) &&
               !/^https:\/\/localhost(?::\d+)?(?:[/?#]|$)/i.test(url))return 'link';
            if(/^mailto:/i.test(url) && !/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+/i.test(url))return 'link';
        }else if(raw.trim() && !(tag==='br' && raw.trim()==='/'))return 'format';
        residue=residue.replace(match[0],'');
    }
    if(/[<>]/.test(residue))return 'format';
    if(!html.replace(/<[^>]*>/g,'').trim())return 'body';
    return null;
}
