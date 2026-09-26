import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from './api/client';
export default function CreateCategory({
  onCreated
}) {
  const {
      t
    } = useTranslation(),
    [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/categories', {
        name
      });
      onCreated(r.data.data);
      setOpen(false);
      setName('');
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to reach the server');
    } finally {
      setBusy(false);
    }
  }
  return <div className="ss-field"><button type="button" className="ss-link" onClick={() => setOpen(v => !v)}>{t('Create category')}</button>{open && <div className="ss-inline"><input aria-label={t('Category name')} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          create();
        }
      }} /><button type="button" className="ss-secondary" disabled={busy || !name.trim()} onClick={create}>{t('Save')}</button></div>}{error && <span role="alert" className="ss-red">{t(error)}</span>}</div>;
}
