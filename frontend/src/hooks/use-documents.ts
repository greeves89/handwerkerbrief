import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Document } from "@/lib/types";

export function useDocuments(type?: "offer" | "invoice") {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const params = type ? { type } : {};
      const res = await api.get("/documents", { params });
      setDocuments(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Laden");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [type]);

  const createDocument = async (data: any) => {
    const res = await api.post("/documents", data);
    setDocuments((prev) => [res.data, ...prev]);
    return res.data;
  };

  const updateDocument = async (id: number, data: any) => {
    const res = await api.put(`/documents/${id}`, data);
    setDocuments((prev) => prev.map((d) => (d.id === id ? res.data : d)));
    return res.data;
  };

  const deleteDocument = async (id: number) => {
    await api.delete(`/documents/${id}`);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const generatePdf = async (id: number) => {
    const res = await api.post(`/documents/${id}/generate-pdf`);
    return res.data;
  };

  const downloadPdf = async (id: number, documentNumber: string) => {
    const res = await api.get(`/documents/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${documentNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const convertToInvoice = async (offerId: number) => {
    const res = await api.post(`/documents/${offerId}/convert-to-invoice`);
    return res.data;
  };

  return {
    documents,
    isLoading,
    error,
    fetchDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    generatePdf,
    downloadPdf,
    convertToInvoice,
  };
}
