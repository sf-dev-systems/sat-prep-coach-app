import React from 'react';
import { BookOpen, Award, Flame, Calendar, ArrowRight, TrendingUp, Settings } from 'lucide-react';

export default function StudentDashboard() {
  // Static placeholder data for Phase 1 scaffolding
  const predictedScore = 1420;
  const confidenceInterval = '1380 - 1460';
  const streakDays = 5;
  const minutesToday = 25;
  const questionsToday = 20;

  const readinessMetrics = [
    { name: 'Content Mastery', value: '72%', status: 'On Track', color: 'text-green-600 bg-green-50 border-green-200' },
    { name: 'Timing & Pace', value: '1.2m/q', status: 'Warning', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
    { name: 'Consistency', value: '5/4 days', status: 'Excellent', color: 'text-green-600 bg-green-50 border-green-200' },
    { name: 'Calibration', value: '88%', status: 'On Track', color: 'text-green-600 bg-green-50 border-green-200' },
  ];

  const focusSkills = [
    { section: 'Math', name: 'Systems of 2 Linear Equations', priority: 'High Point Leverage', color: 'border-red-100 bg-red-50/50 text-red-700' },
    { section: 'RW', name: 'Command of Evidence (Textual)', priority: 'High Weight', color: 'border-orange-100 bg-orange-50/50 text-orange-700' },
    { section: 'Math', name: 'Nonlinear Functions', priority: 'Review Due', color: 'border-yellow-100 bg-yellow-50/50 text-yellow-700' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Welcome Back, Sienna</h1>
          <p className="text-sm text-gray-500">Targeting 1500+ · Preparing for the Digital SAT</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full">
          <Settings className="w-3.5 h-3.5" />
          <span>Personal Edition v1 (Phase 1 Live)</span>
        </div>
      </div>

      {/* Main Score Prediction Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-6 md:p-8 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Current Predicted SAT Score</span>
            <div className="flex items-baseline gap-4">
              <span className="text-5xl md:text-6xl font-extrabold tracking-tight">{predictedScore}</span>
              <span className="text-sm text-indigo-200 bg-white/10 px-2.5 py-1 rounded-md font-semibold">
                Confidence Band: {confidenceInterval}
              </span>
            </div>
            <p className="text-sm text-indigo-100 max-w-md">
              Your prediction updates automatically after each session and recalibrates monthly against official practice tests.
            </p>
            <div className="pt-2">
              <a 
                href="/session"
                className="inline-flex items-center gap-2 bg-white text-indigo-900 font-bold px-5 py-2.5 rounded-xl shadow-sm hover:bg-indigo-50 transition-colors text-sm"
              >
                <span>Start Practice Session</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
          {/* Abstract Background Accent */}
          <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial-gradient opacity-10 pointer-events-none" />
        </div>

        {/* Streak & Daily Work */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Daily Goal Progress</h2>
              <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Questions Completed</span>
                <span className="font-semibold text-gray-800">{questionsToday} / 20</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Minutes Studied</span>
                <span className="font-semibold text-gray-800">{minutesToday} / 25 mins</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-sm text-gray-600">
            <span>Current Streak:</span>
            <span className="font-bold text-orange-600">{streakDays} Days</span>
          </div>
        </div>
      </div>

      {/* Readiness Panel */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">Readiness Dashboard</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {readinessMetrics.map((m, idx) => (
            <div key={idx} className="bg-white border border-gray-100 p-4 rounded-xl shadow-2xs space-y-2">
              <span className="text-xs font-semibold text-gray-400 block">{m.name}</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-gray-800">{m.value}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${m.color}`}>
                  {m.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Focus & Goals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Focus Skills */}
        <div className="md:col-span-2 space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">Top Focus Skills for Sienna</h2>
          <div className="space-y-2.5">
            {focusSkills.map((sk, idx) => (
              <div key={idx} className="bg-white border border-gray-100 hover:border-gray-200 transition-all p-4 rounded-xl shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{sk.section}</span>
                  <h3 className="font-semibold text-sm text-gray-900">{sk.name}</h3>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${sk.color}`}>
                  {sk.priority}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Report Highlights */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">Latest Weekly Report</h2>
          <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500">Report of July 12, 2026</span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed">
              Sienna showed exceptional focus this week, completing 120 questions over 2.5 hours of dedicated study. Accuracy remains high at 84% in Math. We recommend prioritizing <strong>Transitions</strong> in RW to further solidifying Standard Conventions.
            </p>
            <a href="/reports/latest" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              <span>Read Full Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
