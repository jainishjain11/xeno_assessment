import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Calendar,
  ArrowUpDown,
  UserPlus,
} from 'lucide-react';
import { useCustomers, type Customer } from '@/hooks/useCustomers';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (val: T) => {
      if (timer) clearTimeout(timer);
      const t = setTimeout(() => setDebounced(val), delay);
      setTimer(t);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delay]
  );

  return debounced;
  // We expose a setter pattern below instead
  void update;
}

// ── Tag badge colors ──────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  vip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400',
  churned: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400',
  loyal: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400',
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400',
  premium: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-400',
};

function TagBadge({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {tag}
    </span>
  );
}

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow className="border-slate-200 dark:border-white/10 hover:bg-transparent">
      {[...Array(7)].map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full bg-slate-200 dark:bg-white/10" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function CustomerList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof Customer | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Debounce search: update after 300ms of no typing
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    const t = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 300);
    setDebounceTimer(t);
  };

  const { data, isLoading, isError } = useCustomers(page, 50, search);

  // Client-side sort
  const sorted = data
    ? [...data.items].sort((a, b) => {
        if (!sortField) return 0;
        const av = a[sortField] ?? '';
        const bv = b[sortField] ?? '';
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : [];

  const toggleSort = (field: keyof Customer) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Customers</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {data ? `${data.total.toLocaleString()} total customers` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2 glass-card px-4 py-2">
          <Users className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {isLoading ? '—' : (data?.total ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id="customer-search"
          placeholder="Search name, email, city…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/20 dark:bg-white/5 dark:border-white/10 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400/50 dark:focus:ring-blue-400/10"
        />
      </div>

      {/* Table card */}
      <div className="glass-card overflow-hidden">
        {isError ? (
          <ErrorMessage 
            message="Failed to load customers." 
            onRetry={() => window.location.reload()} 
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-[#1a1f2e] border-slate-200 dark:border-white/[0.07] hover:bg-slate-50 dark:hover:bg-[#1a1f2e]">
                <TableHead className="w-[220px] text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Name</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Email</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">City</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">
                  <button
                    id="sort-total-spent"
                    onClick={() => toggleSort('total_spent')}
                    className="flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 uppercase"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Total Spent
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Orders</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">
                  <button
                    id="sort-last-order"
                    onClick={() => toggleSort('last_order_at')}
                    className="flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 uppercase"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Last Order
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                : sorted.length === 0 ? (
                    <TableRow className="border-slate-200 dark:border-white/10 hover:bg-transparent">
                      <TableCell colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Users className="h-10 w-10 text-slate-400 dark:text-slate-500/40" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {search ? `No customers match "${search}"` : 'No customers yet.'}
                          </p>
                          {!search && (
                            <Button
                              id="import-customers-empty-btn"
                              variant="outline"
                              size="sm"
                              className="gap-2 mt-2 bg-transparent border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
                              onClick={() => {
                                alert('Import customer functionality to be implemented');
                              }}
                            >
                              <UserPlus className="h-4 w-4" />
                              Import Customers
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : sorted.map((customer) => (
                    <TableRow
                      key={customer.id}
                      id={`customer-row-${customer.id}`}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] border-slate-100 dark:border-white/[0.05]"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-crm-blue-dim dark:text-blue-500 text-sm font-semibold">
                            {customer.name[0]?.toUpperCase()}
                          </div>
                          <span className="truncate max-w-[160px]">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400">{customer.email}</TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400">
                        {customer.city ?? '—'}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(customer.total_spent)}
                      </TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400">
                        {customer.order_count}
                      </TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400">
                        {formatDate(customer.last_order_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {customer.tags.slice(0, 3).map((tag) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                          {customer.tags.length > 3 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              +{customer.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page {page} of {data.pages} · {data.total.toLocaleString()} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              id="customers-prev-page"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-transparent border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              id="customers-next-page"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="bg-transparent border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
