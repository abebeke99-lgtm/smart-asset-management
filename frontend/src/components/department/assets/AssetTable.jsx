import React from 'react';

const columns = [
  ['assetId', 'assetId'],
  ['digitalId', 'digitalId'],
  ['name', 'assetName'],
  ['category', 'category'],
  ['serialNumber', 'serialNumber'],
  ['quantity', 'quantity'],
  ['status', 'status'],
  ['condition', 'condition'],
  ['location', 'location'],
  ['assignedUser', 'assignedUser'],
  ['purchaseDate', 'purchaseDate'],
  ['warranty', 'warranty'],
  ['qrCode', 'qrCode'],
  ['rfid', 'rfid'],
  ['maintenanceStatus', 'maintenanceStatus'],
];

const AssetTable = ({ assets, labels, onSelect, sortBy, sortOrder, onSort }) => {
  const display = (asset, key) => {
    const values = {
      assetId: asset.assetCode || asset.asset_code || asset.asset_tag || asset.id,
      digitalId: asset.digitalId || asset.digital_id,
      name: asset.name,
      category: asset.category || asset.category_name,
      serialNumber: asset.serialNumber || asset.serial_number,
      quantity: asset.quantity,
      status: asset.status,
      condition: asset.condition,
      location: asset.location,
      assignedUser: asset.assignedUser?.fullName || asset.assignedUser?.name || asset.assigned_to_name || asset.assignedUserName,
      purchaseDate: asset.purchaseDate || asset.purchase_date,
      warranty: asset.warrantyExpiry || asset.warranty_expiry,
      qrCode: asset.qrCode || asset.qr_code,
      rfid: asset.rfidTag || asset.rfid_tag,
      maintenanceStatus: asset.maintenanceStatus || asset.maintenance_status,
    };
    const value = values[key];
    if (value === null || value === undefined || value === '') return labels.notProvided;
    if (['purchaseDate', 'warranty'].includes(key)) return new Date(value).toLocaleDateString();
    return String(value);
  };
  const isWarrantySoon = (asset) => {
    const value = asset.warrantyExpiry || asset.warranty_expiry;
    if (!value) return false;
    const remaining = new Date(value).getTime() - Date.now();
    return remaining >= 0 && remaining <= 30 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="dha-table-wrap">
      <table className="dha-table">
        <thead><tr>{columns.map(([key, label]) => (
          <th key={key} aria-sort={sortBy === key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" onClick={() => onSort(key)}>{labels[label]}{sortBy === key ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}</button>
          </th>
        ))}</tr></thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} tabIndex={0} onClick={() => onSelect(asset)} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(asset);
              }
            }}>
              {columns.map(([key, label]) => (
                <td key={key} data-label={labels[label]}>
                  {key === 'status' || key === 'maintenanceStatus' ? (
                    <span className={`dha-badge dha-badge-${display(asset, key).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{display(asset, key)}</span>
                  ) : key === 'warranty' && isWarrantySoon(asset) ? (
                    <span className="dha-warranty-soon" title={labels.expiringSoon}>{display(asset, key)} !</span>
                  ) : display(asset, key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AssetTable;
