import React from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
export default function LandingDashboard() {
  const toast = useToast();
  return (
    <>

{/*  Page Header  */}
<div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
<div>
<h2 className="font-display text-display text-on-surface">Overview</h2>
<p className="font-body-md text-on-surface-variant">Real-time parking logistics for North Terminal Plaza.</p>
</div>
<div className="flex items-center gap-sm">
<button className="bg-surface-container border border-outline-variant text-on-surface font-label-md py-2 px-4 rounded-lg hover:bg-surface-variant transition-colors flex items-center gap-2 cursor-pointer" onClick={() => toast.success("Report generated successfully.")}>
<span className="material-symbols-outlined text-sm">download</span> Export Report
</button>
<Link to="/reservation-module" className="bg-primary text-on-primary font-label-md py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2 shadow-sm cursor-pointer">
<span className="material-symbols-outlined text-sm">add</span> New Reservation
</Link>
</div>
</div>
{/*  Summary Cards Bento Grid  */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
{/*  Available  */}
<div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-between">
<div>
<p className="font-label-md text-on-surface-variant mb-xs">Available Slots</p>
<h3 className="font-display text-display text-secondary">142</h3>
<p className="text-xs text-secondary font-medium mt-1 flex items-center gap-1">
<span className="material-symbols-outlined text-xs">trending_up</span> +12% from last hour
                        </p>
</div>
<div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
<span className="material-symbols-outlined text-3xl">check_circle</span>
</div>
</div>
{/*  Occupied  */}
<div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-between">
<div>
<p className="font-label-md text-on-surface-variant mb-xs">Occupied</p>
<h3 className="font-display text-display text-error">428</h3>
<p className="text-xs text-error font-medium mt-1 flex items-center gap-1">
<span className="material-symbols-outlined text-xs">trending_down</span> -3% from last hour
                        </p>
</div>
<div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center text-on-error-container">
<span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
</div>
</div>
{/*  Reserved  */}
<div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-between">
<div>
<p className="font-label-md text-on-surface-variant mb-xs">Reserved</p>
<h3 className="font-display text-display text-primary">30</h3>
<p className="text-xs text-on-surface-variant font-medium mt-1">Next: 14:00 PM</p>
</div>
<div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed">
<span className="material-symbols-outlined text-3xl">bookmark</span>
</div>
</div>
</div>
{/*  Central Data Section  */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
{/*  Heat Map / Utilization Chart  */}
<div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] overflow-hidden">
<div className="flex items-center justify-between mb-lg">
<h4 className="font-headline-md text-headline-md">Peak Utilization</h4>
<select className="bg-surface-container-low border-none text-xs rounded-lg py-1 px-3 focus:ring-1 focus:ring-primary">
<option>Last 24 Hours</option>
<option>Last 7 Days</option>
</select>
</div>
<div className="h-64 w-full relative flex items-end justify-between gap-2 px-2">
{/*  Simplified Visualization Bars  */}
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "40%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "35%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "30%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "55%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "80%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "95%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "85%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "60%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "45%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "35%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "50%" }}></div>
<div className="w-full bg-primary-fixed-dim rounded-t-lg transition-all hover:bg-primary" style={{ height: "40%" }}></div>
</div>
<div className="flex justify-between mt-md px-2 text-xs text-on-surface-variant font-medium">
<span>06:00</span>
<span>09:00</span>
<span>12:00</span>
<span>15:00</span>
<span>18:00</span>
<span>21:00</span>
</div>
</div>
{/*  Today's Activity Metrics  */}
<div className="lg:col-span-4 space-y-lg">
<div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] h-full">
<h4 className="font-headline-md text-headline-md mb-lg">Activity Metrics</h4>
<div className="space-y-md">
<div className="flex items-center justify-between">
<div className="flex items-center gap-sm">
<span className="material-symbols-outlined text-secondary">login</span>
<span className="font-body-md">Daily Entries</span>
</div>
<span className="font-bold text-on-surface">1,204</span>
</div>
<div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
<div className="bg-secondary h-full" style={{ width: "72%" }}></div>
</div>
<div className="flex items-center justify-between mt-lg">
<div className="flex items-center gap-sm">
<span className="material-symbols-outlined text-error">logout</span>
<span className="font-body-md">Daily Exits</span>
</div>
<span className="font-bold text-on-surface">1,098</span>
</div>
<div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
<div className="bg-error h-full" style={{ width: "65%" }}></div>
</div>
<div className="pt-lg border-t border-outline-variant mt-lg">
<p className="font-label-md text-on-surface-variant mb-xs">Avg. Stay Duration</p>
<div className="flex items-baseline gap-xs">
<span className="font-display text-2xl">4.2</span>
<span className="font-label-md text-on-surface-variant">hours</span>
</div>
</div>
</div>
</div>
</div>
</div>
{/*  Lower Section: Quick Actions & Recent Activity  */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-lg pb-xl">
{/*  Quick Actions  */}
<div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)]">
<h4 className="font-headline-md text-headline-md mb-lg">Quick Actions</h4>
<div className="space-y-sm">
<Link to="/reservation-module" className="w-full flex items-center justify-between p-md border border-outline-variant rounded-lg hover:border-primary hover:bg-primary-fixed-dim transition-all group">
<div className="flex items-center gap-md">
<span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">add_circle</span>
<span className="font-body-md font-semibold text-on-surface">Book a Slot</span>
</div>
<span className="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
</Link>
<Link to="/visitor-management" className="w-full flex items-center justify-between p-md border border-outline-variant rounded-lg hover:border-primary hover:bg-primary-fixed-dim transition-all group">
<div className="flex items-center gap-md">
<span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">person_add</span>
<span className="font-body-md font-semibold text-on-surface">Add Visitor</span>
</div>
<span className="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
</Link>
<Link to="/vehicle-management" className="w-full flex items-center justify-between p-md border border-outline-variant rounded-lg hover:border-primary hover:bg-primary-fixed-dim transition-all group">
<div className="flex items-center gap-md">
<span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">app_registration</span>
<span className="font-body-md font-semibold text-on-surface">Register Vehicle</span>
</div>
<span className="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
</Link>
</div>
</div>
{/*  Recent Activity Feed  */}
<div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)]">
<div className="flex items-center justify-between mb-lg">
<h4 className="font-headline-md text-headline-md">Recent Activity</h4>
<Link className="text-primary font-label-md hover:underline" to="/vehicle-management">View All</Link>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="border-b border-outline-variant">
<th className="py-3 px-4 font-label-md text-on-surface-variant">Vehicle ID</th>
<th className="py-3 px-4 font-label-md text-on-surface-variant">Slot</th>
<th className="py-3 px-4 font-label-md text-on-surface-variant">Status</th>
<th className="py-3 px-4 font-label-md text-on-surface-variant text-right">Timestamp</th>
</tr>
</thead>
<tbody>
<tr className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
<td className="py-4 px-4 font-body-md font-bold text-on-surface">ABC-1234</td>
<td className="py-4 px-4 font-body-md text-on-surface-variant">P1-A42</td>
<td className="py-4 px-4">
<span className="px-3 py-1 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-fixed-variant">ENTRY</span>
</td>
<td className="py-4 px-4 text-body-md text-on-surface-variant text-right">02:14 PM</td>
</tr>
<tr className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
<td className="py-4 px-4 font-body-md font-bold text-on-surface">XYZ-8890</td>
<td className="py-4 px-4 font-body-md text-on-surface-variant">P2-B09</td>
<td className="py-4 px-4">
<span className="px-3 py-1 rounded-full text-xs font-bold bg-error-container text-on-error-container">EXIT</span>
</td>
<td className="py-4 px-4 text-body-md text-on-surface-variant text-right">02:08 PM</td>
</tr>
<tr className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
<td className="py-4 px-4 font-body-md font-bold text-on-surface">GTR-4451</td>
<td className="py-4 px-4 font-body-md text-on-surface-variant">P1-C12</td>
<td className="py-4 px-4">
<span className="px-3 py-1 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-fixed-variant">ENTRY</span>
</td>
<td className="py-4 px-4 text-body-md text-on-surface-variant text-right">01:55 PM</td>
</tr>
<tr className="hover:bg-surface-container-low transition-colors">
<td className="py-4 px-4 font-body-md font-bold text-on-surface">TES-9000</td>
<td className="py-4 px-4 font-body-md text-on-surface-variant">P3-F01</td>
<td className="py-4 px-4">
<span className="px-3 py-1 rounded-full text-xs font-bold bg-surface-container text-primary font-bold">RESERVED</span>
</td>
<td className="py-4 px-4 text-body-md text-on-surface-variant text-right">01:42 PM</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>

    </>
  );
}

