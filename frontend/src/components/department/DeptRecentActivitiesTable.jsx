import React, { useMemo, useState } from 'react';

const PAGE_SIZE = 5;
const SORT_FIELDS = ['user', 'action', 'entity', 'status', 'date'];

const DeptRecentActivitiesTable = ({ activities, language, translations: t }) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const locale = language === 'am' ? 'am-ET' : 'en-US';

  const actions = useMemo(() => [...new Set(activities.map(({ action }) => action))].sort(), [activities]);
  const statuses = useMemo(() => [...new Set(activities.map(({ status }) => status))].sort(), [activities]);
  const filteredActivities = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return activities
      .filter((activity) => (
        (!actionFilter || activity.action === actionFilter)
        && (!statusFilter || activity.status === statusFilter)
        && (!query || `${activity.user} ${activity.action} ${activity.entity} ${activity.status}`
          .toLocaleLowerCase(locale)
          .includes(query))
      ))
      .map((activity, index) => ({ activity, index }))
      .sort((left, right) => {
        const first = left.activity[sortField];
        const second = right.activity[sortField];
        const comparison = sortField === 'date'
          ? new Date(first).getTime() - new Date(second).getTime()
          : String(first).localeCompare(String(second), locale, { sensitivity: 'base' });
        return (comparison * (sortDirection === 'asc' ? 1 : -1)) || (left.index - right.index);
      })
      .map(({ activity }) => activity);
  }, [activities, actionFilter, locale, search, sortDirection, sortField, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleActivities = filteredActivities.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const resetPage = (update) => (event) => {
    update(event.target.value);
    setPage(1);
  };

  return (
    <section className="dept-dashboard__card dept-dashboard__activities" aria-labelledby="dept-dashboard-activities-title">
      <h2 className="dept-dashboard__card-title" id="dept-dashboard-activities-title">{t.recentActivities}</h2>
      <div className="dept-dashboard__activity-tools">
        <label className="dept-dashboard__activity-search">
          <span>{t.searchActivities}</span>
          <input
            type="search"
            value={search}
            onChange={resetPage(setSearch)}
            aria-label={t.searchActivities}
          />
        </label>
        <label className="dept-dashboard__activity-filter">
          <span>{t.filterByAction}</span>
          <select value={actionFilter} onChange={resetPage(setActionFilter)} aria-label={t.filterByAction}>
            <option value="">{t.allActions}</option>
            {actions.map((action) => <option key={action} value={action}>{t.actions[action] || action}</option>)}
          </select>
        </label>
        <label className="dept-dashboard__activity-filter">
          <span>{t.filterByStatus}</span>
          <select value={statusFilter} onChange={resetPage(setStatusFilter)} aria-label={t.filterByStatus}>
            <option value="">{t.allStatuses}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t.statuses[status] || t.statuses[Object.keys(t.statuses).find((label) => label.toLowerCase() === status.toLowerCase())] || status}
              </option>
            ))}
          </select>
        </label>
        <label className="dept-dashboard__activity-filter">
          <span>{t.sortBy}</span>
          <select value={sortField} onChange={resetPage(setSortField)} aria-label={t.sortBy}>
            {SORT_FIELDS.map((field) => <option key={field} value={field}>{t[field === 'date' ? 'dateTime' : field]}</option>)}
          </select>
        </label>
        <button
          className="dept-dashboard__activity-sort-direction"
          type="button"
          aria-label={sortDirection === 'desc' ? t.sortAscending : t.sortDescending}
          onClick={() => {
            setSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'));
            setPage(1);
          }}
        >
          {sortDirection === 'desc' ? t.sortDescending : t.sortAscending}
        </button>
        {filteredActivities.length > 0 && (
          <div className="dept-dashboard__activity-pagination" aria-label={t.recentActivities}>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage <= 1}
              aria-label={t.previousPage}
            >
              {t.previousPage}
            </button>
            <span aria-live="polite">{t.activityPage} {currentPage} {t.of} {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              disabled={currentPage >= pageCount}
              aria-label={t.nextPage}
            >
              {t.nextPage}
            </button>
          </div>
        )}
      </div>
      {activities.length ? (
        <div className="dept-dashboard__activity-scroll">
          <table className="dept-dashboard__activity-table" aria-label={t.recentActivities}>
            <thead>
              <tr>
                <th scope="col">{t.user}</th>
                <th scope="col">{t.action}</th>
                <th scope="col">{t.entity}</th>
                <th scope="col">{t.status}</th>
                <th scope="col">{t.dateTime}</th>
              </tr>
            </thead>
            <tbody>
              {visibleActivities.map((activity) => (
                <tr key={activity.id}>
                  <td data-label={t.user}>{activity.user}</td>
                  <td data-label={t.action}>{t.actions[activity.action] || activity.action}</td>
                  <td data-label={t.entity}>{activity.entity}</td>
                  <td data-label={t.status}>
                    {t.statuses[activity.status]
                      || t.statuses[Object.keys(t.statuses).find((label) => label.toLowerCase() === activity.status.toLowerCase())]
                      || activity.status}
                  </td>
                  <td data-label={t.dateTime}>
                    <time dateTime={activity.date}>{new Date(activity.date).toLocaleString(locale)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleActivities.length && (
            <p className="dept-dashboard__activity-no-results" role="status">{t.noMatchingActivities}</p>
          )}
        </div>
      ) : (
        <p className="dept-dashboard__empty">{t.noActivities}</p>
      )}
    </section>
  );
};

export default DeptRecentActivitiesTable;
