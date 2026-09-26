import CreateCategory from './CreateCategory';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Package, LayoutDashboard, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, History, Settings, Plus, Search, List, Columns3, X, LogOut, ChevronRight, RefreshCw, Printer, Check, Bell } from 'lucide-react';
import api from './api/client';
import { useAuthStore } from './store/useAuthStore';
import './stocksense.css';
import Auth from './ShelfyAuth';
import { WorkspaceSettings, AuditPage, QuickPreferences } from './WorkspaceSettings';
import { applyPreferences } from './preferences';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
const t = (key, options) => i18n.t(key, options);
const date = value => value ? new Date(value).toLocaleDateString(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
}) : '—';
const loc = l => l ? `${l.warehouse?.short_code || ''}/${l.short_code}` : '—';
const message = e => t(e.response?.data?.message || e.message || t("Unable to reach the server"));
const today = () => new Date().toISOString().slice(0, 10);
const Badge = ({
  status
}) => <span className={`ss-badge ${status}`}>{t(status)}</span>;
const Field = ({
  label,
  children
}) => <label className="ss-field"><span>{t(label)}</span>{children}</label>;
const ErrorBox = ({
  error
}) => error ? <div role="alert" className="ss-error">{t(error)}</div> : null;
function Modal({
  title,
  onClose,
  children
}) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    ref.current?.showModal();
    return () => old?.focus?.();
  }, []);
  return <dialog ref={ref} className="ss-modal" onCancel={onClose}><div className="ss-modal-head"><h2>{t(title)}</h2><button aria-label={t("Close dialog")} className="ss-icon" onClick={onClose}><X size={20} /></button></div>{children}</dialog>;
}
function useData(path, revision = 0) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(path).then(r => {
      if (active) {
        setData(r.data.data);
        setError('');
      }
    }).catch(e => active && setError(message(e))).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, revision, version]);
  return {
    data,
    error,
    loading,
    reload
  };
}
function Collection({
  rows,
  columns,
  groups,
  groupBy = 'status',
  title,
  subtitle,
  action,
  onOpen,
  loading,
  error,
  search,
  setSearch,
  extra
}) {
  const [view, setView] = useState('list');
  return <><div className="ss-heading"><div><div className="ss-eyebrow">{t('WORKSPACE /')}{' '}{title.toUpperCase()}</div><h1>{t(title)}</h1><p>{t(subtitle)}</p></div>{action}</div>
    <div className="ss-toolbar"><label className="ss-search"><Search size={17} /><input aria-label={t("Search {{v0}}", {
          v0: t(title)
        })} placeholder={[t("Products"), t("Warehouses"), t("Locations")].includes(title) ? t("Search by name or code\u2026") : t("Search by reference or contact\u2026")} value={search} onChange={e => setSearch(e.target.value)} /></label>{extra}<span className="ss-count">{rows.length}{' '}{t("records")}</span><div className="ss-view" aria-label={t("View")}><button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} />{t("List")}</button><button aria-pressed={view === 'kanban'} onClick={() => setView('kanban')}><Columns3 size={16} />{t("Kanban")}</button></div></div>
    <ErrorBox error={error} />{loading ? <div className="ss-empty">{t("Loading inventory\u2026")}</div> : view === 'list' ? <div className="ss-table-wrap"><table className="ss-table"><thead><tr>{columns.map(c => <th key={c.key}>{t(c.label)}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id ?? i} className={r.direction?'ss-move-'+r.direction:undefined}>{columns.map((c, n) => <td key={c.key}>{n === 0 && onOpen ? <button className="ss-link" onClick={() => onOpen(r)}>{c.render ? c.render(r) : r[c.key]}</button> : c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody></table>{!rows.length && <div className="ss-empty"><Package size={28} /><h3>{t("No records found")}</h3><p>{t("Create a record or try another search.")}</p></div>}</div> : <div className="ss-board">{groups.map(g => <section className="ss-lane" key={g}><h3><Badge status={g} /><span>{rows.filter(r => r[groupBy] === g).length}</span></h3>{rows.filter(r => r[groupBy] === g).map(r => <article key={r.id} className={'ss-card '+(r.direction?'ss-move-'+r.direction:'')}>{columns.map((c, i) => <div key={c.key}>{i === 0 ? onOpen ? <button className="ss-link" onClick={() => onOpen(r)}>{c.render ? c.render(r) : r[c.key]}</button> : <strong>{c.render ? c.render(r) : r[c.key]}</strong> : <div className="ss-card-field"><span>{t(c.label)}</span>{c.render ? c.render(r) : r[c.key]}</div>}</div>)}</article>)}{!rows.some(r => r[groupBy] === g) && <p className="ss-lane-empty">{t("No")}{t(g)}{' '}{t("records")}</p>}</section>)}</div>}</>;
}
function Dashboard({
  revision,
  navigate
}) {
  const {
    data,
    loading,
    error
  } = useData('/dashboard/stats', revision);
  const products = useData('/products', revision);
  const moves = useData('/move-history', revision);
  return <><div className="ss-heading"><div><div className="ss-eyebrow">{t("YOUR INVENTORY AT A GLANCE")}</div><h1>{t("Overview")}</h1><p>{t("Keep operations moving. Know what needs your attention.")}</p></div><span className="ss-date">{date(new Date())}</span></div><ErrorBox error={error} />
    <div className="ss-kpis">{[['receipts', t("Receipts"), t("to receive"), ArrowDownLeft], ['deliveries', t("Deliveries"), t("to deliver"), ArrowUpRight]].map(([key, title, text, Icon]) => <section className="ss-kpi" key={key}><div><span className={`ss-tile ${key}`}><Icon size={22} /></span><span>{t(title)}</span><button className="ss-icon" aria-label={t("View {{v0}}", {
            v0: t(title)
          })} onClick={() => navigate(key)}><ChevronRight size={18} /></button></div><h2>{loading ? '…' : data?.[key]?.count ?? '—'} <span>{text}</span></h2><footer><span className="ss-late">{data?.[key]?.late ?? 0}{' '}{t('Late')}</span><span>{data?.[key]?.waiting ?? 0}{' '}{t('Waiting')}</span><span>{data?.[key]?.operations ?? 0}{' '}{t('Operations')}</span></footer></section>)}<section className="ss-kpi ss-summary"><Package size={24} /><h2>{data?.products ?? '—'}<span>{t("products in your catalog")}</span></h2><p>{t('Across')}{' '}{data?.warehouses ?? '—'}{' '}{t('warehouses')}</p><button className="ss-link" onClick={() => navigate('products')}>{t("Explore products")}<ChevronRight size={14} /></button></section></div>
    <div className="ss-dashboard-grid"><section className="ss-panel"><div className="ss-panel-title"><h2>{t("Recent movements")}</h2><button className="ss-link" onClick={() => navigate('move-history')}>{t("View all")}<ChevronRight size={14} /></button></div><ErrorBox error={moves.error} />{moves.loading ? <div className="ss-empty">{t("Loading\u2026")}</div> : !moves.data?.length ? <div className="ss-empty">{t("Your validated movements will appear here.")}</div> : moves.data.slice(0, 6).map(m => <div className="ss-activity" key={m.id}><span className={`ss-tile ${m.direction === 'in' ? 'receipts' : 'deliveries'}`}>{m.direction === 'in' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div><strong>{m.product.name}</strong><small>{m.reference} · {date(m.date)}</small></div><b className={m.direction === 'in' ? 'ss-green' : 'ss-red'}>{m.direction === 'in' ? '+' : '−'}{m.quantity}</b></div>)}</section><section className="ss-panel"><div className="ss-panel-title"><h2>{t("Needs attention")}</h2><Bell size={18} /></div><ErrorBox error={products.error} />{products.data?.filter(p => p.stock_status !== 'in_stock').map(p => <div key={p.id} className="ss-attention"><div><strong>{p.name}</strong><small>{p.sku}</small></div><Badge status={p.stock_status} /><b>{p.on_hand} <small>{t("on hand")}</small></b></div>)}{products.data && !products.data.some(p => p.stock_status !== 'in_stock') && <div className="ss-empty"><Check />{t("All products are above their reorder threshold.")}</div>}<div className="ss-tip">{t("A little planning goes a long way.")}<p>{t("Review low stock before preparing your next delivery.")}</p><button className="ss-link" onClick={() => navigate('receipts')}>{t("Plan a receipt")}<ChevronRight size={14} /></button></div></section></div>
  </>;
}
function ProductForm({
  onClose,
  onSave,
  revision,
  existing
}) {
  const categories = useData('/categories', revision),
    locations = useData('/locations', revision);
  const [form, setForm] = useState(existing || {
    name: '',
    sku: '',
    category_id: '',
    unit_of_measure: 'units',
    per_unit_cost: 0,
    quantity: 0,
    location_id: ''
  });
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const field = (key, label, type = 'text') => <Field label={t(label)}><input required type={type} min={type === 'number' ? 0 : undefined} step="any" value={form[key]} onChange={e => setForm({
      ...form,
      [key]: e.target.value
    })} /></Field>;
  return <Modal title={existing ? t("Edit product") : t("New product")} onClose={onClose}><form className="ss-form" onSubmit={async e => {
      e.preventDefault();
      setBusy(true);
      try {
        const r = existing ? await api.put(`/products/${existing.id}`, form) : await api.post('/products', form);
        onSave(r.data.data);
      } catch (e) {
        setError(message(e));
      } finally {
        setBusy(false);
      }
    }}><ErrorBox error={error || categories.error || locations.error} /><div className="ss-form-grid">{field('name', t("Product name"))}{field('sku', t("SKU"))}<Field label={t("Category")}><select required value={form.category_id} onChange={e => setForm({
            ...form,
            category_id: e.target.value
          })}><option value="">{t("Choose category")}</option>{categories.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><CreateCategory onCreated={category=>{categories.reload();setForm(f=>({...f,category_id:category.id}));}}/>{field('unit_of_measure', t("Unit of measure"))}{field('per_unit_cost', t("Per unit cost"), 'number')}{!existing && <>{field('quantity', t("Initial quantity (optional)"), 'number')}<Field label={t("Initial stock location")}><select required={Number(form.quantity) > 0} value={form.location_id} onChange={e => setForm({
              ...form,
              location_id: e.target.value
            })}><option value="">{t("Choose location")}</option>{locations.data?.map(l => <option key={l.id} value={l.id}>{loc(l)}</option>)}</select></Field></>}</div><div className="ss-actions"><button type="button" className="ss-secondary" onClick={onClose}>{t("Cancel")}</button><button className="ss-primary" disabled={busy}>{t("Save product")}</button></div></form></Modal>;
}
function Products({
  revision,
  manager
}) {
  const [search, setSearch] = useState(''),
    [form, setForm] = useState(null),
    [adjust, setAdjust] = useState(null),
    [count, setCount] = useState(''),
    [location, setLocation] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const products = useData(`/products?search=${encodeURIComponent(search)}`, revision),
    locations = useData('/locations', revision);
  return <><Collection title={t("Products")} subtitle={t("Your catalog, availability and stock counts in one place.")} rows={products.data || []} loading={products.loading} error={products.error} search={search} setSearch={setSearch} groups={['in_stock', 'low_stock', 'out_of_stock']} groupBy="stock_status" action={manager && <button className="ss-primary" onClick={() => setForm({})}><Plus size={17} />{t("New Product")}</button>} columns={[{
      key: 'name',
      label: t("Product"),
      render: p => <div className="ss-product"><span className="ss-product-icon"><Package size={18} /></span><div><strong>{p.name}</strong><small>{p.sku} · {p.category?.name}</small></div></div>
    }, {
      key: 'per_unit_cost',
      label: t("Per Unit Cost"),
      render: p => Number(p.per_unit_cost).toFixed(2)
    }, {
      key: 'on_hand',
      label: t("On Hand")
    }, {
      key: 'free_to_use',
      label: t("Free to Use")
    }, {
      key: 'stock_status',
      label: t("Status"),
      render: p => <Badge status={p.stock_status} />
    }, ...(manager ? [{
      key: 'actions',
      label: t("Actions"),
      render: p => <div className="ss-inline"><button className="ss-link" onClick={() => setForm(p)}>{t("Edit")}</button><button className="ss-link" onClick={() => {
          setAdjust(p);
          setCount('');
          setLocation('');
          setError('');
        }}>{t("Update stock")}</button></div>
    }] : [])]} />
    {form && <ProductForm revision={revision} existing={form.id ? form : null} onClose={() => setForm(null)} onSave={() => {
      setForm(null);
      products.reload();
    }} />} {adjust && <Modal title={t("Update stock \xB7 {{v0}}", {
      v0: adjust.name
    })} onClose={() => setAdjust(null)}><form className="ss-form" onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.post(`/products/${adjust.id}/stock-update`, {
            location_id: location,
            counted_quantity: count
          });
          setAdjust(null);
          products.reload();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}><p>{t("Enter the physical quantity counted at this location.")}</p><ErrorBox error={error} /><Field label={t("Location")}><select required value={location} onChange={e => setLocation(e.target.value)}><option value="">{t("Select location")}</option>{locations.data?.map(l => <option key={l.id} value={l.id}>{loc(l)}</option>)}</select></Field><Field label={t("Counted quantity")}><input required type="number" min="0" step="any" value={count} onChange={e => setCount(e.target.value)} /></Field><div className="ss-actions"><button className="ss-primary" disabled={busy}>{t("Save stock count")}</button></div></form></Modal>}</>;
}
function Documents({
  incoming,
  revision,
  manager
}) {
  const endpoint = incoming ? 'receipts' : 'deliveries',
    title = incoming ? t("Receipts") : t("Deliveries");
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [selected, setSelected] = useState(null),
    [newWarehouse, setNewWarehouse] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const docs = useData(`/${endpoint}?search=${encodeURIComponent(search)}&status=${status}`, revision),
    warehouses = useData('/warehouses', revision);
  const groups = incoming ? ['draft', 'ready', 'done', 'canceled'] : ['draft', 'waiting', 'ready', 'done', 'canceled'];
  return <><Collection title={t(title)} subtitle={incoming ? t("Plan incoming stock and receive it with confidence.") : t("Prepare orders, check availability and dispatch.")} rows={docs.data || []} loading={docs.loading} error={docs.error || error} search={search} setSearch={setSearch} groups={groups} onOpen={setSelected} action={<button className="ss-primary" onClick={() => setNewWarehouse('')}><Plus size={17} />{t('New')}{' '}{incoming ? t("Receipt") : t("Delivery")}</button>} extra={<select aria-label={t("Filter status")} value={status} onChange={e => setStatus(e.target.value)}><option value="">{t("All statuses")}</option>{groups.map(s => <option key={s} value={s}>{t(s)}</option>)}</select>} columns={[{
      key: 'reference',
      label: t("Reference")
    }, {
      key: 'from',
      label: t("From"),
      render: d => incoming ? d.supplier_name || '—' : loc(d.items[0]?.location)
    }, {
      key: 'to',
      label: t("To"),
      render: d => incoming ? loc(d.items[0]?.location) : d.customer_ref || '—'
    }, {
      key: 'contact',
      label: t("Contact"),
      render: d => d.contact || '—'
    }, {
      key: 'schedule_date',
      label: t("Schedule Date"),
      render: d => date(d.schedule_date)
    }, {
      key: 'status',
      label: t("Status"),
      render: d => <Badge status={d.status} />
    }]} />
    {newWarehouse !== null && <Modal title={t("New {{v0}}", {
      v0: incoming ? 'receipt' : 'delivery'
    })} onClose={() => setNewWarehouse(null)}><form className="ss-form" onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const r = await api.post(`/${endpoint}`, {
            warehouse_id: Number(newWarehouse)
          });
          setSelected(r.data.data);
          setNewWarehouse(null);
          docs.reload();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}><ErrorBox error={error || warehouses.error} /><Field label={t("Warehouse")}><select required value={newWarehouse} onChange={e => setNewWarehouse(e.target.value)}><option value="">{t("Choose warehouse")}</option>{warehouses.data?.map(w => <option key={w.id} value={w.id}>{w.short_code} · {w.name}</option>)}</select></Field><p>{t("A reference will be assigned when you create the draft.")}</p><div className="ss-actions"><button className="ss-primary" disabled={busy}>{t("Create draft")}</button></div></form></Modal>}
    {selected && <DocumentDetail key={selected.id} initial={selected} incoming={incoming} revision={revision} manager={manager} onClose={() => {
      setSelected(null);
      docs.reload();
    }} />}</>;
}
function DocumentDetail({
  initial,
  incoming,
  revision,
  manager,
  onClose
}) {
  const [doc, setDoc] = useState(initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [short, setShort] = useState([]),
    [productForm, setProductForm] = useState(false);
  const products = useData('/products', revision),
    locations = useData('/locations', revision);
  const endpoint = incoming ? 'receipts' : 'deliveries',
    qty = incoming ? 'quantity_expected' : 'quantity',
    party = incoming ? 'supplier_name' : 'customer_ref';
  const editable = doc.status === 'draft',
    terminal = ['done', 'canceled'].includes(doc.status);
  useEffect(() => {
    if (editable) return;
    let active = true;
    api.get(`/${endpoint}/${initial.id}`).then(r => active && setDoc(r.data.data)).catch(e => active && setError(message(e)));
    return () => {
      active = false;
    };
  }, [revision, endpoint, initial.id, editable]);
  const set = (key, value) => setDoc(d => ({
    ...d,
    [key]: value
  }));
  const updateLine = (index, key, value) => setDoc(d => ({
    ...d,
    items: d.items.map((l, i) => i === index ? {
      ...l,
      [key]: value
    } : l)
  }));
  async function save() {
    const body = {
      [party]: doc[party],
      contact: doc.contact,
      responsible: doc.responsible,
      schedule_date: doc.schedule_date,
      delivery_address: doc.delivery_address,
      operation_type: doc.operation_type,
      items: doc.items
    };
    return (await api.put(`/${endpoint}/${doc.id}`, body)).data.data;
  }
  async function act(action) {
    setBusy(true);
    setError('');
    setShort([]);
    try {
      if (editable && action !== 'cancel') {
        const updated = await save();
        setDoc(updated);
        if (action === 'save') return;
      }
      const r = await api.post(`/${endpoint}/${doc.id}/${action}`);
      setDoc(r.data.data);
      setShort(r.data.insufficientItems || []);
      if (r.data.insufficientItems?.length) setError(r.data.message);
    } catch (e) {
      setError(message(e));
      if (e.response?.data?.data) setDoc(e.response.data.data);
      setShort(e.response?.data?.insufficientItems || []);
    } finally {
      setBusy(false);
    }
  }
  const textField = (key, label, type = 'text', props = {}) => <Field label={label}><input disabled={!editable} type={type} value={type === 'date' ? doc[key]?.slice(0, 10) || today() : doc[key] || ''} onChange={e => set(key, e.target.value)} {...props} /></Field>;
  return <Modal title={doc.reference} onClose={onClose}><div className="ss-form ss-document"><div className="ss-document-bar"><div className="ss-inline"><Badge status={doc.status} /><span>{incoming ? t("Receipt") : t(doc.operation_type)}</span></div><div className="ss-inline ss-no-print"><button className="ss-secondary" disabled={doc.status !== 'done'} onClick={() => window.print()}><Printer size={15} />{t("Print")}</button>{!terminal && <button className="ss-danger" disabled={busy} onClick={() => act('cancel')}>{t("Cancel document")}</button>}</div></div><div className="ss-steps">{(incoming ? ['draft', 'ready', 'done'] : ['draft', 'waiting', 'ready', 'done']).map(s => <span key={s} className={doc.status === s ? 'active' : ''}>{t(s)}<ChevronRight size={15} /></span>)}</div><ErrorBox error={error || products.error || locations.error} /><div className="ss-form-grid">{textField(party, incoming ? t("Receive From") : t("Customer"), 'text', {
          list: 'ss-contacts'
        })}<datalist id="ss-contacts"><option value="Apex Electronics" /><option value="Packwell Supplies" /><option value="Acme Studios" /></datalist>{textField('contact', t("Contact"))}{textField('responsible', t("Responsible"))}{textField('schedule_date', t("Schedule Date"), 'date')}{!incoming && <>{textField('delivery_address', t("Delivery Address"))}{textField('operation_type', t("Operation Type"))}</>}</div><div className="ss-panel-title"><h3>{t("Products")}<span className="ss-muted">{t("(")}{doc.items.length}{t(")")}</span></h3>{editable && <div className="ss-inline ss-no-print"><button className="ss-link" onClick={() => set('items', [...doc.items, {
            product_id: '',
            location_id: '',
            [qty]: 1
          }])}><Plus size={15} />{t("Add New Product")}</button>{manager && <button className="ss-link" onClick={() => setProductForm(true)}>{t("Create product")}</button>}</div>}</div><div className="ss-table-wrap"><table className="ss-table"><thead><tr><th>{t("Product")}</th><th>{t("Location")}</th><th>{t("Quantity")}</th>{editable && <th />}</tr></thead><tbody>{doc.items.map((line, i) => {
              const shortage = short.find(s => s.product_id === Number(line.product_id) && s.location_id === Number(line.location_id));
              return <tr key={line.id || `new-${i}`} className={shortage ? 'ss-short' : ''} title={shortage ? t('Insufficient stock. Delivery is Waiting.') : undefined}><td>{editable ? <select aria-label={t("Product line {{v0}}", {
                    v0: i + 1
                  })} value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}><option value="">{t("Choose product")}</option>{products.data?.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select> : line.product?.name}{shortage && <small className="ss-red">{t('Need')}{' '}{shortage.requested}{t('; available')}{' '}{shortage.available}</small>}</td><td>{editable ? <select aria-label={t("Location line {{v0}}", {
                    v0: i + 1
                  })} value={line.location_id} onChange={e => updateLine(i, 'location_id', e.target.value)}><option value="">{t("Choose location")}</option>{locations.data?.filter(l => l.warehouse_id === doc.warehouse_id).map(l => <option key={l.id} value={l.id}>{loc(l)}</option>)}</select> : loc(line.location)}</td><td>{editable ? <input aria-label={t("Quantity line {{v0}}", {
                    v0: i + 1
                  })} type="number" min="0.01" step="any" value={line[qty]} onChange={e => updateLine(i, qty, e.target.value)} /> : line[qty]}</td>{editable && <td><button className="ss-icon" aria-label={t("Remove line {{v0}}", {
                    v0: i + 1
                  })} onClick={() => set('items', doc.items.filter((_, n) => n !== i))}><X size={16} /></button></td>}</tr>;
            })}</tbody></table>{!doc.items.length && <div className="ss-empty">{t("Add products to prepare this document.")}</div>}</div><div className="ss-actions ss-no-print">{editable && <button className="ss-secondary" disabled={busy} onClick={() => act('save')}>{t("Save draft")}</button>}{!terminal && <button className="ss-primary" disabled={busy} onClick={() => act(doc.status === 'ready' ? 'validate' : 'advance')}>{busy ? t("Saving\u2026") : doc.status === 'draft' ? t("To Do") : doc.status === 'waiting' ? t("Check availability") : t("Validate")}</button>}{terminal && <span className="ss-muted">{doc.status === 'done' ? t("Validated document \xB7 Read only") : t("Canceled document \xB7 Read only")}</span>}</div></div>{productForm && <ProductForm revision={revision} onClose={() => setProductForm(false)} onSave={() => {
      setProductForm(false);
      products.reload();
    }} />}</Modal>;
}
function MoveHistory({
  revision
}) {
  const [search, setSearch] = useState(''),
    [type, setType] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const moves = useData(`/move-history?search=${encodeURIComponent(search)}&type=${type}&from=${from}&to=${to}`, revision);
  return <Collection title={t("Move History")} subtitle={t("A complete record of every validated stock movement.")} rows={moves.data || []} loading={moves.loading} error={moves.error} search={search} setSearch={setSearch} groups={['done']} extra={<><select aria-label={t("Movement type")} value={type} onChange={e => setType(e.target.value)}><option value="">{t("All movements")}</option>{['receipt', 'delivery', 'transfer', 'adjustment'].map(t => <option key={t} value={t}>{i18n.t(t)}</option>)}</select><input aria-label={t("From date")} type="date" value={from} onChange={e => setFrom(e.target.value)} /><input aria-label={t("To date")} type="date" value={to} onChange={e => setTo(e.target.value)} /></>} columns={[{
    key: 'reference',
    label: t("Reference"),
    render: m => <strong className={m.direction === 'in' ? 'ss-green' : 'ss-red'}>{m.reference}</strong>
  }, {
    key: 'date',
    label: t("Date"),
    render: m => date(m.date)
  }, {
    key: 'product',
    label: t("Product"),
    render: m => m.product.name
  }, {
    key: 'from',
    label: t("From")
  }, {
    key: 'to',
    label: t("To")
  }, {
    key: 'contact',
    label: t("Contact")
  }, {
    key: 'status',
    label: t("Status"),
    render: m => <Badge status={m.status} />
  }, {
    key: 'quantity',
    label: t("Quantity"),
    render: m => <b className={m.direction === 'in' ? 'ss-green' : 'ss-red'}>{m.direction === 'in' ? '+' : '−'}{m.quantity}</b>
  }]} />;
}
function SettingsPage({
  revision,
  manager
}) {
  const [kind, setKind] = useState('warehouses'),
    [search, setSearch] = useState(''),
    [form, setForm] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const records = useData(`/${kind}`, revision),
    warehouses = useData('/warehouses', revision);
  const rows = (records.data || []).filter(r => `${r.name} ${r.short_code}`.toLowerCase().includes(search.toLowerCase())).map(r => ({
    ...r,
    status: 'active'
  }));
  return <><div className="ss-tabs"><button className={kind === 'warehouses' ? 'active' : ''} onClick={() => setKind('warehouses')}>{t("Warehouses")}</button><button className={kind === 'locations' ? 'active' : ''} onClick={() => setKind('locations')}>{t("Locations")}</button></div><Collection key={kind} title={kind === 'warehouses' ? t("Warehouses") : t("Locations")} subtitle={t("Organize the places your inventory calls home.")} rows={rows} loading={records.loading} error={records.error || error} search={search} setSearch={setSearch} groups={['active']} action={manager && <button className="ss-primary" onClick={() => {
      setError('');
      setForm({
        name: '',
        short_code: '',
        address: '',
        warehouse_id: ''
      });
    }}><Plus size={17} />{t("New")} {t(kind === 'warehouses' ? 'warehouse' : 'location')}</button>} columns={[{
      key: 'name',
      label: t("Name")
    }, {
      key: 'short_code',
      label: t("Short Code")
    }, kind === 'warehouses' ? {
      key: 'address',
      label: t("Address")
    } : {
      key: 'warehouse',
      label: t("Warehouse"),
      render: r => r.warehouse?.name
    }, {
      key: 'status',
      label: t("Status"),
      render: r => <Badge status={r.status} />
    }, ...(manager ? [{
      key: 'actions',
      label: t("Actions"),
      render: r => <div className="ss-inline"><button className="ss-link" onClick={() => {
          setError('');
          setForm(r);
        }}>{t("Edit")}</button><button className="ss-link ss-red" disabled={busy} onClick={async () => {
          if (!window.confirm(t("Delete {{v0}}?", {
            v0: r.name
          }))) return;
          setBusy(true);
          try {
            await api.delete(`/${kind}/${r.id}`);
            records.reload();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}>{t("Delete")}</button></div>
    }] : [])]} />{form && <Modal title={`${form.id ? t("Edit") : t("New")} ${t(kind === 'warehouses' ? 'warehouse' : 'location')}`} onClose={() => setForm(null)}><form className="ss-form" onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        try {
          if (form.id) await api.put(`/${kind}/${form.id}`, form);else await api.post(`/${kind}`, form);
          setForm(null);
          records.reload();
          warehouses.reload();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}><ErrorBox error={error} />{['name', 'short_code', ...(kind === 'warehouses' ? ['address'] : [])].map(k => <Field key={k} label={k.replace('_', ' ')}><input required value={form[k]} onChange={e => setForm({
            ...form,
            [k]: e.target.value
          })} /></Field>)}{kind === 'locations' && <Field label={t("Warehouse")}><select required value={form.warehouse_id} onChange={e => setForm({
            ...form,
            warehouse_id: e.target.value
          })}><option value="">{t("Choose warehouse")}</option>{warehouses.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}<div className="ss-actions"><button className="ss-primary" disabled={busy}>{t("Save")}</button></div></form></Modal>}</>;
}
function Transfers({
  revision
}) {
  const records = useData('/transfers?limit=100', revision),
    locations = useData('/locations', revision),
    products = useData('/products', revision);
  const [search, setSearch] = useState(''),
    [form, setForm] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const rows = (records.data || []).map(r => ({
    ...r,
    reference: `INT/${String(r.id).padStart(4, '0')}`
  })).filter(r => r.reference.includes(search));
  return <><Collection title={t("Transfers")} subtitle={t("Move stock between warehouse locations.")} rows={rows} loading={records.loading} error={error || records.error} search={search} setSearch={setSearch} groups={['draft', 'ready', 'done', 'canceled']} action={<button className="ss-primary" onClick={() => setForm({
      from_location_id: '',
      to_location_id: '',
      items: [{
        product_id: '',
        quantity: 1
      }]
    })}><Plus size={17} />{t("New transfer")}</button>} columns={[{
      key: 'reference',
      label: t("Reference")
    }, {
      key: 'from',
      label: t("From"),
      render: r => loc(r.fromLocation)
    }, {
      key: 'to',
      label: t("To"),
      render: r => loc(r.toLocation)
    }, {
      key: 'status',
      label: t("Status"),
      render: r => <Badge status={r.status} />
    }, {
      key: 'actions',
      label: t("Actions"),
      render: r => !['done', 'canceled'].includes(r.status) && <button className="ss-link" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          await api.post(`/transfers/${r.id}/validate`);
          records.reload();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}>{t("Validate")}</button>
    }]} />{form && <Modal title={t("New transfer")} onClose={() => setForm(null)}><form className="ss-form" onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.post('/transfers', form);
          setForm(null);
          records.reload();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}><ErrorBox error={error} />{['from_location_id', 'to_location_id'].map(k => <Field key={k} label={k === 'from_location_id' ? t("From location") : t("To location")}><select required value={form[k]} onChange={e => setForm({
            ...form,
            [k]: e.target.value
          })}><option value="">{t("Choose location")}</option>{locations.data?.map(l => <option key={l.id} value={l.id}>{loc(l)}</option>)}</select></Field>)}<Field label={t("Product")}><select required value={form.items[0].product_id} onChange={e => setForm({
            ...form,
            items: [{
              ...form.items[0],
              product_id: e.target.value
            }]
          })}><option value="">{t("Choose product")}</option>{products.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label={t("Quantity")}><input required type="number" min="0.01" step="any" value={form.items[0].quantity} onChange={e => setForm({
            ...form,
            items: [{
              ...form.items[0],
              quantity: e.target.value
            }]
          })} /></Field><div className="ss-actions"><button className="ss-primary" disabled={busy}>{t("Create draft")}</button></div></form></Modal>}</>;
}
export default function Shelfy() {
  const {
    user,
    isAuthenticated,
    checkAuth,
    logout
  } = useAuthStore();
  const {
    i18n: translations
  } = useTranslation();
  useEffect(() => {
    if (user) {
      applyPreferences(user);
      translations.changeLanguage(user.language);
    }
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => user && applyPreferences(user);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [user, translations]);
  const [tab, setTab] = useState(location.hash.slice(1) || 'dashboard'),
    [revision, setRevision] = useState(0),
    [connected, setConnected] = useState(false),
    [profile, setProfile] = useState(false),
    [notification, setNotification] = useState('');
  const navigate = t => {
    setTab(t);
    location.hash = t;
  };
  useEffect(() => {
    if (isAuthenticated && user?.role !== 'manager' && tab === 'audit') {
      setTab('dashboard');
      history.replaceState(null, '', location.pathname + location.search + '#dashboard');
    }
  }, [isAuthenticated, user?.role, tab]);
  useEffect(() => {
    checkAuth();
    const listener = () => setTab(location.hash.slice(1) || 'dashboard');
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, [checkAuth]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = io(import.meta.env.VITE_SOCKET_URL || location.origin, {
      withCredentials: true,
      auth: cb => cb({
        token: localStorage.getItem('stocksense_access_token')
      })
    });
    let refreshingSocket = false;
    socket.on('connect_error', async error => {
      if (error.message !== 'Authentication required' || refreshingSocket) return;
      refreshingSocket = true;
      try {
        // The HTTP interceptor rotates an expired access token before reconnecting.
        await api.get('/auth/me');
        socket.connect();
      } catch {
        setConnected(false);
      }
    });
    socket.on('connect', () => {
      refreshingSocket = false;
    });
    socket.on('connect', () => {
      setConnected(true);
      setRevision(v => v + 1);
    });
    socket.on('disconnect', async reason => {setConnected(false);if(reason==='io server disconnect'){await checkAuth();if(useAuthStore.getState().isAuthenticated)socket.connect();}});
    socket.on('inventory:changed', () => setRevision(v => v + 1));
    socket.on('stock:low', data => setNotification(t('Low stock: {{product}} · {{quantity}} {{unit}} on hand', {
      product: data.productName,
      quantity: data.currentStock,
      unit: data.unitOfMeasure
    })));
    return () => socket.disconnect();
  }, [isAuthenticated]);
  if (!isAuthenticated) return <Auth />;
  const manager = user?.role === 'manager';
  const links = [['dashboard', t("Overview"), LayoutDashboard], ['receipts', t("Receipts"), ArrowDownLeft], ['deliveries', t("Deliveries"), ArrowUpRight], ['transfers', t("Transfers"), ArrowRightLeft], ['products', t("Products"), Package], ['move-history', t("Move History"), History], ['warehouses', t("Settings"), Settings], ...(manager ? [['audit', t("Audit Log"), History]] : [])];
  return <div className="ss-app"><header className="ss-header"><button className="ss-logo" onClick={() => navigate('dashboard')}><Package />{t("Shelfy")}<span>{user.company?.name}</span></button><nav aria-label={t("Main navigation")}>{[['dashboard', t("Dashboard")], ['receipts', t("Operations")], ['products', t("Products")], ['move-history', t("Move History")], ['warehouses', t("Settings")], ...(manager ? [['audit', t("Audit Log")]] : [])].map(([key, label]) => <button key={key} className={tab === key || key === 'receipts' && ['deliveries', 'transfers'].includes(tab) ? 'active' : ''} onClick={() => navigate(key)}>{t(label)}</button>)}</nav><div className="ss-header-right"><QuickPreferences /><span className={`ss-live ${connected ? 'online' : ''}`}><i />{connected ? t("Live updates") : t("Connecting")}</span><button className="ss-avatar" aria-label={t("My Profile")} onClick={() => setProfile(true)}>{user?.name?.slice(0, 2).toUpperCase()}</button></div></header><div className="ss-body"><aside className="ss-sidebar"><div className="ss-workspace"><span>{t("WORKSPACE")}</span><strong>{user.company?.name}</strong><small>{manager ? t("Inventory Manager") : t("Warehouse Staff")}</small></div><nav aria-label={t("Workspace navigation")}>{links.map(([key, label, Icon], i) => <React.Fragment key={key}>{i === 1 && <small>{t("OPERATIONS")}</small>}{i === 4 && <small>{t("CATALOG & CONTROL")}</small>}<button className={tab === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={18} />{t(label)}{tab === key && <span className="ss-nav-dot" />}</button></React.Fragment>)}</nav><div className="ss-sidebar-bottom"><span className="ss-tile receipts"><Package size={19} /></span><strong>{t("Everything in its place.")}</strong><p>{t("A clearer picture of your stock, every day.")}</p><span>{t("Shelfy \xB7 Inventory workspace")}</span></div></aside><main className="ss-main">{notification && <div className="ss-notice ss-inline"><Bell size={16} />{notification}<button aria-label={t("Dismiss notification")} className="ss-icon" onClick={() => setNotification('')}><X size={15} /></button></div>}{['receipts', 'deliveries', 'transfers'].includes(tab) && <div className="ss-tabs">{['receipts', 'deliveries', 'transfers'].map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => navigate(t)}>{i18n.t(t)}</button>)}</div>}{tab === 'dashboard' ? <Dashboard revision={revision} navigate={navigate} /> : tab === 'products' ? <Products revision={revision} manager={manager} /> : ['receipts', 'deliveries'].includes(tab) ? <Documents key={tab} incoming={tab === 'receipts'} revision={revision} manager={manager} /> : tab === 'move-history' ? <MoveHistory revision={revision} /> : tab === 'transfers' ? <Transfers revision={revision} /> : tab === 'audit' && manager ? <AuditPage /> : <WorkspaceSettings manager={manager} warehouseContent={<SettingsPage revision={revision} manager={manager} />} />}<footer className="ss-footer">{t("Shelfy Inventory Management")}<span><button className="ss-link" onClick={() => setRevision(v => v + 1)}><RefreshCw size={12} />{t("Refresh data")}</button></span></footer></main></div>{profile && <Modal title={t("My Profile")} onClose={() => setProfile(false)}><div className="ss-form"><h2>{user?.name}</h2><p>{user?.email}</p><Badge status={user?.role} /><div className="ss-actions"><button className="ss-danger" onClick={() => {
            setProfile(false);
            logout();
          }}><LogOut size={16} />{t("Logout")}</button></div></div></Modal>}</div>;
}
