marked.setOptions({
    highlight: function(code, lang) {
         if (lang && Object.prototype.hasOwnProperty.call(Prism.languages, lang)) {
           return Prism.highlight(code, Prism.languages[lang], lang);
         }
         // Escape HTML so raw code is never rendered as markup
         var d = document.createElement('span');
         d.textContent = code;
         return d.innerHTML;
    }
 });
 marked.use({
   html: false,
   gfm: true,
   walkTokens(token) {
     if ((token.type === 'link' || token.type === 'image') && token.href) {
       const lower = token.href.trim().toLowerCase();
       if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
         token.href = '';
       }
     }
   }
 });
