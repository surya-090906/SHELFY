import { AuditPage } from './AuditView';
export { AuditPage } from './AuditView';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Sun, Moon, Monitor, Copy } from 'lucide-react';
import api from './api/client';
import { useAuthStore } from './store/useAuthStore';
import { applyPreferences, languages } from './preferences';
import {clerkEnabled} from './authConfig';
export {languages} from './preferences';
export function usePreferences() {
  const {
    i18n
  } = useTranslation();
  async function save(data) {
    const r = await api.put('/settings', data);
    useAuthStore.setState({
      user: r.data.user
    });
    localStorage.setItem('stocksense_user', JSON.stringify(r.data.user));
    applyPreferences(r.data.user);
    await i18n.changeLanguage(r.data.user.language);
    return r.data.user;
  }
  return save;
}
export function QuickPreferences() {
  const {
      t
    } = useTranslation(),
    {
      user
    } = useAuthStore(),
    save = usePreferences(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const change = async data => {
    setBusy(true);
    setError('');
    try {
      await save(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to save preferences');
    } finally {
      setBusy(false);
    }
  };
  return <><label className="ss-quick-language"><Globe size={17} /><select aria-label={t('Language')} value={user?.language || 'en'} disabled={busy} onChange={e => change({
        language: e.target.value
      })}>{languages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button className="ss-icon" aria-label={t('Toggle theme')} title={t('Toggle theme')} disabled={busy} onClick={() => change({
      theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    })}>{user?.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</button>{error && <span role="alert" className="ss-red">{t(error)}</span>}</>;
}
const Input = ({
  label,
  ...props
}) => {
  const {
    t
  } = useTranslation();
  return <label className="ss-field"><span>{t(label)}</span><input {...props} /></label>;
};
export function WorkspaceSettings({
  manager,
  warehouseContent
}) {
  const {
      t
    } = useTranslation(),
    {
      user,
      logout
    } = useAuthStore(),
    save = usePreferences(),
    [tab, setTab] = useState('general'),
    [form, setForm] = useState({
      name: user.name
    }),
    [password, setPassword] = useState({}),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  async function perform(fn) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice('Saved successfully');
    } catch (e) {
      setError(t(e.response?.data?.message || 'Unable to save preferences'));
    } finally {
      setBusy(false);
    }
  }
  const tabs = [['general', 'General'], ['language', 'Language'], ['appearance', 'Appearance'], ['warehouses', 'Warehouse & Location'], ...(manager ? [['company', 'Company'], ['audit', 'Audit Log']] : [])];
  return <><div className="ss-heading"><div><div className="ss-eyebrow">{t('YOUR WORKSPACE')}</div><h1>{t('Settings')}</h1><p>{t('A workspace that feels like yours.')}</p></div></div><div className="ss-tabs ss-settings-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => {
        setTab(id);
        setError('');
        setNotice('');
      }}>{t(label)}</button>)}</div>{error && <div className="ss-error" role="alert">{error}</div>}{notice && <div className="ss-notice" role="status">{t(notice)}</div>}
 {tab === 'general' && <div className="ss-settings-grid"><form className="ss-panel ss-form" onSubmit={e => {
        e.preventDefault();
        perform(() => save(form));
      }}><h2>{t('Profile')}</h2><Input label="Name" required value={form.name} onChange={e => setForm({
          name: e.target.value
        })} /><Input label="Email Id" value={user.email} readOnly /><Input label="Login Id" value={user.login_id} readOnly /><Input label="Role" value={t(user.role)} readOnly /><button className="ss-primary" disabled={busy}>{t('Save profile')}</button></form>{clerkEnabled?<section className="ss-panel ss-form"><h2>{t('Email verification')}</h2><p>{t('Your account uses email verification instead of a password.')}</p></section>:<form className="ss-panel ss-form" onSubmit={e => {
        e.preventDefault();
        perform(async () => {
          await api.post('/settings/password', password);
          await logout();
        });
      }}><h2>{t('Change password')}</h2>{[['current_password', 'Current password'], ['new_password', 'New Password'], ['confirm_password', 'Re-Enter Password']].map(([id, label]) => <Input key={id} label={label} type="password" required minLength={id === 'current_password' ? undefined : 8} autoComplete={id === 'current_password' ? 'current-password' : 'new-password'} value={password[id] || ''} onChange={e => setPassword(p => ({
          ...p,
          [id]: e.target.value
        }))} />)}<p>{t('Changing your password signs you out of all sessions.')}</p><button className="ss-primary" disabled={busy}>{t('Update password')}</button></form>}</div>}
 {tab === 'language' && <section className="ss-panel ss-form"><h2>{t('Choose your language')}</h2><p>{t('Your language follows you across devices.')}</p><div className="ss-language-grid">{languages.map(([id, label]) => <button key={id} className={`ss-choice ${user.language === id ? 'selected' : ''}`} aria-pressed={user.language === id} disabled={busy} onClick={() => perform(() => save({
          language: id
        }))}><Globe size={21} /><strong lang={id}>{label}</strong></button>)}</div></section>}
 {tab === 'appearance' && <section className="ss-panel ss-form"><h2>{t('Appearance')}</h2><p>{t('Choose a theme and a comfortable text size.')}</p><div className="ss-theme-grid">{[['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]].map(([id, label, Icon]) => <button key={id} className={`ss-choice ${user.theme === id ? 'selected' : ''}`} aria-pressed={user.theme === id} disabled={busy} onClick={() => perform(() => save({
          theme: id
        }))}><Icon size={28} /><strong>{t(label)}</strong></button>)}</div><label className="ss-field"><span>{t('Text size')} · {user.font_scale}%</span><input aria-label={t('Text size')} type="range" min="90" max="130" step="5" defaultValue={user.font_scale} onInput={e => applyPreferences({
          ...user,
          font_scale: Number(e.target.value)
        })} onPointerUp={e => perform(() => save({
          font_scale: Number(e.target.value)
        }))} onKeyUp={e => perform(() => save({
          font_scale: Number(e.target.value)
        }))} /></label><div className="ss-type-preview"><h2>{t('Your inventory, in view.')}</h2><p>{t('A clear picture of your company’s stock and daily operations.')}</p><button className="ss-primary" disabled>{t('Example button')}</button></div></section>}
 {tab === 'warehouses' && warehouseContent}{tab === 'company' && manager && <CompanySettings />}{tab === 'audit' && manager && <AuditPage />}</>;
}
function CompanySettings() {
  const {
      t
    } = useTranslation(),
    {
      checkAuth
    } = useAuthStore(),
    [company, setCompany] = useState(null),
    [users, setUsers] = useState([]),
    [invites, setInvites] = useState([]),
    [invite, setInvite] = useState({
      email: '',
      role: 'staff'
    }),
    [created, setCreated] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    const [c, u, i] = await Promise.all([api.get('/company'), api.get('/company/users'), api.get('/company/invites')]);
    setCompany(c.data.data);
    setUsers(u.data.data);
    setInvites(i.data.data);
  }
  useEffect(() => {
    load().catch(e => setError(e.response?.data?.message));
  }, []);
  async function act(fn) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      setNotice(t('Saved successfully'));
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to save preferences');
    } finally {
      setBusy(false);
    }
  }
  return <>{error && <div className="ss-error" role="alert">{t(error)}</div>}{notice && <div className="ss-notice" role="status">{notice}</div>}<div className="ss-settings-grid">{company && <form className="ss-panel ss-form" onSubmit={e => {
        e.preventDefault();
        act(async () => {
          await api.put('/company', company);
          await checkAuth();
        });
      }}><h2>{t('Company details')}</h2><Input label="Company name" required value={company.name} onChange={e => setCompany({
          ...company,
          name: e.target.value
        })} /><Input label="Company code" required pattern="[A-Za-z0-9_-]{2,12}" value={company.short_code} onChange={e => setCompany({
          ...company,
          short_code: e.target.value
        })} /><button className="ss-primary" disabled={busy}>{t('Save company')}</button></form>}<form className="ss-panel ss-form" onSubmit={e => {
        e.preventDefault();
        act(async () => {
          const r = await api.post('/company/invites', invite);
          setCreated(r.data.data);
        });
      }}><h2>{t('Invite a teammate')}</h2><Input label="Email restriction (optional)" type="email" value={invite.email} onChange={e => setInvite({
          ...invite,
          email: e.target.value
        })} /><label className="ss-field"><span>{t('Role')}</span><select value={invite.role} onChange={e => setInvite({
            ...invite,
            role: e.target.value
          })}><option value="staff">{t('staff')}</option><option value="manager">{t('manager')}</option></select></label><p>{t('Invitations expire in 7 days and can be used once.')}</p><button className="ss-primary" disabled={busy}>{t('Create invitation')}</button>{created && <div className="ss-invite-result"><strong>{t('Copy this link now. It is shown only once.')}</strong><input aria-label={t('Invitation link')} value={created.link} readOnly /><button type="button" className="ss-link" onClick={() => navigator.clipboard.writeText(created.link).then(() => setNotice(t('Copied'))).catch(() => setError('Select and copy the invitation link'))}><Copy size={16} />{t('Copy link')}</button></div>}</form></div><section className="ss-panel"><div className="ss-panel-title"><h2>{t('Company users')}</h2></div><div className="ss-table-wrap"><table className="ss-table"><thead><tr>{['Name', 'Email Id', 'Role'].map(k => <th key={k}>{t(k)}</th>)}</tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.name}<small>{u.login_id}</small></td><td>{u.email}</td><td><select aria-label={t('Role') + ' · ' + u.name} value={u.role} disabled={busy} onChange={e => act(() => api.put(`/company/users/${u.id}/role`, {
                  role: e.target.value
                }))}><option value="manager">{t('manager')}</option><option value="staff">{t('staff')}</option></select></td></tr>)}</tbody></table></div></section><section className="ss-panel"><div className="ss-panel-title"><h2>{t('Invitations')}</h2></div>{!invites.length && <div className="ss-empty">{t('No invitations yet')}</div>}{invites.map(i => <div className="ss-invitation ss-inline" key={i.id}><span>{i.email || t('Any email')} · {t(i.role)}</span><span>{new Date(i.expires_at).toLocaleDateString()}</span><span>{t(i.used ? 'Used or revoked' : new Date(i.expires_at) < new Date() ? 'Expired' : 'Active')}</span>{!i.used && <button className="ss-link ss-red" disabled={busy} onClick={() => act(() => api.delete(`/company/invites/${i.id}`))}>{t('Revoke')}</button>}</div>)}</section></>;
}
