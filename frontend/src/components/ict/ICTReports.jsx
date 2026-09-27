import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Download, FileBarChart, Filter, Package, Radio, RefreshCw, RotateCcw, Search, SlidersHorizontal, UserCheck, Wrench } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';
import { getApiErrorMessage } from '../../services/apiClient';
import { exportIctReport, getIctReports } from '../../services/ictReportsService';

const initialFilters = { search: '', category: '', status: '', priority: '', condition: '', location: '', departmentId: '', dateFrom: '', dateTo: '', sortBy: 'updatedAt', sortOrder: 'DESC' };

const COPY = {
  en: {
    title: 'ICT Reports', description: 'Generate and export reports from authorized ICT records.', controls: 'Report Controls', reportType: 'Report Type', search: 'Search', searchAssets: 'Asset, serial, or location', searchLicenses: 'Software, vendor, or license number', searchSupport: 'Ticket, requester, or asset', searchIncidents: 'Incident, title, reporter, or asset',
    dateFrom: 'From Date', dateTo: 'To Date', expiryFrom: 'Expiration From', expiryTo: 'Expiration To', reportedFrom: 'Reported From', reportedTo: 'Reported To', category: 'Category', status: 'Status', priority: 'Priority', condition: 'Condition', department: 'Department', location: 'Location', rows: 'Rows', all: 'All', reset: 'Reset Filters', refresh: 'Refresh', export: 'Export CSV', exporting: 'Exporting...', exported: 'CSV report exported.', generated: 'Generated', records: 'records', serverFilters: 'Filters are applied on the server',
    generating: 'Generating report...', noData: 'No data found', noMatches: 'No records match the selected filters.', errorGenerate: 'Unable to generate the report.', errorExport: 'Unable to export the report.', retry: 'Retry', page: 'Page', of: 'of', previous: 'Previous', next: 'Next', reportSummary: 'Report summary', results: 'Report results', tableCaption: 'Report records',
    inventory: 'Asset Inventory Report', equipment: 'ICT Equipment Report', network: 'Network Equipment Report', licenses: 'Software License Report', support: 'ICT Support Report', incidents: 'Incident Report', statusReport: 'Asset Status Report', assignments: 'Asset Assignment Report', maintenance: 'Maintenance Report', rfid: 'RFID Tracking Report',
    assetTag: 'Asset Tag', assetName: 'Asset Name', equipmentName: 'Equipment', device: 'Device', type: 'Type', name: 'Name', manufacturer: 'Manufacturer', model: 'Model', serial: 'Serial Number', specifications: 'Specifications', categoryLabel: 'Category', conditionLabel: 'Condition', departmentLabel: 'Department', locationLabel: 'Location', assignedTo: 'Assigned To', assigned: 'Assigned', purchaseDate: 'Purchase Date', statusLabel: 'Status', count: 'Records', request: 'Request', titleLabel: 'Title', priorityLabel: 'Priority', requester: 'Requester', asset: 'Asset', created: 'Created', completed: 'Completed', resolution: 'Resolution', incident: 'Incident', reporter: 'Reporter', reported: 'Reported', resolved: 'Resolved', history: 'History', software: 'Software', vendor: 'Vendor', version: 'Version', licenseType: 'License Type', expiration: 'Expiration', licensesCount: 'Licenses', inUse: 'In Use', assignedDevices: 'Assigned Devices', assignedUsers: 'Assigned Users', totalAssets: 'Total Assets', totalEquipment: 'Total Equipment', networkDevices: 'Network Devices', totalLicenses: 'Total Licenses', totalRequests: 'Total Requests', totalIncidents: 'Total Incidents', active: 'Active', available: 'Available', underMaintenance: 'Under Maintenance', expiringSoon: 'Expiring Soon', expired: 'Expired', open: 'Open', resolvedCount: 'Resolved', closed: 'Closed', critical: 'Critical', totalAssignments: 'Total Assignments', returned: 'Returned', totalMaintenance: 'Total Maintenance', totalScans: 'Total Scans', uniqueAssets: 'Unique Assets', college: 'Authorized college',
  },
  am: {
    title: 'የአይሲቲ ሪፖርቶች', description: 'ከተፈቀዱ የአይሲቲ መዝገቦች ሪፖርቶችን ይፍጠሩ እና ያውርዱ።', controls: 'የሪፖርት መቆጣጠሪያዎች', reportType: 'የሪፖርት አይነት', search: 'ፈልግ', searchAssets: 'ንብረት፣ ተከታታይ ወይም ቦታ', searchLicenses: 'ሶፍትዌር፣ አቅራቢ ወይም ፈቃድ ቁጥር', searchSupport: 'ጥያቄ፣ ጠያቂ ወይም ንብረት', searchIncidents: 'ክስተት፣ ርዕስ፣ ዘጋቢ ወይም ንብረት',
    dateFrom: 'ከቀን', dateTo: 'እስከ ቀን', expiryFrom: 'ከማብቂያ ቀን', expiryTo: 'እስከ ማብቂያ ቀን', reportedFrom: 'ከተዘገበበት ቀን', reportedTo: 'እስከ ተዘገበበት ቀን', category: 'ምድብ', status: 'ሁኔታ', priority: 'ቅድሚያ', condition: 'የንብረት ሁኔታ', department: 'የሥራ ክፍል', location: 'ቦታ', rows: 'ረድፎች', all: 'ሁሉም', reset: 'ማጣሪያዎችን አጽዳ', refresh: 'አድስ', export: 'CSV አውርድ', exporting: 'በማውረድ ላይ...', exported: 'የCSV ሪፖርት ወርዷል።', generated: 'የተፈጠረበት', records: 'መዝገቦች', serverFilters: 'ማጣሪያዎቹ በሰርቨር ላይ ይተገበራሉ',
    generating: 'ሪፖርቱ በመፍጠር ላይ...', noData: 'መረጃ አልተገኘም', noMatches: 'ከተመረጡት ማጣሪያዎች ጋር የሚዛመድ መዝገብ የለም።', errorGenerate: 'ሪፖርቱን ማመንጨት አልተቻለም።', errorExport: 'ሪፖርቱን ማውረድ አልተቻለም።', retry: 'እንደገና ሞክር', page: 'ገጽ', of: 'ከ', previous: 'ቀዳሚ', next: 'ቀጣይ', reportSummary: 'የሪፖርት ማጠቃለያ', results: 'የሪፖርት ውጤቶች', tableCaption: 'የሪፖርት መዝገቦች',
    inventory: 'የንብረት ክምችት ሪፖርት', equipment: 'የአይሲቲ መሣሪያ ሪፖርት', network: 'የኔትወርክ መሣሪያ ሪፖርት', licenses: 'የሶፍትዌር ፈቃድ ሪፖርት', support: 'የአይሲቲ ድጋፍ ሪፖርት', incidents: 'የክስተት ሪፖርት', statusReport: 'የንብረት ሁኔታ ሪፖርት', assignments: 'የንብረት ምደባ ሪፖርት', maintenance: 'የጥገና ሪፖርት', rfid: 'የRFID ክትትል ሪፖርት',
    assetTag: 'የንብረት መለያ', assetName: 'የንብረት ስም', equipmentName: 'መሣሪያ', device: 'መሣሪያ', type: 'አይነት', name: 'ስም', manufacturer: 'አምራች', model: 'ሞዴል', serial: 'ተከታታይ ቁጥር', specifications: 'ዝርዝር መግለጫ', categoryLabel: 'ምድብ', conditionLabel: 'ሁኔታ', departmentLabel: 'የሥራ ክፍል', locationLabel: 'ቦታ', assignedTo: 'የተመደበለት', assigned: 'የተመደቡ', purchaseDate: 'የግዢ ቀን', statusLabel: 'ሁኔታ', count: 'መዝገቦች', request: 'ጥያቄ', titleLabel: 'ርዕስ', priorityLabel: 'ቅድሚያ', requester: 'ጠያቂ', asset: 'ንብረት', created: 'የተፈጠረበት', completed: 'የተጠናቀቀበት', resolution: 'መፍትሄ', incident: 'ክስተት', reporter: 'ዘጋቢ', reported: 'የተዘገበበት', resolved: 'የተፈታበት', history: 'ታሪክ', software: 'ሶፍትዌር', vendor: 'አቅራቢ', version: 'ስሪት', licenseType: 'የፈቃድ አይነት', expiration: 'የሚያበቃበት', licensesCount: 'ፈቃዶች', inUse: 'በአገልግሎት ላይ', assignedDevices: 'የተመደቡ መሣሪያዎች', assignedUsers: 'የተመደቡ ተጠቃሚዎች', totalAssets: 'ጠቅላላ ንብረቶች', totalEquipment: 'ጠቅላላ መሣሪያዎች', networkDevices: 'የኔትወርክ መሣሪያዎች', totalLicenses: 'ጠቅላላ ፈቃዶች', totalRequests: 'ጠቅላላ ጥያቄዎች', totalIncidents: 'ጠቅላላ ክስተቶች', active: 'ንቁ', available: 'ዝግጁ', underMaintenance: 'በጥገና ላይ', expiringSoon: 'በቅርቡ የሚያበቃ', expired: 'ያበቃ', open: 'ክፍት', resolvedCount: 'የተፈቱ', closed: 'የተዘጉ', critical: 'አስቸኳይ', totalAssignments: 'ጠቅላላ ምደባዎች', returned: 'የተመለሱ', totalMaintenance: 'ጠቅላላ ጥገናዎች', totalScans: 'ጠቅላላ ቅኝቶች', uniqueAssets: 'ልዩ ንብረቶች', college: 'የተፈቀደ ኮሌጅ',
  },
};

const getReportTypes = (t) => ({
  inventory: { label: t.inventory, icon: Package },
  equipment: { label: t.equipment, icon: Package },
  network: { label: t.network, icon: Radio },
  'software-licenses': { label: t.licenses, icon: FileBarChart },
  support: { label: t.support, icon: Wrench },
  incidents: { label: t.incidents, icon: Radio },
  status: { label: t.statusReport, icon: FileBarChart },
  assignments: { label: t.assignments, icon: UserCheck },
  maintenance: { label: t.maintenance, icon: Wrench },
  rfid: { label: t.rfid, icon: Radio },
});

const columnsFor = (type, t) => ({
  inventory: [['assetTag', t.assetTag], ['name', t.assetName], ['category', t.categoryLabel], ['serialNumber', t.serial], ['status', t.statusLabel], ['condition', t.conditionLabel], ['department', t.departmentLabel], ['location', t.locationLabel], ['assignedTo', t.assignedTo], ['purchaseDate', t.purchaseDate]],
  equipment: [['assetTag', t.assetTag], ['name', t.equipmentName], ['category', t.categoryLabel], ['manufacturer', t.manufacturer], ['model', t.model], ['serialNumber', t.serial], ['status', t.statusLabel], ['condition', t.conditionLabel], ['department', t.departmentLabel], ['location', t.locationLabel], ['assignedTo', t.assignedTo]],
  network: [['assetTag', t.assetTag], ['name', t.device], ['category', t.type], ['manufacturer', t.manufacturer], ['model', t.model], ['serialNumber', t.serial], ['specifications', t.specifications], ['status', t.statusLabel], ['condition', t.conditionLabel], ['department', t.departmentLabel], ['location', t.locationLabel], ['assignedTo', t.assignedTo]],
  'software-licenses': [['softwareName', t.software], ['vendor', t.vendor], ['version', t.version], ['licenseType', t.licenseType], ['status', t.statusLabel], ['expiryDate', t.expiration], ['quantity', t.licensesCount], ['usedQuantity', t.inUse], ['assignedDevices', t.assignedDevices], ['assignedUsers', t.assignedUsers]],
  support: [['ticketNumber', t.request], ['title', t.titleLabel], ['category', t.categoryLabel], ['priority', t.priorityLabel], ['status', t.statusLabel], ['requester', t.requester], ['assignedTo', t.assignedTo], ['asset', t.asset], ['department', t.departmentLabel], ['createdAt', t.created], ['completedAt', t.completed], ['resolution', t.resolution]],
  incidents: [['incidentNumber', t.incident], ['title', t.titleLabel], ['category', t.categoryLabel], ['status', t.statusLabel], ['priority', t.priorityLabel], ['reporter', t.reporter], ['assignedTo', t.assignedTo], ['asset', t.asset], ['department', t.departmentLabel], ['reportedAt', t.reported], ['resolvedAt', t.resolved], ['resolution', t.resolution], ['history', t.history]],
  status: [['status', t.statusLabel], ['count', t.count]],
  assignments: [['assetTag', t.assetTag], ['asset', t.asset], ['assignedTo', t.assignedTo], ['department', t.departmentLabel], ['assignedDate', t.created], ['status', t.statusLabel], ['location', t.locationLabel]],
  maintenance: [['assetTag', t.assetTag], ['asset', t.asset], ['title', t.titleLabel], ['status', t.statusLabel], ['priority', t.priorityLabel], ['reportedDate', t.reported], ['completedDate', t.completed], ['technician', t.assignedTo]],
  rfid: [['assetTag', t.assetTag], ['asset', t.asset], ['tag', 'RFID'], ['action', t.type], ['location', t.locationLabel], ['readerId', t.device], ['detectedAt', t.reported]],
}[type] || []);

const summariesFor = (type, t) => ({
  inventory: [['totalAssets', t.totalAssets], ['assigned', t.assigned], ['available', t.available], ['underMaintenance', t.underMaintenance]],
  equipment: [['totalEquipment', t.totalEquipment], ['assigned', t.assigned], ['available', t.available], ['underMaintenance', t.underMaintenance]],
  network: [['totalNetworkEquipment', t.networkDevices], ['assigned', t.assigned], ['available', t.available], ['underMaintenance', t.underMaintenance]],
  'software-licenses': [['totalLicenses', t.totalLicenses], ['active', t.active], ['expiringSoon', t.expiringSoon], ['expired', t.expired]],
  support: [['totalRequests', t.totalRequests], ['active', t.active], ['resolved', t.resolvedCount], ['closed', t.closed]],
  incidents: [['totalIncidents', t.totalIncidents], ['open', t.open], ['resolved', t.resolvedCount], ['critical', t.critical]],
  assignments: [['totalAssignments', t.totalAssignments], ['active', t.active], ['returned', t.returned]],
  maintenance: [['totalMaintenance', t.totalMaintenance], ['open', t.open], ['completed', t.resolvedCount]],
  rfid: [['totalScans', t.totalScans], ['uniqueAssets', t.uniqueAssets]],
  status: [['totalAssets', t.totalAssets]],
}[type] || []);

const displayValue = (value) => value === null || value === undefined || value === '' ? '—' : value;
const formatCell = (key, value, locale) => {
  if (key === 'specifications' && value && typeof value === 'object') return JSON.stringify(value);
  if (/date|at$/i.test(key)) return value ? new Date(value).toLocaleDateString(locale) : '—';
  return displayValue(value);
};

const ICTReports = () => {
  const { language } = useLanguage();
  const t = COPY[language] || COPY.en;
  const locale = language === 'am' ? 'am-ET' : 'en-US';
  const reportTypes = getReportTypes(t);
  const [reportType, setReportType] = useState('inventory');
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState({ data: [], summary: {}, filters: {}, pagination: { page: 1, limit: 25, total: 0, totalPages: 0 }, generatedAt: null, scope: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [errorTitle, setErrorTitle] = useState('');
  const requestParams = useMemo(() => ({ type: reportType, page, limit: report.pagination.limit || 25, ...filters }), [filters, page, report.pagination.limit, reportType]);
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getIctReports(requestParams);
      setReport(response.data);
    } catch (requestError) {
      setErrorTitle(t.errorGenerate);
      setError(getApiErrorMessage(requestError, t.errorGenerate));
    } finally {
      setLoading(false);
    }
  }, [requestParams, t.errorGenerate]);
  useEffect(() => { loadReport(); }, [loadReport]);

  const changeFilter = (name, value) => { setPage(1); setFilters((current) => ({ ...current, [name]: value })); };
  const resetFilters = () => { setPage(1); setFilters(initialFilters); };
  const changeReport = (value) => { setPage(1); setReportType(value); setFilters(initialFilters); };
  const exportCsv = async () => {
    if (!report.pagination.total || exporting) return;
    setExporting(true);
    setError('');
    try {
      const response = await exportIctReport({ type: reportType, ...filters });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}-report.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t.exported);
    } catch (requestError) {
      setErrorTitle(t.errorExport);
      setError(getApiErrorMessage(requestError, t.errorExport));
    } finally {
      setExporting(false);
    }
  };

  const metadata = report.filters || {};
  const columns = columnsFor(reportType, t);
  const Icon = reportTypes[reportType].icon;
  const summaryEntries = summariesFor(reportType, t);
  const assetReports = ['inventory', 'equipment', 'network', 'assignments', 'maintenance', 'rfid'].includes(reportType);
  const showCategory = assetReports || reportType === 'support' || reportType === 'incidents';
  const showDepartment = assetReports || reportType === 'support' || reportType === 'incidents';
  const showPriority = reportType === 'support' || reportType === 'incidents';
  const dateFromLabel = reportType === 'software-licenses' ? t.expiryFrom : reportType === 'incidents' ? t.reportedFrom : t.dateFrom;
  const dateToLabel = reportType === 'software-licenses' ? t.expiryTo : reportType === 'incidents' ? t.reportedTo : t.dateTo;
  const searchHint = reportType === 'software-licenses' ? t.searchLicenses : reportType === 'support' ? t.searchSupport : reportType === 'incidents' ? t.searchIncidents : t.searchAssets;

  return <main style={pageStyle} aria-labelledby="ict-reports-title">
    <header style={headerStyle}>
      <div style={titleGroupStyle}>
        <span style={titleIconStyle}><FileBarChart size={23} aria-hidden="true" /></span>
        <div><h1 id="ict-reports-title" style={titleStyle}>{t.title}</h1><p style={descriptionStyle}>{t.description}</p></div>
      </div>
      <div style={buttonGroupStyle}>
        <button type="button" onClick={loadReport} disabled={loading} aria-label={t.refresh} style={buttonStyle('secondary')}><RefreshCw size={16} aria-hidden="true" /> {t.refresh}</button>
        <button type="button" onClick={exportCsv} disabled={exporting || loading || !report.pagination.total} style={buttonStyle('primary')}><Download size={16} aria-hidden="true" /> {exporting ? t.exporting : t.export}</button>
      </div>
    </header>

    <section style={panelStyle} aria-label={t.controls}>
      <div style={sectionTitleStyle}><SlidersHorizontal size={18} aria-hidden="true" /><strong>{t.controls}</strong></div>
      <div style={gridStyle}>
        <label style={labelStyle}>{t.reportType}<select value={reportType} onChange={(event) => changeReport(event.target.value)} style={inputStyle}>{Object.entries(reportTypes).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
        <label style={labelStyle}>{t.search}<span style={inputWithIconStyle}><Search size={16} aria-hidden="true" style={iconInputStyle} /><input value={filters.search} onChange={(event) => changeFilter('search', event.target.value)} placeholder={searchHint} style={{ ...inputStyle, paddingLeft: 34 }} /></span></label>
        <DateInput label={dateFromLabel} value={filters.dateFrom} onChange={(value) => changeFilter('dateFrom', value)} />
        <DateInput label={dateToLabel} value={filters.dateTo} onChange={(value) => changeFilter('dateTo', value)} />
        {showCategory && <Option label={t.category} value={filters.category} onChange={(value) => changeFilter('category', value)} options={metadata.categories} allLabel={t.all} />}
        <Option label={t.status} value={filters.status} onChange={(value) => changeFilter('status', value)} options={metadata.statuses} allLabel={t.all} />
        {showPriority && <Option label={t.priority} value={filters.priority} onChange={(value) => changeFilter('priority', value)} options={metadata.priorities} allLabel={t.all} />}
        {assetReports && <Option label={t.condition} value={filters.condition} onChange={(value) => changeFilter('condition', value)} options={metadata.conditions} allLabel={t.all} />}
        {showDepartment && <Option label={t.department} value={filters.departmentId} onChange={(value) => changeFilter('departmentId', value)} options={metadata.departments} objectOptions allLabel={t.all} />}
        {assetReports && <Option label={t.location} value={filters.location} onChange={(value) => changeFilter('location', value)} options={metadata.locations} allLabel={t.all} />}
        <label style={labelStyle}>{t.rows}<select value={report.pagination.limit || 25} onChange={(event) => { setPage(1); setReport((current) => ({ ...current, pagination: { ...current.pagination, limit: Number(event.target.value) } })); }} style={inputStyle}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
      </div>
      <button type="button" onClick={resetFilters} style={{ ...buttonStyle('link'), marginTop: 12 }}><RotateCcw size={15} aria-hidden="true" /> {t.reset}</button>
    </section>

    {error ? <section style={errorPanelStyle} role="alert"><div style={errorTitleStyle}><CircleAlert size={20} aria-hidden="true" /><strong>{errorTitle || t.errorGenerate}</strong></div><p>{error}</p><button type="button" onClick={loadReport} style={buttonStyle('primary')}><RotateCcw size={15} aria-hidden="true" /> {t.retry}</button></section> : <>
      <section style={summaryGridStyle} aria-label={t.reportSummary} aria-live="polite">{summaryEntries.map(([key, label]) => <div key={key} style={summaryStyle}><span style={summaryLabelStyle}>{label}</span><strong style={summaryValueStyle}>{displayValue(report.summary?.[key] ?? 0)}</strong></div>)}</section>
      <section style={panelStyle} aria-labelledby="ict-report-results-title">
        <div style={resultsHeaderStyle}>
          <div><h2 id="ict-report-results-title" style={resultsTitleStyle}><Icon size={19} aria-hidden="true" /> {reportTypes[reportType].label}</h2><p style={metaStyle}>{t.generated} {report.generatedAt ? new Date(report.generatedAt).toLocaleString(locale) : '—'} · {report.scope?.collegeName || t.college} · {report.pagination.total || 0} {t.records}</p></div>
          <span style={filterNoteStyle}><Filter size={14} aria-hidden="true" /> {t.serverFilters}</span>
        </div>
        {loading ? <div style={stateStyle} role="status"><RefreshCw size={22} aria-hidden="true" style={spinnerStyle} /><span>{t.generating}</span></div> : report.data?.length ? <div style={tableWrapStyle}><table style={tableStyle}><caption className="sr-only">{t.tableCaption}</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" style={thStyle}>{label}</th>)}</tr></thead><tbody>{report.data.map((row, index) => <tr key={row.id ?? index}>{columns.map(([key]) => <td key={key} style={{ ...tdStyle, ...(key === 'history' ? historyCellStyle : {}) }}>{formatCell(key, row[key], locale)}</td>)}</tr>)}</tbody></table></div> : <div style={stateStyle}><Package size={30} aria-hidden="true" /><strong>{t.noData}</strong><span>{t.noMatches}</span></div>}
        {!loading && report.pagination.totalPages > 1 && <div style={paginationStyle}><span>{t.page} {report.pagination.page} {t.of} {report.pagination.totalPages}</span><div style={buttonGroupStyle}><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} style={buttonStyle('secondary')}><ChevronLeft size={16} aria-hidden="true" /> {t.previous}</button><button type="button" disabled={page >= report.pagination.totalPages} onClick={() => setPage((current) => current + 1)} style={buttonStyle('secondary')}>{t.next} <ChevronRight size={16} aria-hidden="true" /></button></div></div>}
      </section>
    </>}
  </main>;
};

const DateInput = ({ label, value, onChange }) => <label style={labelStyle}>{label}<span style={inputWithIconStyle}><CalendarDays size={16} aria-hidden="true" style={iconInputStyle} /><input type="date" value={value} onChange={(event) => onChange(event.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} /></span></label>;

const Option = ({ label, value, onChange, options = [], objectOptions = false, allLabel }) => <label style={labelStyle}>{label}<select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}><option value="">{allLabel} {label}</option>{options.map((option) => <option key={objectOptions ? option.id : option} value={objectOptions ? option.id : option}>{objectOptions ? option.name : option}</option>)}</select></label>;

const pageStyle = { maxWidth: 1500, margin: '0 auto', padding: '24px clamp(14px, 2.5vw, 28px)', color: '#18324b' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 22 };
const titleGroupStyle = { display: 'flex', gap: 13, alignItems: 'flex-start', minWidth: 220 };
const titleIconStyle = { display: 'grid', placeItems: 'center', width: 44, height: 44, flex: '0 0 44px', background: '#e6f4f1', color: '#087f75', borderRadius: 8 };
const titleStyle = { margin: 0, fontSize: 26, lineHeight: 1.2 };
const descriptionStyle = { margin: '6px 0 0', color: '#60758a', lineHeight: 1.5 };
const buttonGroupStyle = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
const panelStyle = { background: '#fff', border: '1px solid #dfe8ee', borderRadius: 8, padding: 18, boxShadow: '0 4px 16px rgba(22, 53, 76, 0.04)', marginBottom: 18 };
const sectionTitleStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 13 };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#36526a' };
const inputStyle = { width: '100%', minHeight: 39, boxSizing: 'border-box', border: '1px solid #c9d7e0', borderRadius: 6, padding: '8px 10px', background: '#fff', color: '#18324b', font: 'inherit', fontWeight: 400 };
const inputWithIconStyle = { position: 'relative', display: 'block' };
const iconInputStyle = { position: 'absolute', zIndex: 1, left: 10, top: 11, color: '#7890a2' };
const summaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 12, margin: '20px 0' };
const summaryStyle = { background: '#fff', border: '1px solid #dfe8ee', borderTop: '3px solid #0b8f83', borderRadius: 7, padding: '13px 16px', minWidth: 0 };
const summaryLabelStyle = { color: '#60758a', fontSize: 13, lineHeight: 1.4 };
const summaryValueStyle = { display: 'block', fontSize: 22, marginTop: 5, lineHeight: 1.2 };
const resultsHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 };
const resultsTitleStyle = { margin: 0, fontSize: 19, display: 'flex', gap: 8, alignItems: 'center' };
const metaStyle = { margin: '6px 0 0', color: '#60758a', fontSize: 13, lineHeight: 1.5 };
const filterNoteStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#60758a', fontSize: 12 };
const tableWrapStyle = { overflowX: 'auto', maxWidth: '100%' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: 820 };
const thStyle = { textAlign: 'left', padding: '11px 10px', background: '#f3f7f8', color: '#36526a', borderBottom: '1px solid #dfe8ee', fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' };
const tdStyle = { padding: '11px 10px', borderBottom: '1px solid #edf1f3', color: '#29465c', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'top' };
const historyCellStyle = { whiteSpace: 'normal', minWidth: 230, maxWidth: 380, lineHeight: 1.45 };
const stateStyle = { minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 9, padding: 24, textAlign: 'center', color: '#60758a' };
const paginationStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16, color: '#60758a', fontSize: 13 };
const errorPanelStyle = { ...panelStyle, borderColor: '#e7a1a1', background: '#fff7f7', color: '#7e2b2b' };
const errorTitleStyle = { display: 'flex', alignItems: 'center', gap: 8 };
const buttonStyle = (variant) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 38, border: variant === 'link' ? 0 : '1px solid #c9d7e0', borderRadius: 6, padding: '8px 11px', cursor: 'pointer', background: variant === 'primary' ? '#087f75' : variant === 'link' ? 'transparent' : '#fff', color: variant === 'primary' ? '#fff' : '#36526a', fontWeight: 600, font: 'inherit' });
const spinnerStyle = { animation: 'ict-report-spin 1s linear infinite' };

export default ICTReports;