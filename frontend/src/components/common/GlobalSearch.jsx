import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, ClipboardList, FileText, Package, Search, Truck, UserRound, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './GlobalSearch.css';

const groups = [
  { key: 'assets', label: 'Assets', icon: Package },
  { key: 'tickets', label: 'Tickets', icon: ClipboardList },
  { key: 'users', label: 'Users', icon: UserRound },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'licenses', label: 'Licenses', icon: FileText },
  { key: 'maintenance', label: 'Maintenance', icon: ClipboardList },
  { key: 'infrastructure', label: 'Infrastructure assets', icon: Building2 },
  { key: 'buildings', label: 'Buildings', icon: Building2 },
  { key: 'suppliers', label: 'Suppliers', icon: Truck },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'payments', label: 'Payments', icon: FileText },
  { key: 'budgets', label: 'Budgets', icon: FileText },
];

const rolePlaceholders = {
  admin: 'administrator', college: 'college', department_head: 'department', store_manager: 'store',
  ict_officer: 'ict', maintenance: 'maintenance', infrastructure: 'infrastructure', finance: 'finance',
};

const rolePaths = {
  admin: { assets: '/admin/assets', tickets: '/admin/support', users: '/admin/users' },
  college: { assets: '/college/assets', tickets: '/college/requests', users: '/college/staff' },
  department_head: { assets: '/department-head/assets', tickets: '/department-head/maintenance', users: '/department-head/staff' },
  store_manager: { assets: '/store/available-assets', suppliers: '/store/suppliers' },
  ict_officer: { assets: '/ict/assets', tickets: '/ict/support', incidents: '/ict/incidents', licenses: '/ict/software-licenses', maintenance: '/ict/maintenance' },
  maintenance: { assets: '/maintenance/assets-under-maintenance', tickets: '/maintenance/requests', maintenance: '/maintenance/work-orders' },
  infrastructure: { infrastructure: '/infrastructure/assets', buildings: '/infrastructure/buildings', maintenance: '/infrastructure/work-orders' },
  finance: { assets: '/finance/valuation', invoices: '/finance/invoices', payments: '/finance/payments', budgets: '/finance/budgets' },
};

const localeText = {
  en: {
    placeholder: {
      administrator: 'Search assets, tickets, users, serial numbers...',
      college: 'Search college assets, requests, staff...',
      department: 'Search department assets, requests, staff...',
      store: 'Search inventory, receipts, suppliers, serial numbers...',
      ict: 'Search ICT assets, incidents, licenses, serial numbers...',
      maintenance: 'Search requests, work orders, repairs, assets...',
      infrastructure: 'Search infrastructure assets, buildings, work orders...',
      finance: 'Search invoices, payments, budgets, assets...',
    },
    label: 'Global search', clear: 'Clear search', close: 'Close search',
    empty: 'No results found. Try a different keyword.', error: 'Unable to search. Please try again.',
    loading: 'Searching', shortcut: 'Search shortcut',
  },
  am: {
    placeholder: {
      administrator: 'ንብረቶችን፣ ጥያቄዎችን፣ ተጠቃሚዎችን፣ ተከታታይ ቁጥሮችን ፈልግ...',
      college: 'የኮሌጅ ንብረቶችን፣ ጥያቄዎችን፣ ሰራተኞችን ፈልግ...',
      department: 'የዲፓርትመንት ንብረቶችን፣ ጥያቄዎችን፣ ሰራተኞችን ፈልግ...',
      store: 'ክምችትን፣ ደረሰኞችን፣ አቅራቢዎችን፣ ተከታታይ ቁጥሮችን ፈልግ...',
      ict: 'የICT ንብረቶችን፣ ክስተቶችን፣ ፈቃዶችን፣ ተከታታይ ቁጥሮችን ፈልግ...',
      maintenance: 'ጥያቄዎችን፣ የሥራ ትዕዛዞችን፣ ጥገናዎችን፣ ንብረቶችን ፈልግ...',
      infrastructure: 'የመሠረተ ልማት ንብረቶችን፣ ሕንፃዎችን፣ የሥራ ትዕዛዞችን ፈልግ...',
      finance: 'ደረሰኞችን፣ ክፍያዎችን፣ በጀቶችን፣ ንብረቶችን ፈልግ...',
    },
    label: 'አጠቃላይ ፍለጋ', clear: 'ፍለጋውን አጽዳ', close: 'ፍለጋውን ዝጋ',
    empty: 'ውጤት አልተገኘም። ሌላ ቃል ይሞክሩ።', error: 'መፈለግ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    loading: 'በመፈለግ ላይ', shortcut: 'የፍለጋ አቋራጭ',
  },
};

const isEditableTarget = (target) => target instanceof HTMLElement && (
  target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
);

const Highlight = ({ value, query }) => {
  const index = value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index < 0 || !query) return value;
  return <>{value.slice(0, index)}<mark>{value.slice(index, index + query.length)}</mark>{value.slice(index + query.length)}</>;
};

export default function GlobalSearch({ role, language = 'en' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const navigate = useNavigate();
  const copy = localeText[language === 'am' ? 'am' : 'en'];
  const placeholderKey = rolePlaceholders[role] || 'administrator';
  const placeholder = copy.placeholder[placeholderKey];
  const destinations = rolePaths[role] || {};
  const availableGroups = useMemo(() => groups.filter(({ key }) => Object.hasOwn(destinations, key)), [destinations]);
  const flattened = useMemo(() => availableGroups.flatMap((group) => (
    Array.isArray(results[group.key]) ? results[group.key].map((item) => ({ ...item, group: group.key })) : []
  )), [availableGroups, results]);
  const listboxId = 'global-search-results';

  useEffect(() => {
    if (query.trim().length < 2) {
      abortRef.current?.abort();
      setLoading(false);
      setResults({});
      setError(false);
      return undefined;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      setOpen(true);
      try {
        const response = await apiClient.get('/api/search', { params: { q: query.trim() }, signal: controller.signal });
        if (!controller.signal.aborted) {
          setResults(response.data?.data || {});
          setActiveIndex(-1);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(true);
          setResults({});
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === '/' || (event.ctrlKey && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setMobileOpen(true);
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  const selectResult = (item) => {
    const path = destinations[item.group];
    if (!path) return;
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    navigate(`${path}?search=${encodeURIComponent(item.title || '')}`);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setMobileOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (event.key === 'ArrowDown' && flattened.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % flattened.length);
    } else if (event.key === 'ArrowUp' && flattened.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index <= 0 ? flattened.length - 1 : index - 1));
    } else if (event.key === 'Enter' && flattened.length) {
      event.preventDefault();
      selectResult(flattened[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  let optionIndex = -1;
  return (
    <div className={`global-search${mobileOpen ? ' is-mobile-open' : ''}`}>
      <button type="button" className="global-search-mobile-trigger" aria-label={copy.label} onClick={() => { setMobileOpen(true); inputRef.current?.focus(); }}>
        <Search size={19} aria-hidden="true" />
      </button>
      <div className="global-search-field">
        <Search className="global-search-icon" size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          role="combobox"
          aria-label={copy.label}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
        />
        {query && <button type="button" className="global-search-clear" aria-label={copy.clear} onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}
        <kbd className="global-search-shortcut" aria-label={copy.shortcut}>/</kbd>
        <button type="button" className="global-search-mobile-close" aria-label={copy.close} onClick={() => { setMobileOpen(false); setOpen(false); }}><X size={18} aria-hidden="true" /></button>
      </div>
      {open && query.trim().length >= 2 && (
        <div className="global-search-dropdown" id={listboxId} role="listbox" aria-label={copy.label}>
          {loading && <div className="global-search-skeleton" aria-label={copy.loading} aria-live="polite"><span /><span /><span /></div>}
          {!loading && error && <div className="global-search-error" role="alert">{copy.error}</div>}
          {!loading && !error && flattened.length === 0 && <div className="global-search-empty">{copy.empty}</div>}
          {!loading && !error && availableGroups.map(({ key, label, icon: Icon }) => {
            const items = results[key];
            if (!Array.isArray(items) || !items.length) return null;
            return (
              <section className="global-search-group" key={key}>
                <h2 className="global-search-group-title"><Icon size={14} aria-hidden="true" />{label}</h2>
                {items.map((item) => {
                  optionIndex += 1;
                  const currentIndex = optionIndex;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={activeIndex === currentIndex}
                      id={`global-search-option-${currentIndex}`}
                      className={`global-search-option${activeIndex === currentIndex ? ' is-active' : ''}`}
                      key={`${key}-${item.id}`}
                      onMouseEnter={() => setActiveIndex(currentIndex)}
                      onClick={() => selectResult({ ...item, group: key })}
                    >
                      <span className="global-search-option-copy">
                        <strong><Highlight value={String(item.title || '')} query={query.trim()} /></strong>
                        {item.subtitle && <span>{item.subtitle}</span>}
                      </span>
                      <span className="global-search-type-badge"><Icon size={12} aria-hidden="true" />{label}</span>
                      {item.status && <span className="global-search-status">{item.status}</span>}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}