CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_event_id" integer,
	"event_name" varchar NOT NULL,
	"age_group" varchar,
	"distance_style" varchar,
	"gender" varchar,
	CONSTRAINT "events_server_event_id_unique" UNIQUE("server_event_id")
);
--> statement-breakpoint
CREATE TABLE "heats" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"server_heat_id" integer,
	"label" integer NOT NULL,
	"status" varchar DEFAULT 'PENDING',
	"is_current" boolean DEFAULT false NOT NULL,
	"is_synced" boolean DEFAULT false,
	"max_laps" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp,
	"hardware_start_millis" bigint,
	CONSTRAINT "heats_server_heat_id_unique" UNIQUE("server_heat_id")
);
--> statement-breakpoint
CREATE TABLE "lane_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"heat_id" integer NOT NULL,
	"server_participant_id" integer,
	"lane_number" integer NOT NULL,
	"athlete_name" varchar,
	"birth_year" varchar,
	"age_group" varchar,
	"club_name" varchar,
	"seed_time" varchar,
	"final_time_millis" bigint,
	"final_time" varchar,
	"status" varchar DEFAULT 'OK'
);
--> statement-breakpoint
CREATE TABLE "lap_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"lane_assignment_id" integer NOT NULL,
	"lap_number" integer NOT NULL,
	"split_time" varchar NOT NULL,
	"cumulative_time" varchar NOT NULL,
	"raw_millis" bigint NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "heats" ADD CONSTRAINT "heats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lane_assignments" ADD CONSTRAINT "lane_assignments_heat_id_heats_id_fk" FOREIGN KEY ("heat_id") REFERENCES "public"."heats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lap_times" ADD CONSTRAINT "lap_times_lane_assignment_id_lane_assignments_id_fk" FOREIGN KEY ("lane_assignment_id") REFERENCES "public"."lane_assignments"("id") ON DELETE cascade ON UPDATE no action;