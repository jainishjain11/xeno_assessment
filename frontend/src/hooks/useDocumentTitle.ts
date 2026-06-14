import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard | Aura CRM',
  '/customers': 'Customers | Aura CRM',
  '/segments': 'Segments | Aura CRM',
  '/segments/new': 'New Segment | Aura CRM',
  '/campaigns': 'Campaigns | Aura CRM',
  '/campaigns/new': 'New Campaign | Aura CRM',
  '/ai': 'AI Assistant | Aura CRM',
  '/login': 'Login | Aura CRM',
};

export function useDocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    // Exact match
    if (ROUTE_TITLES[location.pathname]) {
      document.title = ROUTE_TITLES[location.pathname];
      return;
    }

    // Dynamic routes
    if (location.pathname.startsWith('/customers/')) {
      document.title = 'Customer Details | Aura CRM';
    } else if (location.pathname.startsWith('/segments/')) {
      document.title = 'Segment Details | Aura CRM';
    } else if (location.pathname.startsWith('/campaigns/')) {
      document.title = 'Campaign Details | Aura CRM';
    } else {
      document.title = 'Aura CRM';
    }
  }, [location]);
}
