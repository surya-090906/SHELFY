import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import api from './api/client';
export function AuditPage() {
  const {
    t
  } = useTranslation();
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    user_id: '',
    from: '',
    to: ''
  });
  const [page, setPage] = useState(1),
    [result, setResult] = useState({
      data: []
    }),
    [users, setUsers] = useState([]),
    [expanded, setExpanded] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get('/company/users').then(r => active && setUsers(r.data.data)).catch(e => active && setError(e.response?.data?.message));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setExpanded(null);
    api.get('/audit?' + new URLSearchParams({
      ...filters,
      page
    })).then(r => {
      if (active) {
        setResult(r.data);
        setError('');
      }
    }).catch(e => active && setError(e.response?.data?.message)).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filters, page]);
  const set = (k, v) => {
    setFilters(f => ({
      ...f,
      [k]: v
    }));
    setPage(1);
  };
  const toggle = id => setExpanded(old => old === id ? null : id);
  return <>
  <div className="ss-heading"><div><div className="ss-eyebrow">{t('COMPANY / ACCOUNTABILITY')}</div><h1>{t('Audit Log')}</h1><p>{t('Every change. A clear trail. Visible only to company managers.')}</p></div><Shield size={28} /></div>
  <div className="ss-toolbar"><select aria-label={t('User')} value={filters.user_id} onChange={e => set('user_id', e.target.value)}><option value="">{t('All users')}</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>{['action', 'entity_type'].map(k => <input key={k} aria-label={t(k === 'action' ? 'Action' : 'Entity')} placeholder={t(k === 'action' ? 'Filter action' : 'Filter entity')} value={filters[k]} onChange={e => set(k, e.target.value)} />)}<input aria-label={t('From date')} type="date" value={filters.from} onChange={e => set('from', e.target.value)} /><input aria-label={t('To date')} type="date" value={filters.to} onChange={e => set('to', e.target.value)} /></div>
  {error && <div role="alert" className="ss-error">{t(error)}</div>}
  <div className="ss-table-wrap"><table className="ss-table"><thead><tr>{['Date', 'User', 'Action', 'Entity', 'Changes'].map(k => <th key={k}>{t(k)}</th>)}</tr></thead><tbody>{result.data.map(a => <React.Fragment key={a.id}>
   <tr className="ss-audit-row" onClick={() => toggle(a.id)}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.user_name === 'System' ? t('System') : a.user_name}</td><td>{t(a.action.split('.')[0])} · {t(a.action.split('.')[1])}</td><td>{t(a.entity_type)} #{a.entity_id}</td><td><button className="ss-link" aria-expanded={expanded === a.id} aria-controls={'audit-diff-' + a.id} onClick={e => {
                  e.stopPropagation();
                  toggle(a.id);
                }}>{t('View changes')}</button></td></tr>
   {expanded === a.id && <tr id={'audit-diff-' + a.id}><td colSpan={5}><AuditDiff before={a.before} after={a.after} /><small>{t('IP address')}: {a.ip_address || '—'}</small></td></tr>}
  </React.Fragment>)}</tbody></table>{loading && <div className="ss-empty">{t('Loading…')}</div>}{!loading && !result.data.length && <div className="ss-empty">{t('No matching audit entries')}</div>}</div>
  <div className="ss-pagination"><button className="ss-secondary" disabled={page === 1} onClick={() => setPage(v => v - 1)}><ChevronLeft size={16} />{t('Previous')}</button><span>{page} / {result.pagination?.pages || 1} · {result.pagination?.total || 0} {t('records')}</span><button className="ss-secondary" disabled={page >= (result.pagination?.pages || 1)} onClick={() => setPage(v => v + 1)}>{t('Next')}<ChevronRight size={16} /></button></div>
 </>;
}
function AuditDiff({
  before,
  after
}) {
  const {
    t
  } = useTranslation();
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].filter(k => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  const show = v => v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
  return <table className="ss-diff"><thead><tr><th>{t('Field')}</th><th>{t('Before')}</th><th>{t('After')}</th></tr></thead><tbody>{keys.map(k => <tr key={k}><td>{t(k.replaceAll('_', ' '))}</td><td><pre>{show(before?.[k])}</pre></td><td><pre>{show(after?.[k])}</pre></td></tr>)}</tbody></table>;
}
