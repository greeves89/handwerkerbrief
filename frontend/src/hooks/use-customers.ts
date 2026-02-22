import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Customer } from "@/lib/types";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async (search?: string) => {
    setIsLoading(true);
    try {
      const params = search ? { search } : {};
      const res = await api.get("/customers", { params });
      setCustomers(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Laden der Kunden");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const createCustomer = async (data: Partial<Customer>) => {
    const res = await api.post("/customers", data);
    setCustomers((prev) => [res.data, ...prev]);
    return res.data;
  };

  const updateCustomer = async (id: number, data: Partial<Customer>) => {
    const res = await api.put(`/customers/${id}`, data);
    setCustomers((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    return res.data;
  };

  const deleteCustomer = async (id: number) => {
    await api.delete(`/customers/${id}`);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  const importCustomersCsv = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post("/customers/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await fetchCustomers();
    return res.data;
  };

  const downloadCustomerTemplate = async () => {
    const res = await api.get("/customers/template/csv", { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kunden_vorlage.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    customers,
    isLoading,
    error,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    importCustomersCsv,
    downloadCustomerTemplate,
  };
}
