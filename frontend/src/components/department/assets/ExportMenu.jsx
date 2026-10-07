import React, { useState } from 'react';

const formats = ['csv', 'xlsx', 'pdf'];
const ExportMenu = ({ labels, onExport, disabled }) => {
  const [open, setOpen] = useState(false);
  const formatLabels = { csv: labels.csv, xlsx: labels.excel, pdf: labels.pdf };
  return (
    <div className="dha-export-menu">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} disabled={disabled}>{labels.export}</button>
      {open && <div role="menu">
        {formats.map((format) => (
          <button type="button" role="menuitem" key={format} onClick={() => {
            setOpen(false);
            onExport(format);
          }}>{formatLabels[format]}</button>
        ))}
      </div>}
    </div>
  );
};

export default ExportMenu;
