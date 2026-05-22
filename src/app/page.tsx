import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Nav */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg">
              HF
            </div>
            <span className="text-white font-bold text-xl">HealthFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/paramedic"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Paramedic
            </Link>
            <Link
              href="/crm"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              CRM
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6">
        <div className="py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <span className="text-blue-300 text-sm font-medium">Multi-Agent Healthcare AI</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Field to EHR in
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              60 Seconds
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
            9-agent pipeline that captures paramedic voice data, runs AI diagnostics, checks drug
            interactions via Apify, and commits physician-approved orders to the EHR — with immutable
            audit at every step.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/paramedic"
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors"
            >
              Open Paramedic UI
            </Link>
            <Link
              href="/crm"
              className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
            >
              Open CRM Dashboard
            </Link>
          </div>
        </div>

        {/* Agent Pipeline Visualization */}
        <div className="pb-24">
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            The 9-Agent Pipeline
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                phase: "Field Capture",
                color: "from-blue-500/20 to-blue-600/20",
                border: "border-blue-500/30",
                agents: [
                  { num: "1", name: "Voice Capture", desc: "Web Speech API transcription with Scalekit paramedic auth" },
                  { num: "2", name: "Structuring", desc: "NLP extraction of vitals, conditions, and FHIR observations" },
                  { num: "2.5", name: "Context Pull", desc: "EHR lookup for patient history, medications, allergies" },
                ],
              },
              {
                phase: "AI Processing",
                color: "from-purple-500/20 to-purple-600/20",
                border: "border-purple-500/30",
                agents: [
                  { num: "7a", name: "Diagnosis", desc: "Differential diagnosis with confidence scoring" },
                  { num: "7c", name: "Action Planner", desc: "Draft medication, imaging, and procedure orders" },
                  { num: "3", name: "Drug/Allergy Check", desc: "Apify-powered contraindication screening" },
                ],
              },
              {
                phase: "Safety & Commit",
                color: "from-emerald-500/20 to-emerald-600/20",
                border: "border-emerald-500/30",
                agents: [
                  { num: "8", name: "Safety Controller", desc: "Block dangerous orders, suggest alternatives" },
                  { num: "9", name: "Case Supervisor", desc: "Acuity routing to CRM for physician review" },
                  { num: "4-6", name: "Auth/Write/Audit", desc: "Scalekit physician verify, EHR commit, Entire.io audit" },
                ],
              },
            ].map((phase) => (
              <div key={phase.phase} className={`bg-gradient-to-b ${phase.color} border ${phase.border} rounded-2xl p-6`}>
                <h3 className="text-white font-bold text-lg mb-4">{phase.phase}</h3>
                <div className="space-y-4">
                  {phase.agents.map((agent) => (
                    <div key={agent.num} className="bg-black/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                          #{agent.num}
                        </span>
                        <span className="text-white font-semibold text-sm">{agent.name}</span>
                      </div>
                      <p className="text-gray-400 text-xs">{agent.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="pb-24 text-center">
          <h2 className="text-2xl font-bold text-white mb-8">Built With</h2>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {["Next.js 15", "TypeScript", "Tailwind CSS", "Supabase", "Scalekit Auth", "Apify", "Entire.io", "FHIR R4", "Web Speech API", "Vercel"].map((tech) => (
              <span key={tech} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-300 text-sm">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-500 text-sm">
            HealthFlow — Multi-Agent Healthcare AI Pipeline
          </p>
        </div>
      </footer>
    </div>
  );
}
