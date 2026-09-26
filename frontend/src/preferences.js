export const defaultPreferences={language:'en',theme:'system',font_scale:100};
export function applyPreferences(user={}){
 const p={...defaultPreferences,...user};
 const dark=p.theme==='dark'||p.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
 document.documentElement.dataset.theme=dark?'dark':'light';
 document.documentElement.style.setProperty('--font-scale',String(p.font_scale/100));
 document.documentElement.lang=p.language;
 localStorage.setItem('shelfy_preferences',JSON.stringify({theme:p.theme,language:p.language,font_scale:p.font_scale}));
}
