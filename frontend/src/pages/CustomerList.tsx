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
} from 'lucide-react';
import { useCustomers, type Customer } from '@/hooks/useCustomers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

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
  vip: 'bg-amber-100 text-amber-800 border-amber-200',
  churned: 'bg-red-100 text-red-800 border-red-200',
  loyal: 'bg-green-100 text-green-800 border-green-200',
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  premium: 'bg-purple-100 text-purple-800 border-purple-200',
};

function TagBadge({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {tag}
    </span>
  );
}

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow>
      {[...Array(7)].map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total.toLocaleString()} total customers` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 shadow-sm">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="text-xl font-semibold text-foreground">
            {isLoading ? '—' : (data?.total ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="customer-search"
          placeholder="Search name, email, city…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isError ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Failed to load customers. Please try again.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[220px]">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>City</TableHead>
                <TableHead>
                  <button
                    id="sort-total-spent"
                    onClick={() => toggleSort('total_spent')}
                    className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Total Spent
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>
                  <button
                    id="sort-last-order"
                    onClick={() => toggleSort('last_order_at')}
                    className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Last Order
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                : sorted.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                        {search ? `No customers match "${search}"` : 'No customers found.'}
                      </TableCell>
                    </TableRow>
                  )
                  : sorted.map((customer) => (
                    <TableRow
                      key={customer.id}
                      id={`customer-row-${customer.id}`}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {customer.name[0]?.toUpperCase()}
                          </div>
                          <span className="truncate max-w-[160px]">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.city ?? '—'}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {formatCurrency(customer.total_spent)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.order_count}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(customer.last_order_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {customer.tags.slice(0, 3).map((tag) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                          {customer.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
            Page {page} of {data.pages} · {data.total.toLocaleString()} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              id="customers-prev-page"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
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
