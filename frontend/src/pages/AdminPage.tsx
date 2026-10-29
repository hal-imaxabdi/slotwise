import { useId, useState } from 'react';
import AdminServiceForm from '../components/AdminServiceForm.tsx';
import { AdminServiceList } from '../components/AdminServiceList.tsx';
import type { AdminServiceFilter } from '../hooks/useAdminServices.ts';

const FILTER_OPTIONS: { value: AdminServiceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function AdminPage() {
  const uid = useId();
  const [filter, setFilter] = useState<AdminServiceFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [listVersion, setListVersion] = useState(0);

  return (
    <div>
      <h1>Admin</h1>
      <div>
        <label htmlFor={`${uid}-filter`}>Show</label>
        <select
          id={`${uid}-filter`}
          value={filter}
          onChange={(e) => setFilter(e.target.value as AdminServiceFilter)}
        >
          {FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        aria-expanded={addOpen}
        aria-controls={`${uid}-add`}
        onClick={() => setAddOpen((open) => !open)}
      >
        Add a service
      </button>
      {addOpen && (
        <div id={`${uid}-add`}>
          <AdminServiceForm onSaved={() => setListVersion((v) => v + 1)} />
        </div>
      )}
      <AdminServiceList key={`${filter}-${listVersion}`} filter={filter} />
    </div>
  );
}
