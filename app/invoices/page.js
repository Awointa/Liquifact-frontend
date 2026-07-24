"use client";

import { copy } from "../copy/en";
import NavMenu from "../../components/NavMenu";
import UploadView from "../../components/UploadView";
import { loadMockInvoices } from "../invest/lib";

export default function InvoicesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <NavMenu />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-2 mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
            {copy.invoices.title || "Invoices"}
          </h1>
          <p className="text-lg text-slate-400">
            {copy.invoices.description || "Upload and tokenize your commercial invoices."}
          </p>
        </div>

        <UploadView loadInvoices={loadMockInvoices} />
      </main>
    </div>
  );
}
