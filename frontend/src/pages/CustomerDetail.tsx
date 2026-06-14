import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  TrendingUp,
  Calendar,
  Package,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { useCustomer, useCustomerOrders } from '@/hooks/useCustomers';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
  refunded: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  sent: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  delivered: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
  failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  opened: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30',
  clicked: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

// ── Tag badge ─────────────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  vip: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  churned: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  loyal: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
  new: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  premium: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 dark:border-fuchsia-500/30',
};

function TagBadge({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {tag}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 glass-card px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-crm-blue-dim dark:text-blue-500">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading, isError } = useCustomer(id!);
  const { data: orders = [], isLoading: ordersLoading } = useCustomerOrders(id!);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-200 dark:bg-white/10" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Skeleton className="h-64 w-full rounded-xl bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full rounded-xl bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="py-12">
        <ErrorMessage 
          message="Customer not found. They may have been deleted or don't exist."
        />
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => navigate('/customers')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => navigate('/customers')}
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Customers
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 text-white text-xl font-bold shadow-sm">
              {customer.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{customer.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{customer.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {customer.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Total Spent"
          value={formatCurrency(customer.total_spent)}
        />
        <StatCard
          icon={ShoppingBag}
          label="Orders"
          value={customer.order_count.toString()}
        />
        <StatCard
          icon={Calendar}
          label="Last Order"
          value={formatDate(customer.last_order_at)}
        />
        <StatCard
          icon={MapPin}
          label="City"
          value={customer.city ?? '—'}
        />
      </div>

      {/* Contact card + tabs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Profile card */}
        <div className="glass-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5 text-slate-500 dark:text-slate-400">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
              <span className="break-all">{customer.email}</span>
            </li>
            {customer.phone && (
              <li className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                <Phone className="h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                {customer.phone}
              </li>
            )}
            {customer.city && (
              <li className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                <MapPin className="h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                {customer.city}
              </li>
            )}
            <li className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
              <Calendar className="h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
              Joined {formatDate(customer.created_at)}
            </li>
          </ul>

          {customer.tags.length > 0 && (
            <div className="mt-5 border-t border-slate-200 dark:border-white/10 pt-4">
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs: orders + comms */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="orders" id="tab-orders">
                <Package className="mr-2 h-4 w-4" />
                Orders ({orders.length})
              </TabsTrigger>
              <TabsTrigger value="comms" id="tab-comms">
                <MessageSquare className="mr-2 h-4 w-4" />
                Communications
              </TabsTrigger>
            </TabsList>

            {/* Orders tab */}
            <TabsContent value="orders">
              <div className="glass-card overflow-hidden">
                {ordersLoading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : isError ? (
                  <div className="py-12">
                    <ErrorMessage message="Failed to load orders." />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <ShoppingBag className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500/40" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No orders found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-[#1a1f2e] border-slate-200 dark:border-white/[0.07] hover:bg-slate-50 dark:hover:bg-[#1a1f2e]">
                        <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Amount</TableHead>
                        <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Status</TableHead>
                        <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Channel</TableHead>
                        <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Ordered At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id} className="border-slate-100 dark:border-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                          <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrency(order.amount)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400">
                            {order.channel ?? '—'}
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400">
                            {formatDateTime(order.ordered_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* Communications tab */}
            <TabsContent value="comms">
              <div className="glass-card overflow-hidden">
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <MessageSquare className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500/40" />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Communication history
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Messages sent to this customer will appear here once campaigns are launched.
                  </p>
                  <Button
                    id="create-campaign-from-customer"
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2 bg-transparent border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
                    onClick={() => navigate('/campaigns/new')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Create Campaign
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
