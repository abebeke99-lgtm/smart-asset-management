import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, FolderPlus, MapPin, Package, Save, ShieldCheck, Upload, UserRound, Wrench } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';

const fieldStyles = {
  wrapper: { display: 'grid', gap: '14px' },
  row: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
  full: { gridColumn: '1 / -1' },
  label: { display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#0f172a' },
  required: { color: '#dc2626', marginLeft: '4px' },
  input: {
    width: '100%',
    border: '1px solid #dfe7f1',
    borderRadius: '12px',
    padding: '12px 14px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    minHeight: '110px',
    border: '1px solid #dfe7f1',
    borderRadius: '12px',
    padding: '12px 14px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  error: { color: '#b91c1c', fontSize: '12px', marginTop: '6px', display: 'block' },
  success: { color: '#15803d', fontSize: '12px', marginTop: '6px', display: 'block' },
  select: {
    width: '100%',
    border: '1px solid #dfe7f1',
    borderRadius: '12px',
    padding: '12px 14px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
    boxSizing: 'border-box'
  }
};

const TECHNICAL_FIELDS_BY_CATEGORY = {
  Computer: ['processor', 'ram', 'storage', 'operatingSystem'],
  Laptop: ['processor', 'ram', 'storage', 'operatingSystem'],
  Server: ['processor', 'ram', 'storage', 'operatingSystem', 'hostname', 'ipAddress'],
  'Network Device': ['ipAddress', 'macAddress', 'hostname', 'networkRole'],
  Printer: ['hostname', 'ipAddress', 'networkRole'],
  Software: [],
  Furniture: ['material', 'condition'],
  Vehicle: ['vehicleRegistration', 'engineNumber'],
  Equipment: ['specificationNotes']
};

const categoryNameFromValue = (value, categories) => {
  if (!value) return 'N/A';
  const match = categories.find((item) => String(item.id) === String(value) || item.name === value);
  return match?.name || value;
};

const ICTCreateAsset = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    assetCode: '',
    name: '',
    categoryId: '',
    assetType: '',
    description: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    purchasePrice: '',
    currency: 'ETB',
    supplier: '',
    purchaseOrderNumber: '',
    invoiceNumber: '',
    warrantyStart: '',
    warrantyEnd: '',
    campus: '',
    building: '',
    departmentId: '',
    room: '',
    custodian: '',
    assignedUser: '',
    status: 'available',
    ipAddress: '',
    macAddress: '',
    hostname: '',
    operatingSystem: '',
    processor: '',
    ram: '',
    storage: '',
    networkRole: '',
    material: '',
    vehicleRegistration: '',
    engineNumber: '',
    specificationNotes: '',
    internalNotes: '',
    additionalInformation: '',
    assetImage: '',
    invoiceDocument: '',
    purchaseDocument: '',
    warrantyDocument: '',
    otherAttachment: ''
  });
  const [errors, setErrors] = useState({});
  const [createdAsset, setCreatedAsset] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [categoryResponse, departmentResponse, locationResponse, userResponse] = await Promise.all([
          axios.get('/api/categories'),
          axios.get('/api/departments'),
          axios.get('/api/locations'),
          axios.get('/api/users')
        ]);

        setCategories(Array.isArray(categoryResponse.data?.categories) ? categoryResponse.data.categories : Array.isArray(categoryResponse.data?.items) ? categoryResponse.data.items : categoryResponse.data?.data || []);
        setDepartments(Array.isArray(departmentResponse.data?.departments) ? departmentResponse.data.departments : departmentResponse.data?.data || []);
        setLocations(Array.isArray(locationResponse.data?.locations) ? locationResponse.data.locations : locationResponse.data?.data || []);
        setUsers(Array.isArray(userResponse.data?.users) ? userResponse.data.users : userResponse.data?.data || []);
      } catch (error) {
        toast.error('Unable to load asset registration options from the system.');
      }
    };

    fetchOptions();
    if (location.state?.cloneFrom) {
      const source = location.state.cloneFrom;
      setFormData((current) => ({
        ...current,
        name: source.name || '',
        description: source.description || '',
        categoryId: source.categoryId || source.category_id || source.category || '',
        departmentId: source.departmentId || source.department_id || source.department || '',
        manufacturer: source.manufacturer || '',
        model: source.model || '',
        serialNumber: source.serialNumber || source.serial_number || '',
        purchaseDate: source.purchaseDate || source.purchase_date || '',
        purchasePrice: source.purchasePrice || source.purchase_cost || '',
        warrantyEnd: source.warrantyExpiry || source.warranty_expiry || '',
        location: source.location || '',
        status: source.status || 'available'
      }));
    }
  }, [location.state]);

  const selectedCategoryName = useMemo(
    () => categoryNameFromValue(formData.categoryId, categories),
    [categories, formData.categoryId]
  );

  const technicalFields = useMemo(() => {
    const grouped = TECHNICAL_FIELDS_BY_CATEGORY[selectedCategoryName] || [];
    return grouped.filter((field) => {
      if (field === 'processor' || field === 'ram' || field === 'storage' || field === 'operatingSystem') return ['Computer', 'Laptop', 'Server'].includes(selectedCategoryName) || (selectedCategoryName && formData.assetType && ['Computer', 'Laptop', 'Server'].includes(formData.assetType));
      if (field === 'ipAddress' || field === 'macAddress' || field === 'hostname' || field === 'networkRole') return ['Network Device', 'Printer', 'Server'].includes(selectedCategoryName) || (selectedCategoryName && formData.assetType && ['Network Device', 'Printer', 'Server'].includes(formData.assetType));
      return true;
    });
  }, [formData.assetType, selectedCategoryName]);

  const validateField = (name, value) => {
    const nextErrors = { ...errors };
    switch (name) {
      case 'name':
        if (!String(value || '').trim()) nextErrors.name = 'Asset name is required.';
        else delete nextErrors.name;
        break;
      case 'assetCode':
        if (!String(value || '').trim()) nextErrors.assetCode = 'Asset tag or asset code is required.';
        else delete nextErrors.assetCode;
        break;
      case 'categoryId':
        if (!value) nextErrors.categoryId = 'Asset category is required.';
        else delete nextErrors.categoryId;
        break;
      case 'departmentId':
        if (!value) nextErrors.departmentId = 'Department is required.';
        else delete nextErrors.departmentId;
        break;
      case 'serialNumber':
        if (String(value || '').trim() && !/^[A-Za-z0-9\-_/]+$/.test(String(value).trim())) {
          nextErrors.serialNumber = 'Serial number contains invalid characters.';
        } else delete nextErrors.serialNumber;
        break;
      case 'purchasePrice':
        if (value === '' || value === null || value === undefined) delete nextErrors.purchasePrice;
        else if (Number(value) < 0) nextErrors.purchasePrice = 'Purchase price cannot be negative.';
        else delete nextErrors.purchasePrice;
        break;
      case 'purchaseDate':
        if (value && Number.isNaN(Date.parse(value))) nextErrors.purchaseDate = 'Purchase date is invalid.';
        else delete nextErrors.purchaseDate;
        break;
      case 'warrantyEnd':
        if (value && formData.purchaseDate && new Date(value) < new Date(formData.purchaseDate)) nextErrors.warrantyEnd = 'Warranty end must be on or after purchase date.';
        else delete nextErrors.warrantyEnd;
        break;
      case 'ipAddress':
        if (String(value || '').trim() && !/^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(String(value).trim())) {
          nextErrors.ipAddress = 'IP address format is invalid.';
        } else delete nextErrors.ipAddress;
        break;
      case 'macAddress':
        if (String(value || '').trim() && !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(String(value).trim())) {
          nextErrors.macAddress = 'MAC address format is invalid.';
        } else delete nextErrors.macAddress;
        break;
      default:
        break;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).filter((key) => nextErrors[key]).length === 0;
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    const next = { ...formData, [name]: value };
    setFormData(next);
    if (['name', 'assetCode', 'categoryId', 'departmentId', 'serialNumber', 'purchasePrice', 'purchaseDate', 'warrantyEnd', 'ipAddress', 'macAddress'].includes(name)) {
      validateField(name, value);
    }
  };

  const validateForm = async () => {
    const requiredFields = ['name', 'assetCode', 'categoryId', 'departmentId'];
    let valid = true;
    const nextErrors = { ...errors };

    requiredFields.forEach((field) => {
      if (!String(formData[field] || '').trim()) {
        nextErrors[field] = field === 'assetCode' ? 'Asset tag or asset code is required.' : field === 'categoryId' ? 'Asset category is required.' : field === 'departmentId' ? 'Department is required.' : 'Asset name is required.';
        valid = false;
      }
    });

    if (formData.purchasePrice !== '' && Number(formData.purchasePrice) < 0) {
      nextErrors.purchasePrice = 'Purchase price cannot be negative.';
      valid = false;
    }

    if (formData.ipAddress && !/^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(formData.ipAddress)) {
      nextErrors.ipAddress = 'IP address format is invalid.';
      valid = false;
    }

    if (formData.macAddress && !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(formData.macAddress)) {
      nextErrors.macAddress = 'MAC address format is invalid.';
      valid = false;
    }

    if (formData.assetCode) {
      try {
        const duplicateCheck = await axios.get(`/api/assets/check-id/${encodeURIComponent(formData.assetCode)}`);
        if (duplicateCheck.data?.exists) {
          nextErrors.assetCode = 'An asset with this Asset Tag already exists.';
          valid = false;
        } else {
          delete nextErrors.assetCode;
        }
      } catch (error) {
        // Ignore duplicate check failures; backend remains authoritative.
      }
    }

    if (formData.serialNumber) {
      try {
        const duplicateCheck = await axios.get(`/api/assets/check-serial/${encodeURIComponent(formData.serialNumber)}`);
        if (duplicateCheck.data?.exists) {
          nextErrors.serialNumber = 'An asset with this serial number already exists.';
          valid = false;
        } else {
          delete nextErrors.serialNumber;
        }
      } catch (error) {
        // Ignore duplicate check failures; backend remains authoritative.
      }
    }

    setErrors(nextErrors);
    return valid;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const isValid = await validateForm();
    if (!isValid) {
      toast.error('Please correct the highlighted fields before creating the asset.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        assetCode: String(formData.assetCode || '').trim(),
        name: String(formData.name || '').trim(),
        category: categoryNameFromValue(formData.categoryId, categories),
        category_id: formData.categoryId,
        assetType: formData.assetType,
        description: formData.description,
        manufacturer: formData.manufacturer,
        model: formData.model,
        serialNumber: String(formData.serialNumber || '').trim(),
        rfidTag: String(formData.macAddress || '').trim() || '',
        department: departments.find((dept) => String(dept.id) === String(formData.departmentId))?.name || '',
        department_id: formData.departmentId,
        location: formData.building || formData.room || formData.campus || '',
        campus: formData.campus,
        building: formData.building,
        room: formData.room,
        assignedTo: formData.assignedUser,
        custodian: formData.custodian,
        status: formData.status || 'available',
        condition: formData.status === 'in-use' ? 'Good' : 'Good',
        purchaseDate: formData.purchaseDate || null,
        purchasePrice: Number(formData.purchasePrice || 0),
        supplier: formData.supplier,
        purchaseOrderNumber: formData.purchaseOrderNumber,
        invoiceNumber: formData.invoiceNumber,
        warrantyExpiry: formData.warrantyEnd || null,
        notes: `${formData.internalNotes || ''}\n${formData.additionalInformation || ''}`.trim(),
        specifications: {
          ipAddress: formData.ipAddress,
          macAddress: formData.macAddress,
          hostname: formData.hostname,
          operatingSystem: formData.operatingSystem,
          processor: formData.processor,
          ram: formData.ram,
          storage: formData.storage,
          networkRole: formData.networkRole,
          material: formData.material,
          vehicleRegistration: formData.vehicleRegistration,
          engineNumber: formData.engineNumber,
          specificationNotes: formData.specificationNotes,
          additionalInformation: formData.additionalInformation,
        }
      };

      const response = await axios.post('/api/assets', payload);
      const nextAsset = response.data?.data || response.data?.asset || response.data;
      setCreatedAsset(nextAsset);
      toast.success('Asset created successfully.');
    } catch (error) {
      const message = error.response?.data?.message || 'Asset creation failed. Please try again.';
      toast.error(message);
      setErrors((current) => ({ ...current, form: message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (name) => ({
    ...fieldStyles.input,
    borderColor: errors[name] ? '#ef4444' : '#dfe7f1',
    boxShadow: errors[name] ? '0 0 0 3px rgba(239, 68, 68, 0.08)' : 'none'
  });

  const selectClass = (name) => ({
    ...fieldStyles.select,
    borderColor: errors[name] ? '#ef4444' : '#dfe7f1',
    boxShadow: errors[name] ? '0 0 0 3px rgba(239, 68, 68, 0.08)' : 'none'
  });

  const renderField = (label, name, type = 'text', options = null, placeholder = '', required = false) => (
    <div>
      <label style={fieldStyles.label}>
        {label}
        {required && <span style={fieldStyles.required}>*</span>}
      </label>
      {type === 'select' ? (
        <select name={name} value={formData[name]} onChange={handleFieldChange} style={selectClass(name)}>
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea name={name} value={formData[name]} onChange={handleFieldChange} placeholder={placeholder} style={{ ...fieldStyles.textarea, borderColor: errors[name] ? '#ef4444' : '#dfe7f1' }} />
      ) : (
        <input name={name} type={type} value={formData[name]} onChange={handleFieldChange} placeholder={placeholder} style={inputClass(name)} />
      )}
      {errors[name] && <span style={fieldStyles.error}>{errors[name]}</span>}
    </div>
  );

  const formContent = (
    <form onSubmit={handleSubmit} style={fieldStyles.wrapper}>
      <section style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#e0f2fe', display: 'grid', placeItems: 'center', color: '#0369a1' }}><Package size={20} /></div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Basic Information</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Register a new university asset</div>
          </div>
        </div>

        <div style={fieldStyles.row}>
          {renderField('Asset Name', 'name', 'text', null, 'Enter asset name', true)}
          {renderField('Asset Tag / Asset Code', 'assetCode', 'text', null, 'ICT-000001', true)}
          <div>
            <label style={fieldStyles.label}>Asset Category <span style={fieldStyles.required}>*</span></label>
            <select name="categoryId" value={formData.categoryId} onChange={handleFieldChange} style={selectClass('categoryId')}>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id || category.name} value={category.id || category.name}>{category.name}</option>
              ))}
            </select>
            {errors.categoryId && <span style={fieldStyles.error}>{errors.categoryId}</span>}
          </div>
          <div>
            <label style={fieldStyles.label}>Asset Type</label>
            <select name="assetType" value={formData.assetType} onChange={handleFieldChange} style={selectClass('assetType')}>
              <option value="">Select type</option>
              {[ 'Computer', 'Laptop', 'Server', 'Network Device', 'Printer', 'Furniture', 'Vehicle', 'Equipment', 'Software' ].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {renderField('Manufacturer', 'manufacturer')}
          {renderField('Model', 'model')}
          {renderField('Serial Number', 'serialNumber')}
          <div style={fieldStyles.full}>{renderField('Description', 'description', 'textarea', null, 'Short description of the asset')}</div>
        </div>
      </section>

      <section style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fef3c7', display: 'grid', placeItems: 'center', color: '#b45309' }}><Wrench size={20} /></div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Acquisition Information</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Purchase and warranty details</div>
          </div>
        </div>

        <div style={fieldStyles.row}>
          {renderField('Purchase Date', 'purchaseDate', 'date')}
          {renderField('Purchase Price', 'purchasePrice', 'number', null, '0.00')}
          {renderField('Currency', 'currency', 'select', [{ value: 'ETB', label: 'ETB' }, { value: 'USD', label: 'USD' }])}
          {renderField('Supplier / Vendor', 'supplier')}
          {renderField('Purchase Order Number', 'purchaseOrderNumber')}
          {renderField('Invoice Number', 'invoiceNumber')}
          {renderField('Warranty Start', 'warrantyStart', 'date')}
          {renderField('Warranty End', 'warrantyEnd', 'date')}
        </div>
      </section>

      <section style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#dcfce7', display: 'grid', placeItems: 'center', color: '#166534' }}><MapPin size={20} /></div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Location & Assignment</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Campus, department, and custodian</div>
          </div>
        </div>

        <div style={fieldStyles.row}>
          {renderField('Campus', 'campus')}
          {renderField('Building', 'building')}
          <div>
            <label style={fieldStyles.label}>Department <span style={fieldStyles.required}>*</span></label>
            <select name="departmentId" value={formData.departmentId} onChange={handleFieldChange} style={selectClass('departmentId')}>
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id || department.name} value={department.id || department.name}>{department.name}</option>
              ))}
            </select>
            {errors.departmentId && <span style={fieldStyles.error}>{errors.departmentId}</span>}
          </div>
          {renderField('Room / Office', 'room')}
          {renderField('Custodian', 'custodian')}
          <div>
            <label style={fieldStyles.label}>Assigned User</label>
            <select name="assignedUser" value={formData.assignedUser} onChange={handleFieldChange} style={selectClass('assignedUser')}>
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id || user.username} value={user.id || user.username}>{user.fullName || user.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={fieldStyles.label}>Asset Status</label>
            <select name="status" value={formData.status} onChange={handleFieldChange} style={selectClass('status')}>
              <option value="available">Available</option>
              <option value="in-use">In Use</option>
              <option value="under-maintenance">Under Maintenance</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
        </div>
      </section>

      {technicalFields.length > 0 && (
        <section style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#e0e7ff', display: 'grid', placeItems: 'center', color: '#4338ca' }}><ShieldCheck size={20} /></div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Technical Information</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Asset-specific configuration</div>
            </div>
          </div>

          <div style={fieldStyles.row}>
            {technicalFields.includes('ipAddress') && renderField('IP Address', 'ipAddress', 'text', null, '192.168.1.10')}
            {technicalFields.includes('macAddress') && renderField('MAC Address', 'macAddress', 'text', null, '00:1A:2B:3C:4D:5E')}
            {technicalFields.includes('hostname') && renderField('Hostname', 'hostname')}
            {technicalFields.includes('operatingSystem') && renderField('Operating System', 'operatingSystem')}
            {technicalFields.includes('processor') && renderField('Processor', 'processor')}
            {technicalFields.includes('ram') && renderField('RAM', 'ram')}
            {technicalFields.includes('storage') && renderField('Storage', 'storage')}
            {technicalFields.includes('networkRole') && renderField('Network Role', 'networkRole')}
            {technicalFields.includes('material') && renderField('Material', 'material')}
            {technicalFields.includes('vehicleRegistration') && renderField('Vehicle Registration', 'vehicleRegistration')}
            {technicalFields.includes('engineNumber') && renderField('Engine Number', 'engineNumber')}
            {technicalFields.includes('specificationNotes') && renderField('Specification Notes', 'specificationNotes', 'textarea')}
          </div>
        </section>
      )}

      <section style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#dbeafe', display: 'grid', placeItems: 'center', color: '#1d4ed8' }}><Upload size={20} /></div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Documents & Media</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Supporting documents and asset image</div>
          </div>
        </div>

        <div style={fieldStyles.row}>
          {renderField('Asset image', 'assetImage', 'file')}
          {renderField('Invoice', 'invoiceDocument', 'file')}
          {renderField('Purchase document', 'purchaseDocument', 'file')}
          {renderField('Warranty document', 'warrantyDocument', 'file')}
          {renderField('Other attachment', 'otherAttachment', 'file')}
        </div>
      </section>

      <section style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f3e8ff', display: 'grid', placeItems: 'center', color: '#7c3aed' }}><FileText size={20} /></div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Notes</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Internal review notes</div>
          </div>
        </div>

        <div style={fieldStyles.row}>
          <div style={fieldStyles.full}>{renderField('Internal Notes', 'internalNotes', 'textarea')}</div>
          <div style={fieldStyles.full}>{renderField('Additional Information', 'additionalInformation', 'textarea')}</div>
        </div>
      </section>

      {isReviewing && (
        <section style={{ background: '#f8fafc', border: '1px solid #dfe7f1', borderRadius: '18px', padding: '24px' }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '16px' }}>Review</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
            <div><strong>Asset Name</strong><div>{formData.name || '—'}</div></div>
            <div><strong>Asset Tag</strong><div>{formData.assetCode || '—'}</div></div>
            <div><strong>Category</strong><div>{selectedCategoryName}</div></div>
            <div><strong>Department</strong><div>{departments.find((department) => String(department.id) === String(formData.departmentId))?.name || '—'}</div></div>
            <div><strong>Location</strong><div>{[formData.campus, formData.building, formData.room].filter(Boolean).join(' / ') || '—'}</div></div>
            <div><strong>Assigned User</strong><div>{users.find((user) => String(user.id) === String(formData.assignedUser))?.fullName || formData.assignedUser || '—'}</div></div>
            <div><strong>Purchase Information</strong><div>{formData.purchasePrice ? `${formData.currency} ${formData.purchasePrice}` : '—'}</div></div>
            <div><strong>Status</strong><div>{formData.status || 'available'}</div></div>
          </div>
        </section>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '28px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => navigate('/ict/assets')} style={{ border: '1px solid #dfe7f1', background: '#fff', color: '#0f172a', borderRadius: '12px', padding: '12px 18px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Back to Assets
        </button>
        <button type="button" onClick={() => setIsReviewing((current) => !current)} style={{ border: '1px solid #dfe7f1', background: '#fff', color: '#0f172a', borderRadius: '12px', padding: '12px 18px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <FileText size={16} /> {isReviewing ? 'Hide Review' : 'Review'}
        </button>
        <button type="button" style={{ border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', borderRadius: '12px', padding: '12px 18px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Save size={16} /> Save Draft
        </button>
        <button type="submit" disabled={isSubmitting} style={{ border: 'none', background: '#12A8E0', color: '#fff', borderRadius: '12px', padding: '12px 22px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? 'Creating asset...' : 'Create Asset'}
          {!isSubmitting && <ArrowRight size={16} />}
        </button>
      </div>
    </form>
  );

  if (createdAsset) {
    return (
      <div style={{ maxWidth: '920px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#dcfce7', display: 'grid', placeItems: 'center', color: '#166534' }}><CheckCircle2 size={26} /></div>
            <div>
              <div style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: '#64748b' }}>Success</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>Asset created successfully</div>
            </div>
          </div>
          <div style={{ color: '#334155', lineHeight: 1.8, marginBottom: '16px' }}>
            <div><strong>Asset:</strong> {createdAsset.name || '—'}</div>
            <div><strong>Asset Tag:</strong> {createdAsset.assetCode || createdAsset.asset_code || '—'}</div>
            <div><strong>Status:</strong> {createdAsset.status || 'available'}</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => navigate(`/ict/assets/${createdAsset.id || ''}`)} style={{ border: 'none', background: '#12A8E0', color: '#fff', borderRadius: '12px', padding: '12px 18px', fontWeight: 700, cursor: 'pointer' }}>View Asset</button>
            <button type="button" onClick={() => { setCreatedAsset(null); setFormData({ ...formData, name: '', assetCode: '', description: '', manufacturer: '', model: '', serialNumber: '', purchaseDate: '', purchasePrice: '', supplier: '', purchaseOrderNumber: '', invoiceNumber: '', warrantyEnd: '', campus: '', building: '', room: '', custodian: '', assignedUser: '', status: 'available', ipAddress: '', macAddress: '', hostname: '', operatingSystem: '', processor: '', ram: '', storage: '', networkRole: '', material: '', vehicleRegistration: '', engineNumber: '', specificationNotes: '', internalNotes: '', additionalInformation: '', assetImage: '', invoiceDocument: '', purchaseDocument: '', warrantyDocument: '', otherAttachment: '' }); setErrors({}); setIsReviewing(false); }} style={{ border: '1px solid #dfe7f1', background: '#fff', color: '#0f172a', borderRadius: '12px', padding: '12px 18px', fontWeight: 700, cursor: 'pointer' }}>Create Another Asset</button>
            <Link to="/ict/assets" style={{ border: '1px solid #dfe7f1', background: '#fff', color: '#0f172a', borderRadius: '12px', padding: '12px 18px', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={16} /> Back to Assets</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px' }}>
      <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <nav style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }} aria-label="Breadcrumb">
          <span>Asset Management</span>
          <span>&gt;</span>
          <span>Assets</span>
          <span>&gt;</span>
          <strong style={{ color: '#0f172a' }}>Create Asset</strong>
        </nav>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '36px', lineHeight: 1.1, color: '#0f172a' }}>Create New Asset</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '15px' }}>Register and configure a university asset in the asset management system.</p>
        </div>
        <button type="button" onClick={() => navigate('/ict/assets')} style={{ border: '1px solid #dfe7f1', background: '#fff', color: '#0f172a', borderRadius: '12px', padding: '12px 18px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Back to Assets
        </button>
      </div>

      {errors.form && <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '12px 14px', borderRadius: '12px', marginBottom: '18px' }}>{errors.form}</div>}

      {formContent}
    </div>
  );
};

export default ICTCreateAsset;