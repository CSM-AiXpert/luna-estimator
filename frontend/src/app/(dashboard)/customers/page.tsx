"use client"

import { useState } from "react"
import Link from "next/link"
import { useCustomers, useCreateCustomer, useDeleteCustomer } from "@/lib/api/hooks/use-customers"
import { useOrganization } from "@/components/providers"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Search, Mail, Phone, Building2, Trash2, ChevronRight } from "lucide-react"
import { formatDate } from "@/lib/utils"

const ORG_ID = "demo-org"

export default function CustomersPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
  })

  const { data: customers = [], isLoading } = useCustomers(ORG_ID)
  const createCustomer = useCreateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const filtered = customers.filter(
    (c) =>
      search === "" ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createCustomer.mutateAsync({
        organization_id: ORG_ID,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        company_name: form.company || null,
      })
      toast({ title: "Customer created" })
      setIsAddOpen(false)
      setForm({ first_name: "", last_name: "", email: "", phone: "", company: "" })
    } catch {
      toast({ title: "Failed to create customer", variant: "error" })
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCustomer.mutateAsync(id)
      toast({ title: "Customer deleted" })
    } catch {
      toast({ title: "Failed to delete customer", variant: "error" })
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-white/50 text-sm mt-1">{customers.length} total</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <p>No customers found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((customer) => (
            <Card key={customer.id} className="hover:bg-white/[0.05] transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#00d4ff]/20 to-[#3b82f6]/20 text-[#00d4ff] font-bold text-sm flex-shrink-0">
                      {`${customer.first_name} ${customer.last_name}`
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium text-white hover:text-[#00d4ff] transition-colors flex items-center gap-2"
                      >
                        {`${customer.first_name} ${customer.last_name}`}
                        <ChevronRight className="h-4 w-4 text-white/30" />
                      </Link>
                      <div className="flex items-center gap-4 mt-1">
                        {customer.email && (
                          <span className="flex items-center gap-1 text-xs text-white/40">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </span>
                        )}
                        {customer.phone && (
                          <span className="flex items-center gap-1 text-xs text-white/40">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.address_line1 && (
                          <span className="flex items-center gap-1 text-xs text-white/40">
                            <Building2 className="h-3 w-3" />
                            {customer.address_line1}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/30">{formatDate(customer.created_at)}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(customer.id)}
                      className="text-white/30 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company / Address</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? "Creating..." : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
