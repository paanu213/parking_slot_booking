import { ListingRequests } from '@/components/ListingRequests';

/**
 * "List your space" submissions from the customer site. Admins review each
 * request and either convert it into a vendor (pre-fills the register form) or
 * reject it.
 */
export default function RequestsPage() {
  return (
    <section className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold">Requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          "List your space" submissions from the customer website. Convert a request into a vendor, or reject it.
        </p>
      </div>
      <ListingRequests />
    </section>
  );
}
