CREATE TABLE "client_dext_precision" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"clients_above_85_percent" integer NOT NULL,
	"clients_below_85_percent" integer NOT NULL,
	"lowest_score_client_details" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_dext_precision_team_id_week_ending_unique" UNIQUE("team_id","week_ending")
);
--> statement-breakpoint
CREATE TABLE "client_oldest_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week_ending" date NOT NULL,
	"oldest_item_days" integer NOT NULL,
	"target" integer DEFAULT 10 NOT NULL,
	"worst_performing_clients" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_oldest_items_team_id_week_ending_unique" UNIQUE("team_id","week_ending")
);
--> statement-breakpoint
ALTER TABLE "client_dext_precision" ADD CONSTRAINT "client_dext_precision_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_oldest_items" ADD CONSTRAINT "client_oldest_items_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;