import { useState } from 'react';
import { ClosureForm } from '../components/ClosureForm.tsx';
import { ClosureList } from '../components/ClosureList.tsx';
import { useUnavailablePeriods } from '../hooks/useUnavailablePeriods.ts';
import { todayInJakarta } from '../lib/dates.ts';

export function ClosuresPage() {
  const [from] = useState(() => todayInJakarta());
  const { state, retry, loadMore, create, remove } = useUnavailablePeriods(from);

  return (
    <div>
      <h1>Closures</h1>
      <p>Closures block booking for everyone. The list shows closures from today onward.</p>
      <ClosureForm onCreate={create} />
      <ClosureList state={state} onRetry={retry} onLoadMore={loadMore} onRemove={remove} />
    </div>
  );
}
