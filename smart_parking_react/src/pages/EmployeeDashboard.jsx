import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth, authFetch } from '../context/AuthContext';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const userName = user?.name?.split(' ')[0] || 'Employee';
  return (
    <>

{/*  Welcome Section  */}
<section className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md">
<div>
<p className="text-on-surface-variant font-label-md text-label-md uppercase tracking-wider mb-xs">Overview</p>
<h2 className="font-display text-display text-on-background">Welcome back, {userName}.</h2>
</div>
<Link to="/reservation-module" className="flex items-center justify-center gap-sm bg-primary text-on-primary px-xl py-md rounded-xl font-body-lg text-body-lg shadow-sm hover:bg-on-primary-fixed-variant transition-colors group cursor-pointer">
<span className="material-symbols-outlined">add_circle</span>
Book Slot
</Link>
</section>
{/*  Bento Grid Layout  */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
{/*  Active Reservation (Priority Card)  */}
<div className="lg:col-span-8 glass-card rounded-xl p-lg shadow-sm relative overflow-hidden group">
<div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
<div className="flex flex-col md:flex-row gap-lg justify-between items-start md:items-center">
<div className="space-y-4">
<div className="flex items-center gap-md">
<span className="bg-secondary-container text-on-secondary-container px-sm py-xs rounded-lg font-label-md text-label-md">Active Now</span>
<span className="text-on-surface-variant font-label-md text-label-md">Booking ID: #PK-2941</span>
</div>
<div>
<h3 className="font-headline-lg text-headline-lg text-on-background mb-xs">A-42 — Tower East</h3>
<p className="font-body-lg text-body-lg text-on-surface-variant">Floor 04 • Premium Parking Zone</p>
</div>
<div className="flex items-center gap-xl mt-md">
<div className="flex flex-col">
<span className="font-label-md text-label-md text-on-surface-variant mb-1">Time Remaining</span>
<span className="font-display text-display text-primary" id="countdown">04:12:45</span>
</div>
</div>
</div>
<div className="bg-surface p-md rounded-xl border border-outline-variant shadow-sm flex flex-col items-center gap-sm">
<div className="w-32 h-32 bg-surface-container flex items-center justify-center rounded-lg">
{/*  Placeholder for QR  */}
<span className="material-symbols-outlined text-[64px] text-on-surface-variant opacity-20">qr_code_2</span>
</div>
<p className="font-label-md text-label-md text-on-surface-variant">Scan at entrance</p>
</div>
</div>
</div>
{/*  Vehicle Details  */}
<div className="lg:col-span-4 glass-card rounded-xl p-lg shadow-sm flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-lg">
<h3 className="font-headline-md text-headline-md text-on-background">Default Vehicle</h3>
<span className="material-symbols-outlined text-primary cursor-pointer hover:bg-surface-container rounded-full p-1">edit</span>
</div>
<div className="flex items-center gap-md mb-xl">
<div className="w-14 h-14 bg-primary-fixed rounded-xl flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[32px]">directions_car</span>
</div>
<div>
<p className="font-headline-lg text-headline-lg text-on-background font-bold">ABC-1234</p>
<p className="font-body-md text-body-md text-on-surface-variant">Tesla Model 3 • Midnight Blue</p>
</div>
</div>
</div>
<div className="p-md bg-surface-container-low rounded-lg border border-outline-variant/30">
<div className="flex items-center gap-sm text-secondary">
<span className="material-symbols-outlined text-[20px]">verified_user</span>
<span className="font-label-md text-label-md">Verified for Level A Clearance</span>
</div>
</div>
</div>
{/*  Parking History  */}
<div className="lg:col-span-12 glass-card rounded-xl p-lg shadow-sm">
<div className="flex items-center justify-between p-lg border-b border-outline-variant bg-surface-container-lowest">
<h3 className="font-headline-md text-headline-md font-bold">Your Parking History</h3>
<Link className="text-primary font-label-md text-label-md hover:underline" to="/vehicle-management">View All Sessions</Link>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="border-b border-outline-variant">
<th className="py-md px-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Date</th>
<th className="py-md px-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Slot</th>
<th className="py-md px-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Duration</th>
<th className="py-md px-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Location</th>
<th className="py-md px-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-right">Status</th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant/30">
<tr className="hover:bg-surface-container-lowest transition-colors">
<td className="py-md px-md font-body-md text-body-md">Oct 24, 2023</td>
<td className="py-md px-md font-body-md text-body-md font-semibold">B-12</td>
<td className="py-md px-md font-body-md text-body-md">08h 12m</td>
<td className="py-md px-md font-body-md text-body-md text-on-surface-variant">North Plaza • L3</td>
<td className="py-md px-md text-right">
<span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">Completed</span>
</td>
</tr>
<tr className="hover:bg-surface-container-lowest transition-colors">
<td className="py-md px-md font-body-md text-body-md">Oct 22, 2023</td>
<td className="py-md px-md font-body-md text-body-md font-semibold">C-08</td>
<td className="py-md px-md font-body-md text-body-md">04h 45m</td>
<td className="py-md px-md font-body-md text-body-md text-on-surface-variant">Annex Wing • L1</td>
<td className="py-md px-md text-right">
<span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">Completed</span>
</td>
</tr>
<tr className="hover:bg-surface-container-lowest transition-colors">
<td className="py-md px-md font-body-md text-body-md">Oct 20, 2023</td>
<td className="py-md px-md font-body-md text-body-md font-semibold">A-21</td>
<td className="py-md px-md font-body-md text-body-md">09h 00m</td>
<td className="py-md px-md font-body-md text-body-md text-on-surface-variant">Tower East • L2</td>
<td className="py-md px-md text-right">
<span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">Completed</span>
</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>

    </>
  );
}

