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
import { Plus, Search, Mail, Phone, Building2, Trash2, ChevronRight, Users } from "lucide-react"
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
    <div className="min-h-screen">
      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/[0.05] bg-[#0a0e1a]/80 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
              Customers
            </h1>
            <p className="text-sm text-[rgba(240,244,255,0.4)] mt-0.5">{customers.length} total</p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      <div className="px-8 pt-6 pb-8 animate-fade-up">
        {/* Search */}
        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgba(240,244,255,0.3)]" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 max-w-md"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 stagger-children">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass text-center py-24 rounded-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(0,212,255,0.08)] mx-auto mb-5">
              <Users className="h-8 w-8 text-[rgba(0,212,255,0.4)]" />
            </div>
            <h3
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No customers found
            </h3>
            <p className="text-sm text-[rgba(240,244,255,0.4)] mb-6">
              {search ? "Try adjusting your search terms" : "Add your first customer to get started"}
            </p>
            {!search && (
              <Button onClick={() => setIsAddOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                Add Customer
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 stagger-children">
            {filtered.map((customer) => (
              <Card key={customer.id} className="glass glass-hover transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[rgba(0,212,255,0.2)] to-[rgba(59,130,246,0.2)] text-[#00d4ff] font-bold text-sm flex-shrink-0"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
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
                          className="font-semibold text-white hover:text-[#00d4ff] transition-colors flex items-center gap-2"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {`${customer.first_name} ${customer.last_name}`}
                          <ChevronRight className="h-4 w-4 text-[rgba(240,244,255,0.3)]" />
                        </Link>
                        <div className="flex items-center gap-4 mt-1">
                          {customer.email && (
                            <span className="flex items-center gap-1 text-xs text-[rgba(240,244,255,0.4)]">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          )}
                          {customer.phone && (
                            <span className="flex items-center gap-1 text-xs text-[rgba(240,244,255,0.4)]">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.address_line1 && (
                            <span className="flex items-center gap-1 text-xs text-[rgba(240,244,255,0.4)]">
                              <Building2 className="h-3 w-3" />
                              {customer.address_line1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[rgba(240,244,255,0.3)]">{formatDate(customer.created_at)}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(customer.id)}
                        className="text-[rgba(240,244,255,0.3)] hover:text-red-400 btn-ghost"
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
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="glass border border-white/[0.09]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Add Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="input"
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
                className="input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company / Address</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="input"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)} className="btn-secondary">
                Cancel
              </Button>
              <Button type="submit" disabled={createCustomer.isPending} className="btn-primary">
                {createCustomer.isPending ? "Creating..." : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
