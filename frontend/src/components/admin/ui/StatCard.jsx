import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StatCard({ icon: Icon, label, title, value, trend, href, tone = 'info' }) {
  const content = (
    <>
      {Icon && <span className={`admin-stat-icon is-${tone}`}><Icon size={19} aria-hidden="true" /></span>}
      <span className="admin-stat-copy"><span>{label || title}</span><strong>{value}</strong>
        {trend !== undefined && <small className={Number(trend) < 0 ? 'is-negative' : 'is-positive'}>{Number(trend) < 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{Math.abs(Number(trend))}%</small>}
      </span>
    </>
  );
  return href ? <Link className="admin-stat-card" to={href}>{content}</Link> : <article className="admin-stat-card">{content}</article>;
}