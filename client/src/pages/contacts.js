import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, Dialog, Input, Textarea, Typography } from "@material-tailwind/react";
import axios from "axios";
import cookie from "cookie";
import apiBase from "../helpers/apiBase";

const CONTACT_TYPES = ["customer", "personal", "company", "employee"];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  type: "personal",
  customer_name: "",
  company_name: "",
  position: "",
  notes: "",
};

export default function ContactsPage() {
  const token = cookie.parse(document.cookie).token;
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [items, setItems] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadContacts = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("limit", "0");
    if (typeFilter) params.set("type", typeFilter);
    if (search.trim()) params.set("search", search.trim());
    const res = await axios.get(`${apiBase}/contacts?${params.toString()}`, { headers });
    setItems(Array.isArray(res.data?.items) ? res.data.items : []);
  }, [headers, search, typeFilter]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name || "",
      email: item.email || "",
      phone: item.phone || "",
      type: item.type || "personal",
      customer_name: item.customer_name || "",
      company_name: item.company_name || "",
      position: item.position || "",
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (editingId) {
      await axios.put(`${apiBase}/contacts/${editingId}`, form, { headers });
    } else {
      await axios.post(`${apiBase}/contacts`, form, { headers });
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    await loadContacts();
  };

  const handleDelete = async (id) => {
    await axios.delete(`${apiBase}/contacts/${id}`, { headers });
    await loadContacts();
  };

  return (
    <div className="mt-20 min-h-screen px-4 pb-10 sm:px-6 lg:px-8">
      <Card className="overview-shell">
        <CardHeader floated={false} shadow={false} className="overview-header rounded-none">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] lg:items-end">
            <div>
              <Typography variant="small" className="tracking-[0.2em] uppercase text-slate-500">
                CRM notebook
              </Typography>
              <Typography variant="h3" className="sketch-heading mt-2">
                Contacts
              </Typography>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(160px,220px)]">
              <Input placeholder="Search contacts" className="sketch-input w-full" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select className="sketch-select-plain w-full" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">All types</option>
                {CONTACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <Button variant="text" className="ui-button ui-button--amber px-5 py-2 text-slate-800 shadow-none sm:col-span-2 sm:justify-self-start" onClick={openCreate}>
                Add contact
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-3 p-4 sm:p-6">
          {items.length === 0 ? (
            <div className="overview-section p-8 text-center text-slate-600">No contacts found for current filter.</div>
          ) : (
            items.map((item) => (
              <div key={item._id} className="overview-section p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0 grid gap-2">
                    <Typography variant="h6" className="text-slate-800 break-words">
                      {item.name}
                    </Typography>
                    <div className="flex flex-wrap gap-2">
                      <span className="ui-badge ui-badge--progress">{item.type}</span>
                      {item.customer_name && <span className="ui-table-chip">Customer: {item.customer_name}</span>}
                      {item.company_name && <span className="ui-table-chip">Company: {item.company_name}</span>}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Typography className="text-sm text-slate-600 break-all">{item.email || "No email"}</Typography>
                      <Typography className="text-sm text-slate-600">{item.phone || "No phone"}</Typography>
                    </div>
                    {item.position && <Typography className="text-sm text-slate-600">Position: {item.position}</Typography>}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button variant="text" className="ui-button ui-button--blue px-4 py-2 text-slate-800 shadow-none" onClick={() => openEdit(item)}>
                      Edit
                    </Button>
                    <Button variant="text" className="ui-button ui-button--rose px-4 py-2 text-slate-800 shadow-none" onClick={() => handleDelete(item._id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Dialog open={dialogOpen} handler={() => setDialogOpen(false)} size="md" className="ui-modal ui-modal--no-overlay bg-transparent shadow-none">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center p-3 sm:p-5">
          <div className="ui-modal__card max-w-[48rem]">
            <div className="ui-modal__header bg-[linear-gradient(135deg,#dbeafe_0%,#f8fbff_100%)]">
              <Typography variant="h5" className="text-slate-800">
                {editingId ? "Update contact" : "Create contact"}
              </Typography>
            </div>
            <div className="ui-modal__body">
              <form className="ui-modal__stack" onSubmit={handleSubmit}>
                <div className="ui-modal__grid">
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Name</span>
                    <Input placeholder="Contact name" className="sketch-input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
                  </label>
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Type</span>
                    <select className="sketch-select-plain" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
                      {CONTACT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="ui-modal__grid">
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Email</span>
                    <Input placeholder="Email" className="sketch-input" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                  </label>
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Phone</span>
                    <Input placeholder="Phone" className="sketch-input" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                  </label>
                </div>
                <div className="ui-modal__grid">
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Customer</span>
                    <Input placeholder="Customer name" className="sketch-input" value={form.customer_name} onChange={(event) => setForm((prev) => ({ ...prev, customer_name: event.target.value }))} />
                  </label>
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Company</span>
                    <Input placeholder="Company name" className="sketch-input" value={form.company_name} onChange={(event) => setForm((prev) => ({ ...prev, company_name: event.target.value }))} />
                  </label>
                </div>
                <div className="ui-modal__grid">
                  <label className="ui-modal__field">
                    <span className="text-sm font-semibold text-slate-700">Position</span>
                    <Input placeholder="Position" className="sketch-input" value={form.position} onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))} />
                  </label>
                  <span />
                </div>
                <label className="ui-modal__field">
                  <span className="text-sm font-semibold text-slate-700">Notes</span>
                  <Textarea placeholder="Notes" className="sketch-input min-h-[120px]" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </label>
                <div className="ui-modal__actions">
                  <Button type="button" variant="text" className="ui-button ui-button--ghost px-4 py-2 text-slate-800 shadow-none" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="text" className="ui-button ui-button--green px-4 py-2 text-slate-800 shadow-none">
                    {editingId ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
