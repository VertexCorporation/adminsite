// Browser rich-text editors can resolve an href placeholder as a relative
// admin URL. Only repair the known placeholder path, never arbitrary URLs.
export function normalizeVerificationLinks(html) {
    if(typeof html!=='string')return html;
    return html.replace(/(<a\b[^>]*?\bhref\s*=\s*)(["'])(.*?)\2/gi,
        (whole,prefix,quote,href)=>{
            const decoded=href.replace(/%7b/gi,'{').replace(/%7d/gi,'}');
            return /^(?:https:\/\/admin\.vertexishere\.com)?\/?\{\{verificationUrl\}\}$/.test(decoded)
                ? prefix+quote+'{{verificationUrl}}'+quote : whole;
        });
}
