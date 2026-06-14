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
  completed: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  refunded: 'bg-red-100 text-red-800 border-red-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  opened: 'bg-purple-100 text-purple-800 border-purple-200',
  clicked: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

// ── Tag badge ─────────────────────────────────────────────────────────────────
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
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground">{value}</p>
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
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full rounded-xl" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold shadow-md">
              {customer.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">{customer.email}</p>
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
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Profile</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5 text-muted-foreground">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span className="break-all">{customer.email}</span>
            </li>
            {customer.phone && (
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0 text-primary" />
                {customer.phone}
              </li>
            )}
            {customer.city && (
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0 text-primary" />
                {customer.city}
              </li>
            )}
            <li className="flex items-center gap-2.5 text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0 text-primary" />
              Joined {formatDate(customer.created_at)}
            </li>
          </ul>

          {customer.tags.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                    <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No orders found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Ordered At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium text-foreground">
                            {formatCurrency(order.amount)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.channel ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
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
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">
                    Communication history
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Messages sent to this customer will appear here once campaigns are launched.
                  </p>
                  <Button
                    id="create-campaign-from-customer"
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2"
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
