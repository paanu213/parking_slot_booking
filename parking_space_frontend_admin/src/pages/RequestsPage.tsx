import { useState } from 'react';
import { Building2, Wrench } from 'lucide-react';
import { ListingRequests } from '@/components/ListingRequests';

type LeadType = 'PARKING' | 'SERVICE';

const TABS: { value: LeadType; label: string; icon: typeof Building2 }[] = [
  { value: 'PARKING', label: 'Parking space', icon: Building2 },
  { value: 'SERVICE', label: 'Service Req', icon: Wrench },
];

/**
 * Partner requests from the customer site. Two kinds, switchable via the tabs:
 *  - Parking space → "List your space" submissions (convert into a vendor)
 *  - Service Req   → "Become a partner" submissions for upcoming auto services
 */
export default function RequestsPage() {
  const [tab, setTab] = useState<LeadType>('PARKING');

  return (
    <section className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold">Requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Partner requests from the customer website — parking-space listings and service partners.
        </p>
      </div>

      {/* Type filter tabs */}
      <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === value
                ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <ListingRequests leadType={tab} />
    </section>
  );
}
