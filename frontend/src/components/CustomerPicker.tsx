import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { searchCustomers } from '../api/endpoints.ts';
import type { StaffCustomer } from '../api/types.ts';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; customers: StaffCustomer[] };

interface Search {
  term: string;
  id: number;
}

interface CustomerPickerProps {
  selectedId: string | null;
  onSelect: (customer: StaffCustomer) => void;
  disabled?: boolean;
}

export function CustomerPicker({ selectedId, onSelect, disabled = false }: CustomerPickerProps) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState<Search | null>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    if (search === null) {
      return undefined;
    }
    const controller = new AbortController();
    void searchCustomers(search.term, controller.signal).then(
      (customers) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'ready', customers });
        }
      },
      (err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'error', message: describeApiError(err) });
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [search]);

  function runSearch(term: string) {
    setState({ kind: 'loading' });
    setSearch((previous) => ({ term, id: (previous === null ? 0 : previous.id) + 1 }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(text.trim());
  }

  return (
    <div>
      <form aria-label="Find a customer" onSubmit={handleSubmit}>
        <label htmlFor="customer-search">Customer name or email</label>{' '}
        <input
          id="customer-search"
          type="text"
          maxLength={100}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />{' '}
        <button type="submit" disabled={disabled}>
          Search
        </button>
      </form>
      {state.kind === 'idle' && <p>Search to find a customer. Leave it empty to list the first few.</p>}
      {state.kind === 'loading' && <p role="status">Searching...</p>}
      {state.kind === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => {
              runSearch(search === null ? '' : search.term);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' && state.customers.length === 0 && <p>No matching customers.</p>}
      {state.kind === 'ready' && state.customers.length > 0 && (
        <ul aria-label="Matching customers">
          {state.customers.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                aria-pressed={selectedId === customer.id}
                disabled={disabled}
                onClick={() => {
                  onSelect(customer);
                }}
              >
                {`${customer.full_name} (${customer.email})`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
