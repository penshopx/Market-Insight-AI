CREATE TABLE IF NOT EXISTS "research_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"source" text NOT NULL,
	"source_url" text,
	"data_source_site" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"priority" text,
	"tags" text,
	"collected_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contractors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"sbu_level" text NOT NULL,
	"sbu_code" text,
	"sbu_expiry" text,
	"bidang_usaha" text,
	"sub_bidang" text,
	"klasifikasi" text,
	"npwp" text,
	"registration_number" text,
	"address" text,
	"province" text,
	"city" text,
	"postal_code" text,
	"phone" text,
	"email" text,
	"website" text,
	"data_source" text,
	"data_source_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skk_holders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"jenjang" text NOT NULL,
	"specialization" text NOT NULL,
	"jabatan_kerja" text,
	"skk_number" text,
	"skk_expiry" text,
	"certification_body" text,
	"education" text,
	"province" text,
	"city" text,
	"phone" text,
	"email" text,
	"current_employer" text,
	"available" boolean DEFAULT true NOT NULL,
	"data_source" text,
	"data_source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tender_opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"client" text NOT NULL,
	"province" text NOT NULL,
	"city" text,
	"estimated_value" real,
	"deadline" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"source" text,
	"source_url" text,
	"data_source_site" text,
	"requirements" text,
	"sbu_required" text,
	"lpse_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pain_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"problem_id" text,
	"domain" text,
	"subdomain" text,
	"pain_score" real,
	"affected_roles" text,
	"root_cause" text,
	"business_impact" text,
	"sdm_gap" text,
	"manual_solution" text,
	"digital_solution" text,
	"ai_solution" text,
	"linked_ai_agent" text,
	"service_opportunity" text,
	"cross_references" text,
	"segment" text DEFAULT 'KONTRAKTOR' NOT NULL,
	"description" text NOT NULL,
	"frequency" text DEFAULT 'SERING',
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"category" text,
	"product_idea" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"evidence_photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "output_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_segment" text DEFAULT 'SEMUA' NOT NULL,
	"linked_pain_point_ids" text,
	"key_messages" text,
	"format" text,
	"platform" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"published_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"linked_pain_point_id" integer,
	"ai_product_name" text NOT NULL,
	"description" text NOT NULL,
	"problem_solved" text NOT NULL,
	"target_users" text NOT NULL,
	"tech_stack" text,
	"feasibility" text DEFAULT 'MEDIUM' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"estimated_impact" text,
	"revenue_model" text,
	"status" text DEFAULT 'CONCEPT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"linked_product_id" integer,
	"linked_pain_point_id" integer,
	"strategy_title" text NOT NULL,
	"strategy_type" text NOT NULL,
	"target_audience" text NOT NULL,
	"channels" text NOT NULL,
	"key_messages" text,
	"call_to_action" text,
	"timeline" text,
	"budget" text,
	"kpi" text,
	"fast_moving_tactic" text,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduler_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"total_items_saved" text DEFAULT '0' NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notification_result" jsonb DEFAULT 'null'::jsonb,
	"notification_status" text,
	"notification_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workroom_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"service_ids" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "briefing_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_date" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"pdf_generated" boolean DEFAULT false NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefing_deliveries_delivery_date_unique" UNIQUE("delivery_date")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "research_items_dedup_idx" ON "research_items" USING btree ("data_source_site","title","collected_at");
