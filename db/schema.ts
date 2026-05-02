import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  json,
  decimal,
  int,
} from "drizzle-orm/mysql-core";

// ── Users (managed by Kimi OAuth) ──
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin", "estimator"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Projects / Estimates ──
export const projects = mysqlTable("projects", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  estimateNumber: varchar("estimateNumber", { length: 50 }).notNull(),
  status: mysqlEnum("status", [
    "draft",
    "ready_for_review",
    "sent",
    "signed",
    "deposit_requested",
    "in_pipeline",
    "completed",
    "archived",
  ]).default("draft").notNull(),

  // Customer info
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 50 }),
  customerEmail: varchar("customerEmail", { length: 320 }),

  // Property
  propertyAddress: text("propertyAddress").notNull(),
  propertyType: varchar("propertyType", { length: 50 }),
  projectType: varchar("projectType", { length: 50 }),

  // Metadata
  notes: text("notes"),
  internalNotes: text("internalNotes"),
  leadSource: varchar("leadSource", { length: 100 }),
  tags: json("tags").$type<string[]>(),

  // CRM sync
  crmContactId: varchar("crmContactId", { length: 255 }),
  crmOpportunityId: varchar("crmOpportunityId", { length: 255 }),
  crmEstimateId: varchar("crmEstimateId", { length: 255 }),
  crmSyncStatus: mysqlEnum("crmSyncStatus", ["pending", "synced", "failed", "not_needed"]).default("not_needed"),

  // Pricing
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("taxAmount", { precision: 10, scale: 2 }).default("0"),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0"),
  depositPercent: int("depositPercent").default(50),
  depositAmount: decimal("depositAmount", { precision: 10, scale: 2 }).default("0"),

  // Signatures
  customerSignedAt: timestamp("customerSignedAt"),
  customerSignatureName: varchar("customerSignatureName", { length: 255 }),
  estimatorSignedAt: timestamp("estimatorSignedAt"),
  estimatorSignatureName: varchar("estimatorSignatureName", { length: 255 }),

  // PDF
  unsignedPdfUrl: text("unsignedPdfUrl"),
  signedPdfUrl: text("signedPdfUrl"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ── Rooms ──
export const rooms = mysqlTable("rooms", {
  id: serial("id").primaryKey(),
  projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0),

  // Dimensions
  length: decimal("length", { precision: 8, scale: 2 }),
  width: decimal("width", { precision: 8, scale: 2 }),
  height: decimal("height", { precision: 8, scale: 2 }),
  wallSqFt: decimal("wallSqFt", { precision: 10, scale: 2 }),
  ceilingSqFt: decimal("ceilingSqFt", { precision: 10, scale: 2 }),
  totalSqFt: decimal("totalSqFt", { precision: 10, scale: 2 }),

  // Counts
  doorCount: int("doorCount").default(0),
  windowCount: int("windowCount").default(0),
  trimLinearFt: decimal("trimLinearFt", { precision: 10, scale: 2 }),
  baseboardLinearFt: decimal("baseboardLinearFt", { precision: 10, scale: 2 }),

  // Scope flags
  hasDrywallRepair: json("hasDrywallRepair").$type<string[]>(),
  paintScope: json("paintScope").$type<string[]>(), // walls, ceiling, trim, doors
  textureScope: json("textureScope").$type<string[]>(),
  prepComplexity: varchar("prepComplexity", { length: 20 }).default("standard"),
  repairComplexity: varchar("repairComplexity", { length: 20 }).default("none"),

  // Paint selections
  paintBrand: varchar("paintBrand", { length: 100 }),
  paintColor: varchar("paintColor", { length: 100 }),
  paintColorCode: varchar("paintColorCode", { length: 50 }),
  finishType: varchar("finishType", { length: 50 }),
  productLine: varchar("productLine", { length: 100 }),
  coats: int("coats").default(2),

  // AI / Photos
  photos: json("photos").$type<string[]>(),
  aiVisualizationUrl: text("aiVisualizationUrl"),

  // Notes
  notes: text("notes"),
  internalNotes: text("internalNotes"),

  // Room subtotal from line items
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

// ── Line Items ──
export const lineItems = mysqlTable("lineItems", {
  id: serial("id").primaryKey(),
  projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
  roomId: bigint("roomId", { mode: "number", unsigned: true }),

  description: varchar("description", { length: 500 }).notNull(),
  category: varchar("category", { length: 100 }),
  scope: varchar("scope", { length: 100 }), // paint, drywall, texture, trim, repair, etc.

  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unit: varchar("unit", { length: 50 }).default("ea"),
  rate: decimal("rate", { precision: 10, scale: 2 }).default("0"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),

  sortOrder: int("sortOrder").default(0),
  isInternal: int("isInternal").default(0), // 1 = internal only (materials)

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type LineItem = typeof lineItems.$inferSelect;
export type InsertLineItem = typeof lineItems.$inferInsert;

// ── Media / Photos ──
export const media = mysqlTable("media", {
  id: serial("id").primaryKey(),
  projectId: bigint("projectId", { mode: "number", unsigned: true }).notNull(),
  roomId: bigint("roomId", { mode: "number", unsigned: true }),

  url: text("url").notNull(),
  caption: varchar("caption", { length: 500 }),
  category: varchar("category", { length: 50 }).default("general"), // exterior, damage, reference, ai-generated, etc.
  includeOnPdf: int("includeOnPdf").default(1),
  isInternal: int("isInternal").default(0),
  sortOrder: int("sortOrder").default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Media = typeof media.$inferSelect;
export type InsertMedia = typeof media.$inferInsert;

export const notes = mysqlTable("notes", {
  id: serial("id").primaryKey(),
  userId: varchar("userId", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  tags: json("tags").$type<string[]>(),
  source: text("source"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;
