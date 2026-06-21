export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 font-sans text-center">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-10">
        <p className="text-6xl font-black text-slate-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Page does not exist</h1>
        <p className="text-sm text-slate-500">
          The page you are looking for could not be found.
        </p>
      </div>
    </div>
  );
}
