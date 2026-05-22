import Link from "next/link";

export default function DoctorHome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-2xl mx-auto">GF</div>
        <div>
          <h1 className="text-3xl font-bold text-white">GuestFlow Doctor CRM</h1>
          <p className="text-gray-400 mt-2">Physician clinical review and order approval</p>
        </div>
        <Link
          href="/crm"
          className="inline-block px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          Open Command Center
        </Link>
      </div>
    </div>
  );
}
