import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
const loaders={hi:()=>import('./locales/hi.json'),ta:()=>import('./locales/ta.json'),te:()=>import('./locales/te.json'),ml:()=>import('./locales/ml.json'),kn:()=>import('./locales/kn.json')};
let language;try{language=JSON.parse(localStorage.getItem('shelfy_preferences')||'{}').language;}catch{}
const backend={type:'backend',init(){},read(language,namespace,callback){const load=loaders[language];if(!load)return callback(null,en);load().then(module=>callback(null,module.default)).catch(error=>callback(error));}};
export const ready=i18n.use(LanguageDetector).use(backend).use(initReactI18next).init({resources:{en:{translation:en}},partialBundledLanguages:true,lng:language,fallbackLng:'en',supportedLngs:['en','hi','ta','te','ml','kn'],keySeparator:false,nsSeparator:false,interpolation:{escapeValue:false},detection:{order:['localStorage','navigator'],caches:['localStorage']}});
export default i18n;
