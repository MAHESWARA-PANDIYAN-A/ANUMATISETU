import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 mx-auto flex items-center justify-center">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-600 px-2.5 py-1 rounded bg-slate-100 border border-slate-200">
            HTTP 404
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Page Not Found</h2>
          <p className="text-sm text-slate-500">
            The requested industrial clearance route or resource could not be found.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Single-Window Home</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
