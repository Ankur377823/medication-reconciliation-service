import { useMemo, useState } from 'react';

import Icon from './Icon.jsx';

/**
 * Sortable table.
 * columns: [{ key, header, render?, sortValue?, align? }]
 *   - sortValue(row) makes the column sortable.
 * defaultSort: { key, direction: 'asc' | 'desc' }
 */
export default function DataTable({ columns, rows, rowKey, defaultSort, onRowClick, caption }) {
  const [sort, setSort] = useState(defaultSort || null);

  const sortedRows = useMemo(() => {
    const column = sort && columns.find((col) => col.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = column.sortValue(a);
      const right = column.sortValue(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
    });
  }, [rows, columns, sort]);

  function toggleSort(key) {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: 'asc' };
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  return (
    <div className="table-wrap">
      <table className={`table${onRowClick ? ' table--clickable' : ''}`}>
        {caption ? <caption className="visually-hidden">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const iconName = !active ? 'sort' : sort.direction === 'asc' ? 'arrowUp' : 'arrowDown';
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={column.align === 'right' ? 'align-right' : undefined}
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="table__sort"
                      aria-pressed={active}
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.header}
                      <Icon name={iconName} size={12} className="table__sort-icon" strokeWidth={2.2} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'align-right' : undefined}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
