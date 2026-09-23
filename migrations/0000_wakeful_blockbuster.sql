CREATE TABLE "accounts_due" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"accounts_due" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_checks_due" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"health_checks_due" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_checks_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"actual_completed" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_checks_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"target_completed" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mbs_dext_precision" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"clients_above_85_percent" integer NOT NULL,
	"clients_below_85_percent" integer NOT NULL,
	"lowest_score_client_details" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mbs_dext_precision_team_id_week_ending_unique" UNIQUE("team_id","week_ending")
);
--> statement-breakpoint
CREATE TABLE "mbs_oldest_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"oldest_item_days" integer NOT NULL,
	"target" integer DEFAULT 10 NOT NULL,
	"worst_performing_clients" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mbs_oldest_items_team_id_week_ending_unique" UNIQUE("team_id","week_ending")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "vat_due" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"quarter_ending" date NOT NULL,
	"vat_due" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vat_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"actual_completed" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vat_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"rolling_four_week_target" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vat_turnover_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"percentage_complete" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vat_turnover_checks_team_id_week_ending_unique" UNIQUE("team_id","week_ending")
);
--> statement-breakpoint
CREATE TABLE "weekly_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"actual_completed" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"rolling_four_week_target" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts_due" ADD CONSTRAINT "accounts_due_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_checks_due" ADD CONSTRAINT "health_checks_due_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_checks_results" ADD CONSTRAINT "health_checks_results_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_checks_targets" ADD CONSTRAINT "health_checks_targets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mbs_dext_precision" ADD CONSTRAINT "mbs_dext_precision_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mbs_oldest_items" ADD CONSTRAINT "mbs_oldest_items_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_due" ADD CONSTRAINT "vat_due_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_results" ADD CONSTRAINT "vat_results_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_targets" ADD CONSTRAINT "vat_targets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_turnover_checks" ADD CONSTRAINT "vat_turnover_checks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_results" ADD CONSTRAINT "weekly_results_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_targets" ADD CONSTRAINT "weekly_targets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;