const fs = require('fs');
const path = require('path');
const files = ['assetRoutes.js','assignmentRoutes.js','inventoryRoutes.js','transactionRoutes.js','transferRoutes.js','transferWorkflowRoutes.js','returnWorkflowRoutes.js','approvalRoutes.js','financeRoutes.js','storeRoutes.js'];
const findings = [];
files.forEach(f => {
  const p = path.join('backend','src','routes',f);
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, 'utf8');
  const lines = txt.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (l.trim().startsWith('router.') && /(get|post|put|patch|delete)\s*\(/.test(l)) {
      const lineNum = i + 1;
      const m = l.match(/router\.(get|post|put|patch|delete)\s*\(/);
      const method = m ? m[1].toUpperCase() : 'UNKNOWN';
      const rest = l.slice(l.indexOf('(') + 1);
      const pathMatch = rest.match(/["']([^"']+)["']/);
      const routePath = pathMatch ? pathMatch[1] : 'unknown';
      const authz = [];
      if (/requireRole/.test(l)) authz.push('requireRole');
      if (/requirePermission/.test(l)) authz.push('requirePermission');
      if (/requireAnyPermission/.test(l)) authz.push('requireAnyPermission');
      if (/authorize/.test(l)) authz.push('authorize');
      if (authz.length === 0) authz.push('none-visible');
      findings.push({file:f,line:lineNum,method:method+' '+routePath,authz:authz.join(',')});
    }
  });
});
findings.forEach(r=>{
  console.log(r.file+':'+r.line+' | '+r.method+' | authz='+r.authz);
});
console.log('TOTAL:'+findings.length);
